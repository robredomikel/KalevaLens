import "server-only";
import { randomUUID } from "crypto";
import { sql } from "@/lib/neon";
import { ensureDatabaseSchema } from "@/lib/db/init";
import { runArticlePreferenceAgent } from "@/lib/ai/agents/articlePreference";
import { DEFAULT_PREFERENCES, normalizePreferences, UserPreferences } from "./config";

export async function getUserPreferences(userId?: string | null): Promise<UserPreferences> {
  if (!userId) return DEFAULT_PREFERENCES;
  await ensureDatabaseSchema();
  try {
    const rows = await sql`
      SELECT 
        "audioLanguage", "articleLanguage", "articleLength",
        "preferredLanguage", "preferredLanguageLevel", "customLanguage",
        "finnishPracticeFrequency", "finnishPracticeMode",
        "userSituation", "timeInFinland", "finnishSocietyFamiliarity",
        "topicInterests", "newsGoals", "contextLevel", "discoveryOpenness",
        "onboardingCompleted", "onboardingCompletedAt"
      FROM "UserPreference" 
      WHERE "userId"=${userId} 
      LIMIT 1;
    `;
    if (!rows.length) return DEFAULT_PREFERENCES;
    return normalizePreferences(rows[0]);
  } catch (err) {
    console.error("Error loading user preferences:", err);
    return DEFAULT_PREFERENCES;
  }
}

export async function persistUserPreferences(userId: string, input: Partial<UserPreferences>) {
  await ensureDatabaseSchema();
  const preferences = normalizePreferences(input);
  const topicInterestsJson = JSON.stringify(preferences.topicInterests || []);
  const newsGoalsJson = JSON.stringify(preferences.newsGoals || []);
  const completedAt = preferences.onboardingCompleted ? (preferences.onboardingCompletedAt || new Date().toISOString()) : null;

  await sql`
    INSERT INTO "UserPreference" (
      "userId", "audioLanguage", "articleLanguage", "articleLength",
      "preferredLanguage", "preferredLanguageLevel", "customLanguage",
      "finnishPracticeFrequency", "finnishPracticeMode",
      "userSituation", "timeInFinland", "finnishSocietyFamiliarity",
      "topicInterests", "newsGoals", "contextLevel", "discoveryOpenness",
      "onboardingCompleted", "onboardingCompletedAt"
    )
    VALUES (
      ${userId}, ${preferences.audioLanguage}, ${preferences.articleLanguage}, ${preferences.articleLength},
      ${preferences.preferredLanguage}, ${preferences.preferredLanguageLevel}, ${preferences.customLanguage || ''},
      ${preferences.finnishPracticeFrequency}, ${preferences.finnishPracticeMode},
      ${preferences.userSituation}, ${preferences.timeInFinland}, ${preferences.finnishSocietyFamiliarity},
      ${topicInterestsJson}::jsonb, ${newsGoalsJson}::jsonb, ${preferences.contextLevel}, ${preferences.discoveryOpenness},
      ${preferences.onboardingCompleted}, ${completedAt}
    )
    ON CONFLICT ("userId") DO UPDATE SET
      "audioLanguage"=EXCLUDED."audioLanguage",
      "articleLanguage"=EXCLUDED."articleLanguage",
      "articleLength"=EXCLUDED."articleLength",
      "preferredLanguage"=EXCLUDED."preferredLanguage",
      "preferredLanguageLevel"=EXCLUDED."preferredLanguageLevel",
      "customLanguage"=EXCLUDED."customLanguage",
      "finnishPracticeFrequency"=EXCLUDED."finnishPracticeFrequency",
      "finnishPracticeMode"=EXCLUDED."finnishPracticeMode",
      "userSituation"=EXCLUDED."userSituation",
      "timeInFinland"=EXCLUDED."timeInFinland",
      "finnishSocietyFamiliarity"=EXCLUDED."finnishSocietyFamiliarity",
      "topicInterests"=EXCLUDED."topicInterests",
      "newsGoals"=EXCLUDED."newsGoals",
      "contextLevel"=EXCLUDED."contextLevel",
      "discoveryOpenness"=EXCLUDED."discoveryOpenness",
      "onboardingCompleted"=EXCLUDED."onboardingCompleted",
      "onboardingCompletedAt"=EXCLUDED."onboardingCompletedAt",
      "updatedAt"=CURRENT_TIMESTAMP;
  `;
  return preferences;
}

export async function hasCompletedOnboarding(userId: string): Promise<boolean> {
  if (!userId) return false;
  await ensureDatabaseSchema();
  try {
    const rows = await sql`SELECT "onboardingCompleted" FROM "UserPreference" WHERE "userId"=${userId} LIMIT 1;`;
    return Boolean(rows[0]?.onboardingCompleted);
  } catch {
    return false;
  }
}

export async function enqueuePreferredArticles(language: string, length: string, priority = 20) {
  await ensureDatabaseSchema();
  const articles = await sql`
    INSERT INTO "ArticlePreferenceJob" (id, "storyId", "articleId", "articleVersion", language, length, status, priority)
    SELECT md5(s.id::text || ':' || ${language} || ':' || ${length} || ':' || COALESCE(s."articleVersion", 'legacy')),
      s.id, COALESCE(s."canonicalId", s.id::text), COALESCE(s."articleVersion", 'legacy'), ${language}, ${length}, 'pending', ${priority}
    FROM (SELECT * FROM "StorySubmission" WHERE stage='PUBLISHED' ORDER BY "createdAt" DESC LIMIT 500) s
    ON CONFLICT ("articleId", "articleVersion", language, length) DO UPDATE SET
      status=CASE WHEN "ArticlePreferenceJob".status='failed' THEN 'pending' ELSE "ArticlePreferenceJob".status END,
      attempts=CASE WHEN "ArticlePreferenceJob".status='failed' THEN 0 ELSE "ArticlePreferenceJob".attempts END,
      "runAfter"=CASE WHEN "ArticlePreferenceJob".status='failed' THEN CURRENT_TIMESTAMP ELSE "ArticlePreferenceJob"."runAfter" END,
      priority=GREATEST("ArticlePreferenceJob".priority, EXCLUDED.priority), "updatedAt"=CURRENT_TIMESTAMP
    RETURNING "storyId" AS id;
  `;
  return articles;
}

export async function attachPreferredContent<T extends Record<string, unknown>>(articles: T[], language: string, length: string) {
  if (!articles.length) return articles;
  const ids = articles.map((article) => String(article.canonicalId || article.id));
  const rows = await sql`SELECT "articleId", "articleVersion", title, summary, content FROM "ArticlePreferenceVariant" WHERE "articleId"=ANY(${ids}) AND language=${language} AND length=${length} AND status='ready';`;
  const variants = new Map(rows.map((row) => [`${String(row.articleId)}:${String(row.articleVersion)}`, row]));
  return articles.map((article) => {
    const variant = variants.get(`${String(article.canonicalId || article.id)}:${String(article.articleVersion || "legacy")}`);
    return variant ? { ...article, title: variant.title, summary: variant.summary, content: variant.content, preferredContentReady: true } : { ...article, preferredContentReady: false };
  });
}

export async function processArticlePreferenceJobs(limit = 2) {
  await ensureDatabaseSchema();
  await sql`UPDATE "ArticlePreferenceJob" SET status='retrying', "runAfter"=CURRENT_TIMESTAMP WHERE status='processing' AND "updatedAt" < CURRENT_TIMESTAMP - INTERVAL '15 minutes';`;
  const jobs = await sql`
    UPDATE "ArticlePreferenceJob" SET status='processing', attempts=attempts+1, "updatedAt"=CURRENT_TIMESTAMP
    WHERE id IN (SELECT id FROM "ArticlePreferenceJob" WHERE status IN ('pending','retrying') AND "runAfter" <= CURRENT_TIMESTAMP ORDER BY priority DESC, "createdAt" ASC FOR UPDATE SKIP LOCKED LIMIT ${limit})
    RETURNING *;
  `;
  let ready = 0;
  for (const job of jobs) {
    try {
      const source = await sql`SELECT title, summary, content FROM "StorySubmission" WHERE id=${job.storyId} LIMIT 1;`;
      if (!source.length) throw new Error("Source article no longer exists");
      const generated = await runArticlePreferenceAgent(source[0], job.language, job.length);
      await sql`
        INSERT INTO "ArticlePreferenceVariant" (id, "articleId", "articleVersion", language, length, title, summary, content, model, status)
        VALUES (${randomUUID()}, ${job.articleId}, ${job.articleVersion}, ${job.language}, ${job.length}, ${generated.title}, ${JSON.stringify(generated.summary)}, ${generated.content}, ${generated.model}, 'ready')
        ON CONFLICT ("articleId", "articleVersion", language, length) DO UPDATE SET title=EXCLUDED.title, summary=EXCLUDED.summary, content=EXCLUDED.content, model=EXCLUDED.model, status='ready', "updatedAt"=CURRENT_TIMESTAMP;
      `;
      await sql`UPDATE "ArticlePreferenceJob" SET status='ready', "lastError"=NULL, "updatedAt"=CURRENT_TIMESTAMP WHERE id=${job.id};`;
      ready += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const exhausted = Number(job.attempts) >= 3;
      await sql`UPDATE "ArticlePreferenceJob" SET status=${exhausted ? "failed" : "retrying"}, "lastError"=${message.slice(0, 2000)}, "runAfter"=CURRENT_TIMESTAMP + INTERVAL '30 seconds', "updatedAt"=CURRENT_TIMESTAMP WHERE id=${job.id};`;
    }
  }
  return { claimed: jobs.length, ready };
}
