'use server';

import { neon } from '@neondatabase/serverless';
import { fetchAndAutoPublishAllRSS } from '@/app/actions/news';
import { applyUserPreferences } from '@/lib/preferences/feed';

const sql = neon(process.env.DATABASE_URL);

export async function getBlendedOutsidePriorityFeed(userId, limit = 10, offset = 0) {
  await fetchAndAutoPublishAllRSS();

  const parsedLimit = parseInt(limit, 10) || 10;
  const parsedOffset = parseInt(offset, 10) || 0;

  const localLimit = Math.round(parsedLimit * 0.5);
  const outsideLimit = parsedLimit - localLimit;

  const localOffset = Math.round(parsedOffset * 0.5);
  const outsideOffset = parsedOffset - localOffset;

  try {
    // If no user ID is provided, skip read history ranking entirely to avoid type errors
    if (!userId) {
      const feed = await sql`
        WITH CombinedOutsideFeed AS (
          (
            SELECT id, title, summary, content, community, category, "authorId", stage, priority, "createdAt", "updatedAt", "sourceType", "sourceUrl", "sourceGuid", "canonicalId", "articleVersion", "sourceId", "imageUrl", "contentAccessLevel", "licensingRules", 1 as read_priority
            FROM "StorySubmission"
            WHERE stage = 'PUBLISHED' AND ("sourceType" = 'KALEVA_RSS' OR "sourceType" IS NULL)
            ORDER BY "createdAt" DESC
            LIMIT ${localLimit} OFFSET ${localOffset}
          )
          UNION ALL
          (
            SELECT id, title, summary, content, community, category, "authorId", stage, priority, "createdAt", "updatedAt", "sourceType", "sourceUrl", "sourceGuid", "canonicalId", "articleVersion", "sourceId", "imageUrl", "contentAccessLevel", "licensingRules", 1 as read_priority
            FROM "StorySubmission"
            WHERE stage = 'PUBLISHED' AND ("sourceType" != 'KALEVA_RSS' AND "sourceType" IS NOT NULL)
            ORDER BY "createdAt" DESC
            LIMIT ${outsideLimit} OFFSET ${outsideOffset}
          )
        )
        SELECT * FROM CombinedOutsideFeed ORDER BY "createdAt" DESC;
      `;
      return applyUserPreferences(feed, userId);
    }

    // Query with explicit read history ranking using validated userId
    const blendedFeed = await sql`
      WITH CombinedOutsideFeed AS (
        -- Part 1: Local Kaleva proportion in Outside tab
        (
          SELECT s.id, s.title, s.summary, s.content, s.community, s.category, s."authorId", s.stage, s.priority, s."createdAt", s."updatedAt", s."sourceType", s."sourceUrl", s."sourceGuid", s."canonicalId", s."articleVersion", s."sourceId", s."imageUrl", s."contentAccessLevel", s."licensingRules",
            CASE 
              WHEN s.id IN (SELECT "storyId" FROM "UserReadHistory" WHERE "userId" = ${userId}) THEN 2 
              ELSE 1 
            END as read_priority
          FROM "StorySubmission" s
          WHERE s.stage = 'PUBLISHED' AND (s."sourceType" = 'KALEVA_RSS' OR s."sourceType" IS NULL)
          ORDER BY read_priority ASC, s."createdAt" DESC
          LIMIT ${localLimit} OFFSET ${localOffset}
        )
        UNION ALL
        -- Part 2: Outside Sources proportion (Finnish & International RSS)
        (
          SELECT s.id, s.title, s.summary, s.content, s.community, s.category, s."authorId", s.stage, s.priority, s."createdAt", s."updatedAt", s."sourceType", s."sourceUrl", s."sourceGuid", s."canonicalId", s."articleVersion", s."sourceId", s."imageUrl", s."contentAccessLevel", s."licensingRules",
            CASE 
              WHEN s.id IN (SELECT "storyId" FROM "UserReadHistory" WHERE "userId" = ${userId}) THEN 2 
              ELSE 1 
            END as read_priority
          FROM "StorySubmission" s
          WHERE s.stage = 'PUBLISHED' AND (s."sourceType" != 'KALEVA_RSS' AND s."sourceType" IS NOT NULL)
          ORDER BY read_priority ASC, s."createdAt" DESC
          LIMIT ${outsideLimit} OFFSET ${outsideOffset}
        )
      )
      SELECT id, title, summary, content, community, category, "authorId", stage, priority, "createdAt", "updatedAt", "sourceType", "sourceUrl", "sourceGuid", "canonicalId", "articleVersion", "sourceId", "imageUrl", "contentAccessLevel", "licensingRules"
      FROM CombinedOutsideFeed
      ORDER BY read_priority ASC, "createdAt" DESC;
    `;

    return applyUserPreferences(blendedFeed, userId);
  } catch (error) {
    console.error('Error fetching blended outside priority feed:', error);
    return [];
  }
}
