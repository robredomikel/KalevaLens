import { randomUUID } from 'crypto';
import { sql } from '@/lib/neon';
import { ensureDatabaseSchema } from '@/lib/db/init';
import { canonicalArticleId, articleVersion } from '@/lib/media/identity';
import { enqueueArticleMedia } from '@/lib/media/repository';
import { getMediaConfig } from '@/lib/ai/models';
import { getEnabledRSSSources, getRSSSourceById } from './sources';
import { fetchAndParseSource, FeedValidationResult } from './parser';
import { extractArticleImage } from './extractArticleImage';

export interface IngestionResult {
  timestamp: string;
  totalSourcesProcessed: number;
  totalArticlesParsed: number;
  newArticlesInserted: number;
  duplicatesSkipped: number;
  articlesUpdated: number;
  validations: FeedValidationResult[];
}

let lastIngestionTime = 0;
let isIngestionRunning = false;
const MIN_INGESTION_INTERVAL_MS = 60 * 1000; // 1 minute throttle for auto-calls

export async function ingestAllRSSFeeds(force = false): Promise<IngestionResult> {
  const now = Date.now();
  if (isIngestionRunning) {
    return {
      timestamp: new Date().toISOString(),
      totalSourcesProcessed: 0,
      totalArticlesParsed: 0,
      newArticlesInserted: 0,
      duplicatesSkipped: 0,
      articlesUpdated: 0,
      validations: [],
    };
  }

  if (!force && now - lastIngestionTime < MIN_INGESTION_INTERVAL_MS) {
    return {
      timestamp: new Date().toISOString(),
      totalSourcesProcessed: 0,
      totalArticlesParsed: 0,
      newArticlesInserted: 0,
      duplicatesSkipped: 0,
      articlesUpdated: 0,
      validations: [],
    };
  }

  isIngestionRunning = true;
  lastIngestionTime = now;

  await ensureDatabaseSchema();

  const sources = getEnabledRSSSources();
  let queuedMediaCount = 0;
  const demoLimit = process.env.MEDIA_DEMO_MODE === 'true' ? getMediaConfig().demoArticleLimit : Number.POSITIVE_INFINITY;

  let totalArticlesParsed = 0;
  let newArticlesInserted = 0;
  let duplicatesSkipped = 0;
  let articlesUpdated = 0;
  const validations: FeedValidationResult[] = [];

  try {
    const fetchedResults = await Promise.all(
      sources.map((source) => fetchAndParseSource(source))
    );

    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      const { items, validation } = fetchedResults[i];
      validations.push(validation);

      // Log validation status in database
      try {
        await sql`
          INSERT INTO "RSSFeedLog" (id, "sourceId", publisher, accessible, "itemCount", "availableMetadataFields", "lastChecked", error)
          VALUES (
            ${randomUUID()},
            ${validation.sourceId},
            ${validation.publisher},
            ${validation.accessible},
            ${validation.itemCount},
            ${JSON.stringify(validation.availableMetadataFields)},
            CURRENT_TIMESTAMP,
            ${validation.error || null}
          )
          ON CONFLICT ("sourceId") DO UPDATE SET
            publisher = EXCLUDED.publisher,
            accessible = EXCLUDED.accessible,
            "itemCount" = EXCLUDED."itemCount",
            "availableMetadataFields" = EXCLUDED."availableMetadataFields",
            "lastChecked" = CURRENT_TIMESTAMP,
            error = EXCLUDED.error;
        `;
      } catch (logErr) {
        console.error(`[RSS Ingestion] Could not log status for source ${source.id}:`, logErr);
      }

      if (!validation.accessible || items.length === 0) {
        continue;
      }

      totalArticlesParsed += items.length;

      for (const item of items) {
        const canonicalId = canonicalArticleId({
          guid: item.guid,
          url: item.url,
          source: item.publisher,
          title: item.title,
        });

        const version = articleVersion({
          title: item.title,
          summary: item.summary,
          content: item.content,
        });

        const sourceType = source.id.startsWith('kaleva')
          ? 'KALEVA_RSS'
          : source.classification === 'local' || source.classification === 'finnish'
          ? 'FINNISH_RSS'
          : 'INTERNATIONAL_RSS';

        const communityTag = source.id.startsWith('kaleva') || source.id === 'yle-north-ostrobothnia'
          ? 'Oulu'
          : source.classification === 'finnish'
          ? 'Northern Finland'
          : source.classification === 'european'
          ? 'Europe'
          : 'World';

        const licensingJson = JSON.stringify(source.permissions);

        try {
          const existing = await sql`
            SELECT id, content, "articleVersion", "imageUrl" FROM "StorySubmission"
            WHERE "canonicalId" = ${canonicalId} OR title = ${item.title}
            LIMIT 1;
          `;

          if (existing.length === 0) {
            const id = randomUUID();
            await sql`
              INSERT INTO "StorySubmission" (
                id, title, summary, content, community, category, "authorId", stage, priority,
                "sourceType", "sourceUrl", "sourceGuid", "canonicalId", "articleVersion",
                "sourceId", "imageUrl", "contentAccessLevel", "licensingRules"
              ) VALUES (
                ${id},
                ${item.title},
                ${item.summary},
                ${item.content},
                ${communityTag},
                ${item.defaultCategory},
                ${item.publisher},
                'PUBLISHED',
                ${source.priority},
                ${sourceType},
                ${item.url},
                ${item.guid},
                ${canonicalId},
                ${version},
                ${item.sourceId},
                ${item.imageUrl || null},
                ${item.contentAccessLevel},
                ${licensingJson}
              );
            `;

            newArticlesInserted++;

            if (queuedMediaCount < demoLimit) {
              await enqueueArticleMedia(id, 'en', source.priority > 80 ? 10 : 5);
              queuedMediaCount++;
            }
          } else {
            duplicatesSkipped++;
            const existingRow = existing[0];
            const hasNewImage = Boolean(item.imageUrl && !existingRow.imageUrl);
            const contentChanged = Boolean(
              item.content &&
              (existingRow.content !== item.content || existingRow.articleVersion !== version)
            );

            if (contentChanged || hasNewImage) {
              await sql`
                UPDATE "StorySubmission"
                SET content = ${item.content},
                    summary = ${item.summary},
                    "articleVersion" = ${version},
                    "imageUrl" = COALESCE("imageUrl", ${item.imageUrl || null}),
                    "updatedAt" = CURRENT_TIMESTAMP
                WHERE id = ${existingRow.id};
              `;
              articlesUpdated++;
            }
          }
        } catch (itemErr) {
          console.error(`[RSS Ingestion] Failed to insert/update article "${item.title}":`, itemErr);
        }
      }
    }
  } finally {
    isIngestionRunning = false;
  }

  return {
    timestamp: new Date().toISOString(),
    totalSourcesProcessed: sources.length,
    totalArticlesParsed,
    newArticlesInserted,
    duplicatesSkipped,
    articlesUpdated,
    validations,
  };
}

export async function getRSSFeedLogs(): Promise<FeedValidationResult[]> {
  await ensureDatabaseSchema();
  try {
    const rows = await sql`
      SELECT "sourceId", publisher, accessible, "itemCount", "availableMetadataFields", "lastChecked", error
      FROM "RSSFeedLog"
      ORDER BY "lastChecked" DESC;
    `;
    return rows.map((r: Record<string, unknown>) => {
      const sourceId = String(r.sourceId);
      const source = getRSSSourceById(sourceId);
      return {
        sourceId,
        publisher: String(r.publisher),
        url: source?.url || '',
        accessible: Boolean(r.accessible),
        itemCount: Number(r.itemCount || 0),
        originalLanguage: source?.language || 'en',
        availableMetadataFields: Array.isArray(r.availableMetadataFields)
          ? (r.availableMetadataFields as string[])
          : [],
        lastChecked: r.lastChecked ? new Date(String(r.lastChecked)).toISOString() : new Date().toISOString(),
        error: r.error ? String(r.error) : undefined,
      };
    });
  } catch (err) {
    console.error('Error fetching RSS Feed Logs:', err);
    return [];
  }
}

/**
 * Idempotent backfill mechanism to extract and update missing article images
 * for existing database records.
 */
export async function backfillArticleImages(): Promise<{
  processedCount: number;
  updatedCount: number;
  failedCount: number;
}> {
  await ensureDatabaseSchema();

  try {
    const missingArticles = await sql`
      SELECT id, title, summary, content, "sourceUrl"
      FROM "StorySubmission"
      WHERE ("imageUrl" IS NULL OR "imageUrl" = '') AND "sourceUrl" IS NOT NULL AND "sourceUrl" != ''
      ORDER BY "createdAt" DESC
      LIMIT 100;
    `;

    let updatedCount = 0;
    let failedCount = 0;

    for (const article of missingArticles) {
      if (!article.sourceUrl) continue;

      try {
        const extracted = await extractArticleImage(
          {
            link: article.sourceUrl,
            description: article.summary,
            content: article.content,
          },
          {
            baseUrl: article.sourceUrl,
            allowOgFallback: true,
          }
        );

        if (extracted?.url) {
          await sql`
            UPDATE "StorySubmission"
            SET "imageUrl" = ${extracted.url},
                "updatedAt" = CURRENT_TIMESTAMP
            WHERE id = ${article.id};
          `;
          updatedCount++;
        }
      } catch (err) {
        console.error(`[Backfill] Failed for article ${article.id}:`, err);
        failedCount++;
      }
    }

    return {
      processedCount: missingArticles.length,
      updatedCount,
      failedCount,
    };
  } catch (err) {
    console.error('[Backfill] Error running backfill:', err);
    return { processedCount: 0, updatedCount: 0, failedCount: 0 };
  }
}
