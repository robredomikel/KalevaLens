import "server-only";
import { randomUUID } from "crypto";
import { sql } from "@/lib/neon";
import { ensureDatabaseSchema } from "@/lib/db/init";
import { getMediaStorage } from "@/lib/storage/mediaStorage";
import { runNewsNarrationAgent } from "@/lib/ai/agents/newsNarration";
import { runAudioProductionAgent } from "@/lib/ai/agents/audioProduction";
import { runMediaQualityAgent } from "@/lib/ai/agents/mediaQuality";
import { getMediaConfig } from "@/lib/ai/models";
import { enqueueArticleMedia, getMediaArticle, getOrCreateScript, normalizeStoredArticles, saveMedia } from "./repository";
import { ProducedMedia } from "./types";

type Job = { id: string; articleId: string; articleVersion: string; language: string; mediaType: "audio"; scriptVersion: string; attempts: number };

async function sendToMediaAudit(job: Job, message: string) {
  const stories = await sql`SELECT id FROM "StorySubmission" WHERE "canonicalId"=${job.articleId} AND "articleVersion"=${job.articleVersion} AND stage='PUBLISHED' LIMIT 1;`;
  const storyId = stories[0]?.id;
  if (!storyId) return false;
  const workflowId = `media-audit:${job.id}`;
  await sql`UPDATE "StorySubmission" SET stage='REVIEW', "updatedAt"=CURRENT_TIMESTAMP WHERE id=${storyId};`;
  await sql`
    INSERT INTO "EditorialTask" (id, "workflowId", "storyId", "taskType", status, details)
    SELECT ${randomUUID()}, ${workflowId}, ${storyId}, 'HITL_MEDIA_AUDIT', 'PENDING', ${JSON.stringify({
      reason: "Audio generation failed after all retries",
      error: message.slice(0, 2000),
      language: job.language,
      mediaType: job.mediaType,
      articleVersion: job.articleVersion,
    })}
    WHERE NOT EXISTS (SELECT 1 FROM "EditorialTask" WHERE "workflowId"=${workflowId} AND status='PENDING');
  `;
  return true;
}

async function claimJob(workerId: string): Promise<Job | null> {
  const rows = await sql`
    UPDATE "MediaJob" SET status='processing', "lockedAt"=CURRENT_TIMESTAMP, "lockedBy"=${workerId}, attempts=attempts+1, "updatedAt"=CURRENT_TIMESTAMP
    WHERE id = (SELECT id FROM "MediaJob" WHERE status IN ('pending','retrying') AND "runAfter" <= CURRENT_TIMESTAMP ORDER BY priority DESC, "createdAt" ASC FOR UPDATE SKIP LOCKED LIMIT 1)
    RETURNING id, "articleId", "articleVersion", language, "mediaType", "scriptVersion", attempts;
  `;
  return (rows[0] as Job) || null;
}

async function markFailure(job: Job, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const rows = await sql`SELECT "maxAttempts" FROM "MediaJob" WHERE id=${job.id};`;
  const exhausted = job.attempts >= Number(rows[0]?.maxAttempts || 3);
  const delaySeconds = Math.min(3600, 30 * 2 ** Math.max(0, job.attempts - 1));
  await sql`UPDATE "MediaJob" SET status=${exhausted ? "failed" : "retrying"}, "lastError"=${message.slice(0, 2000)}, "runAfter"=CURRENT_TIMESTAMP + (${delaySeconds} * INTERVAL '1 second'), "lockedAt"=NULL, "lockedBy"=NULL, "updatedAt"=CURRENT_TIMESTAMP WHERE id=${job.id};`;
  await sql`UPDATE "ArticleMedia" SET status='failed', "errorMessage"=${message.slice(0, 2000)}, "updatedAt"=CURRENT_TIMESTAMP WHERE "articleId"=${job.articleId} AND "articleVersion"=${job.articleVersion} AND language=${job.language} AND "mediaType"=${job.mediaType} AND "scriptVersion"=${job.scriptVersion};`;

  if (exhausted) {
    await sendToMediaAudit(job, message);
  }
}

export async function auditFailedMediaJobs() {
  await ensureDatabaseSchema();
  const failed = await sql`
    SELECT id, "articleId", "articleVersion", language, "mediaType", "scriptVersion", attempts, "lastError"
    FROM "MediaJob" WHERE status='failed';
  `;
  let escalated = 0;
  for (const row of failed) {
    if (await sendToMediaAudit(row as Job, String(row.lastError || "Unknown audio generation error"))) escalated += 1;
  }
  return { checked: failed.length, escalated };
}

async function processJob(job: Job) {
  const durationSeconds = Number(job.scriptVersion.match(/grounded-(\d+)s/)?.[1] || getMediaConfig().maxAudioDurationSeconds);
  const article = await getMediaArticle(job.articleId, job.articleVersion, job.language);
  const { script } = await getOrCreateScript(article, job.scriptVersion, () =>
    runNewsNarrationAgent(article, durationSeconds)
  );
  const output: ProducedMedia = await runAudioProductionAgent(script, durationSeconds);
  const quality = await runMediaQualityAgent(output, job.mediaType);
  if (!quality.passed) throw new Error(`Media QA failed: ${quality.errors.join("; ")}`);
  const base = `${article.canonicalId.replace(/[^a-zA-Z0-9_-]/g, "_")}/${article.version}/${article.language}`;
  const stored = await getMediaStorage().put(`${base}/${job.mediaType}.${output.extension}`, output.buffer, output.mimeType);
  await saveMedia(article, job.mediaType, output, stored, job.scriptVersion);
  await sql`UPDATE "MediaJob" SET status='ready', "lockedAt"=NULL, "lockedBy"=NULL, "lastError"=NULL, "updatedAt"=CURRENT_TIMESTAMP WHERE id=${job.id};`;
}

export async function processMediaJobs(limit = getMediaConfig().maxConcurrentJobs) {
  await ensureDatabaseSchema();
  const workerId = `worker-${randomUUID()}`;
  const claimed: Job[] = [];
  for (let i = 0; i < Math.max(1, limit); i++) {
    const job = await claimJob(workerId);
    if (!job) break;
    claimed.push(job);
  }
  const results = await Promise.allSettled(claimed.map(async (job) => {
    try { await processJob(job); return job.id; } catch (error) { await markFailure(job, error); throw error; }
  }));
  return { claimed: claimed.length, ready: results.filter((r) => r.status === "fulfilled").length, failed: results.filter((r) => r.status === "rejected").length };
}

export async function reconcileMediaJobs(languages = ["en"]) {
  await ensureDatabaseSchema();
  await auditFailedMediaJobs();
  await sql`UPDATE "MediaJob" SET status='retrying', "lockedAt"=NULL, "lockedBy"=NULL, "runAfter"=CURRENT_TIMESTAMP WHERE status='processing' AND "lockedAt" < CURRENT_TIMESTAMP - INTERVAL '15 minutes';`;
  await normalizeStoredArticles();
  const limit = process.env.MEDIA_DEMO_MODE === "true" ? getMediaConfig().demoArticleLimit : 10000;
  const articles = await sql`SELECT id FROM "StorySubmission" WHERE stage='PUBLISHED' ORDER BY "createdAt" DESC LIMIT ${limit};`;
  let queued = 0;
  for (const article of articles) for (const language of languages) queued += await enqueueArticleMedia(article.id, language);
  return { articles: articles.length, queued };
}

export async function invalidateArticleMedia(storyId: string) {
  const rows = await sql`SELECT "canonicalId" FROM "StorySubmission" WHERE id=${storyId} LIMIT 1;`;
  if (!rows.length) return;
  await sql`UPDATE "ArticleMedia" SET status='cancelled', "updatedAt"=CURRENT_TIMESTAMP WHERE "articleId"=${rows[0].canonicalId} AND status='ready';`;
  await enqueueArticleMedia(storyId, "en", 20);
}
