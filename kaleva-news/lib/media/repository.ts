import "server-only";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
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

export async function syncExistingFilesystemMedia() {
  if (!process.env.DATABASE_URL) return 0;
  await ensureDatabaseSchema();
  const storageRoot = path.resolve(process.env.MEDIA_STORAGE_ROOT || path.join(process.cwd(), "public", "generated-media"));
  if (!fs.existsSync(storageRoot)) return 0;

  try {
    const existing = await sql`SELECT "storageKey" FROM "ArticleMedia" WHERE status = 'ready' AND "mediaType" = 'audio';`;
    const existingKeys = new Set(existing.map((row) => String(row.storageKey)));

    const toInsert: Array<{
      folderName: string;
      canonicalArticleId: string;
      version: string;
      language: string;
      relKey: string;
      mediaUrl: string;
      size: number;
    }> = [];

    const rootDirs = fs.readdirSync(storageRoot, { withFileTypes: true });
    for (const rootDir of rootDirs) {
      if (!rootDir.isDirectory()) continue;
      const folderName = rootDir.name;
      const dirPath = path.join(storageRoot, folderName);
      const canonicalArticleId = folderName.includes("_") ? folderName.replace("_", ":") : folderName;

      const versionDirs = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const vDir of versionDirs) {
        if (!vDir.isDirectory()) continue;
        const version = vDir.name;
        const vPath = path.join(dirPath, version);

        const langDirs = fs.readdirSync(vPath, { withFileTypes: true });
        for (const lDir of langDirs) {
          if (!lDir.isDirectory()) continue;
          const language = lDir.name;
          const lPath = path.join(vPath, language);

          const audioFile = path.join(lPath, "audio.mp3");
          if (fs.existsSync(audioFile)) {
            const relKey = `${folderName}/${version}/${language}/audio.mp3`;
            if (!existingKeys.has(relKey)) {
              const stat = fs.statSync(audioFile);
              if (stat.size > 100) {
                toInsert.push({
                  folderName,
                  canonicalArticleId,
                  version,
                  language,
                  relKey,
                  mediaUrl: `/generated-media/${relKey}`,
                  size: stat.size,
                });
              }
            }
          }
        }
      }
    }

    if (!toInsert.length) return 0;

    const scriptVer = audioScriptVersion();
    for (const item of toInsert) {
      await sql`
        INSERT INTO "ArticleMedia" (
          id, "articleId", "articleVersion", language, "mediaType", status,
          "storageKey", "mediaUrl", "mimeType", "fileSize", "generationMethod", "scriptVersion"
        )
        VALUES (
          ${randomUUID()}, ${item.canonicalArticleId}, ${item.version}, ${item.language}, 'audio', 'ready',
          ${item.relKey}, ${item.mediaUrl}, 'audio/mpeg', ${item.size}, 'filesystem-reconciled', ${scriptVer}
        )
        ON CONFLICT ("articleId", "articleVersion", language, "mediaType", "scriptVersion") DO UPDATE SET
          status = 'ready', "mediaUrl" = EXCLUDED."mediaUrl", "fileSize" = EXCLUDED."fileSize", "updatedAt" = CURRENT_TIMESTAMP;
      `;

      await sql`
        UPDATE "MediaJob" SET status = 'ready', "updatedAt" = CURRENT_TIMESTAMP
        WHERE "articleId" = ${item.canonicalArticleId} AND "articleVersion" = ${item.version} AND language = ${item.language} AND "mediaType" = 'audio';
      `;
    }

    return toInsert.length;
  } catch (err) {
    console.error("Error in syncExistingFilesystemMedia:", err);
    return 0;
  }
}

export async function attachMedia<T extends Record<string, unknown>>(articles: T[], language = "en") {
  if (!articles.length) return articles;
  if (!process.env.DATABASE_URL) return articles.map((a) => ({ ...a, media: {} }));

  await ensureDatabaseSchema();
  await syncExistingFilesystemMedia();

  const keyToArticleKeys = new Map<string, string[]>();
  const queryIdSet = new Set<string>();

  for (const a of articles) {
    const rawId = String(a.id || "").trim();
    const canonicalId = String(a.canonicalId || "").trim();
    const primaryKey = canonicalId || rawId;

    const possibleKeys = [
      canonicalId,
      rawId,
      rawId ? `internal:${rawId}` : "",
      rawId ? `external:${rawId}` : "",
    ].filter(Boolean);

    for (const key of possibleKeys) {
      queryIdSet.add(key);
      const list = keyToArticleKeys.get(key) || [];
      if (!list.includes(primaryKey)) list.push(primaryKey);
      keyToArticleKeys.set(key, list);
    }
  }

  const queryIds = Array.from(queryIdSet);
  if (!queryIds.length) return articles.map((a) => ({ ...a, media: {} }));

  const currentScriptVer = audioScriptVersion();

  const mediaRows = await sql`
    SELECT "articleId", "mediaType", status, "mediaUrl", "captionsUrl", "durationSeconds", "mimeType", language, "scriptVersion"
    FROM "ArticleMedia"
    WHERE "articleId" = ANY(${queryIds}) AND status = 'ready';
  `;

  const jobRows = await sql`
    SELECT "articleId", "mediaType", status, language, "scriptVersion"
    FROM "MediaJob"
    WHERE "articleId" = ANY(${queryIds});
  `;

  const articleMediaMap = new Map<string, Record<string, FeedMedia>>();

  for (const job of jobRows) {
    const dbKey = String(job.articleId);
    const targetArticleKeys = keyToArticleKeys.get(dbKey) || [dbKey];
    for (const targetKey of targetArticleKeys) {
      const current = articleMediaMap.get(targetKey) || {};
      const type = String(job.mediaType);
      if (!current[type]) {
        current[type] = { status: String(job.status), url: "" };
        articleMediaMap.set(targetKey, current);
      }
    }
  }

  type MediaRow = typeof mediaRows[number];
  const candidatesMap = new Map<string, Map<string, MediaRow[]>>();

  for (const row of mediaRows) {
    const dbKey = String(row.articleId);
    const targetArticleKeys = keyToArticleKeys.get(dbKey) || [dbKey];
    for (const targetKey of targetArticleKeys) {
      if (!candidatesMap.has(targetKey)) candidatesMap.set(targetKey, new Map());
      const typeMap = candidatesMap.get(targetKey)!;
      const type = String(row.mediaType);
      const list = typeMap.get(type) || [];
      list.push(row);
      typeMap.set(type, list);
    }
  }

  for (const [targetKey, typeMap] of candidatesMap.entries()) {
    const current = articleMediaMap.get(targetKey) || {};
    for (const [type, candidates] of typeMap.entries()) {
      let best = candidates.find((c) => c.language === language && c.scriptVersion === currentScriptVer);
      if (!best) best = candidates.find((c) => c.language === language);
      if (!best) best = candidates.find((c) => c.scriptVersion === currentScriptVer);
      if (!best) best = candidates[0];

      if (best) {
        current[type] = {
          status: "ready",
          url: String(best.mediaUrl),
          captionsUrl: best.captionsUrl ? String(best.captionsUrl) : undefined,
          durationSeconds: best.durationSeconds ? Number(best.durationSeconds) : undefined,
          mimeType: best.mimeType ? String(best.mimeType) : undefined,
        };
      }
    }
    articleMediaMap.set(targetKey, current);
  }

  return articles.map((a) => {
    const primaryKey = String(a.canonicalId || a.id);
    return {
      ...a,
      media: articleMediaMap.get(primaryKey) || {},
    };
  });
}

