import "server-only";
import { randomUUID } from "crypto";
import { sql } from "@/lib/neon";
import { ensureDatabaseSchema } from "@/lib/db/init";
import { getMediaConfig } from "@/lib/ai/models";
import { MediaArticle, MediaType, NarrationScript, ProducedMedia } from "./types";
import { articleVersion as calculateVersion, canonicalArticleId } from "./identity";
import { audioScriptVersion } from "@/lib/preferences/config";

export const SCRIPT_VERSION = audioScriptVersion();

function toPlainText(value: unknown) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export async function normalizeStoredArticles() {
  await ensureDatabaseSchema();
  const rows = await sql`SELECT id, title, summary, content, "sourceUrl", "sourceGuid", "canonicalId", "articleVersion", "updatedAt" FROM "StorySubmission" WHERE stage = 'PUBLISHED';`;
  for (const row of rows) {
    const canonical = row.canonicalId || canonicalArticleId({ internalId: row.id, guid: row.sourceGuid, url: row.sourceUrl, title: row.title });
    const version = calculateVersion(row);
    if (canonical !== row.canonicalId || version !== row.articleVersion) {
      await sql`UPDATE "StorySubmission" SET "canonicalId" = ${canonical}, "articleVersion" = ${version} WHERE id = ${row.id};`;
    }
  }
  return rows.length;
}

export async function enqueueArticleMedia(storyId: string, language = "en", priority = 0) {
  await ensureDatabaseSchema();
  const rows = await sql`SELECT id, title, summary, content, "sourceUrl", "sourceGuid", "canonicalId", "articleVersion", "updatedAt" FROM "StorySubmission" WHERE id = ${storyId} AND stage = 'PUBLISHED' LIMIT 1;`;
  if (!rows.length) return 0;
  const row = rows[0];
  const articleId = row.canonicalId || canonicalArticleId({ internalId: row.id, guid: row.sourceGuid, url: row.sourceUrl, title: row.title });
  const version = calculateVersion(row);
  await sql`UPDATE "StorySubmission" SET "canonicalId" = ${articleId}, "articleVersion" = ${version} WHERE id = ${storyId};`;
  const config = getMediaConfig();
  const scriptVersion = audioScriptVersion();
  const types: MediaType[] = config.audioEnabled ? ["audio"] : [];
  for (const type of types) {
    await sql`
      INSERT INTO "MediaJob" (id, "articleId", "articleVersion", language, "mediaType", "scriptVersion", status, priority, "maxAttempts")
      VALUES (${randomUUID()}, ${articleId}, ${version}, ${language}, ${type}, ${scriptVersion}, 'pending', ${priority + (type === "audio" ? 10 : 0)}, ${config.maxRetries})
      ON CONFLICT ("articleId", "articleVersion", language, "mediaType", "scriptVersion") DO UPDATE SET
        status = CASE WHEN "MediaJob".status IN ('failed', 'cancelled') THEN 'pending' ELSE "MediaJob".status END,
        attempts = CASE WHEN "MediaJob".status IN ('failed', 'cancelled') THEN 0 ELSE "MediaJob".attempts END,
        "lastError" = CASE WHEN "MediaJob".status IN ('failed', 'cancelled') THEN NULL ELSE "MediaJob"."lastError" END,
        "runAfter" = CASE WHEN "MediaJob".status IN ('failed', 'cancelled') THEN CURRENT_TIMESTAMP ELSE "MediaJob"."runAfter" END,
        priority = GREATEST("MediaJob".priority, EXCLUDED.priority),
        "updatedAt" = CURRENT_TIMESTAMP;
    `;
  }
  return types.length;
}

export async function getMediaArticle(articleId: string, version: string, language: string): Promise<MediaArticle> {
  const rows = await sql`
    SELECT s.id, s."canonicalId", s."articleVersion", s.title, s.summary, s.content, s."authorId", s."sourceUrl", s."createdAt",
      t.title AS "translatedTitle", t.summary AS "translatedSummary", t.content AS "translatedContent",
      c.explanation AS context
    FROM "StorySubmission" s
    LEFT JOIN "ArticleTranslation" t ON t."storyId" = s.id::text AND t.language = ${language}
    LEFT JOIN LATERAL (SELECT explanation FROM "ArticleContext" WHERE "storyId" = s.id::text ORDER BY "createdAt" DESC LIMIT 1) c ON true
    WHERE s."canonicalId" = ${articleId} AND s."articleVersion" = ${version} AND s.stage = 'PUBLISHED' LIMIT 1;
  `;
  if (!rows.length) throw new Error("Eligible article version not found");
  const row = rows[0];
  const translatedSummary = Array.isArray(row.translatedSummary) ? row.translatedSummary.join(" ") : row.translatedSummary;
  return {
    id: row.id, canonicalId: articleId, version, language,
    title: row.translatedTitle || row.title,
    summary: translatedSummary || row.summary || "",
    content: toPlainText(row.translatedContent || row.content || row.summary),
    sourceName: row.authorId || "Kaleva Media", sourceUrl: row.sourceUrl, publishedAt: row.createdAt, context: row.context,
  };
}

export async function getOrCreateScript(article: MediaArticle, scriptVersion: string, create: () => Promise<{ script: NarrationScript; model: string }>) {
  const existing = await sql`SELECT script, model FROM "NarrationScript" WHERE "articleId" = ${article.canonicalId} AND "articleVersion" = ${article.version} AND language = ${article.language} AND "scriptVersion" = ${scriptVersion} LIMIT 1;`;
  if (existing.length) return { script: existing[0].script as NarrationScript, model: existing[0].model as string };
  const generated = await create();
  await sql`INSERT INTO "NarrationScript" (id, "articleId", "articleVersion", language, "scriptVersion", script, model, "approvedAt") VALUES (${randomUUID()}, ${article.canonicalId}, ${article.version}, ${article.language}, ${scriptVersion}, ${JSON.stringify(generated.script)}, ${generated.model}, CURRENT_TIMESTAMP) ON CONFLICT ("articleId", "articleVersion", language, "scriptVersion") DO NOTHING;`;
  return generated;
}

export async function saveMedia(article: MediaArticle, type: MediaType, media: ProducedMedia, stored: { key: string; url: string; size: number }, scriptVersion = SCRIPT_VERSION) {
  await sql`
    INSERT INTO "ArticleMedia" (id, "articleId", "articleVersion", language, "mediaType", status, "storageKey", "mediaUrl", "captionsUrl", "mimeType", "durationSeconds", "fileSize", voice, resolution, "generationModel", "generationMethod", "scriptVersion")
    VALUES (${randomUUID()}, ${article.canonicalId}, ${article.version}, ${article.language}, ${type}, 'ready', ${stored.key}, ${stored.url}, NULL, ${media.mimeType}, ${media.durationSeconds}, ${stored.size}, ${media.voice || null}, NULL, ${media.model || null}, ${media.method}, ${scriptVersion})
    ON CONFLICT ("articleId", "articleVersion", language, "mediaType", "scriptVersion") DO UPDATE SET status='ready', "storageKey"=EXCLUDED."storageKey", "mediaUrl"=EXCLUDED."mediaUrl", "captionsUrl"=EXCLUDED."captionsUrl", "mimeType"=EXCLUDED."mimeType", "durationSeconds"=EXCLUDED."durationSeconds", "fileSize"=EXCLUDED."fileSize", voice=EXCLUDED.voice, resolution=EXCLUDED.resolution, "generationModel"=EXCLUDED."generationModel", "generationMethod"=EXCLUDED."generationMethod", "errorMessage"=NULL, "updatedAt"=CURRENT_TIMESTAMP;
  `;
}

type FeedMedia = { status: string; url: string; captionsUrl?: string; durationSeconds?: number; mimeType?: string };

export async function attachMedia<T extends Record<string, unknown>>(articles: T[], language = "en") {
  if (!articles.length) return articles;
  const ids = articles.map((a) => String(a.canonicalId || a.id)).filter(Boolean);
  if (!ids.length) return articles.map((article) => ({ ...article, media: {} }));
  const scriptVersion = audioScriptVersion();
  const media = await sql`SELECT "articleId", "mediaType", status, "mediaUrl", "captionsUrl", "durationSeconds", "mimeType" FROM "ArticleMedia" WHERE "articleId" = ANY(${ids}) AND language = ${language} AND "scriptVersion" = ${scriptVersion} AND status = 'ready';`;
  const jobs = await sql`SELECT "articleId", "mediaType", status FROM "MediaJob" WHERE "articleId" = ANY(${ids}) AND language = ${language} AND "scriptVersion" = ${scriptVersion};`;
  const grouped = new Map<string, Record<string, FeedMedia>>();
  for (const item of jobs) {
    const articleId = String(item.articleId);
    const current = grouped.get(articleId) || {};
    current[String(item.mediaType)] = { status: String(item.status), url: "" };
    grouped.set(articleId, current);
  }
  for (const item of media) {
    const articleId = String(item.articleId);
    const current = grouped.get(articleId) || {};
    current[String(item.mediaType)] = { status: String(item.status), url: String(item.mediaUrl), captionsUrl: item.captionsUrl ? String(item.captionsUrl) : undefined, durationSeconds: item.durationSeconds ? Number(item.durationSeconds) : undefined, mimeType: item.mimeType ? String(item.mimeType) : undefined };
    grouped.set(articleId, current);
  }
  return articles.map((article) => ({ ...article, media: grouped.get(String(article.canonicalId || article.id)) || {} }));
}

