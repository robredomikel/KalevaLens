'use server';

import { neon } from '@neondatabase/serverless';
import RSSParser from 'rss-parser';

const sql = neon(process.env.DATABASE_URL);
const parser = new RSSParser();

const KALEVA_RSS_URL = 'https://www.kaleva.fi/feedit/rss/managed-listing/rss-maksuttomat/';
const OUTSIDE_RSS_URLS = ['https://yle.fi/rss/uutiset/osasto/news/tag/oulu'];

// RSS Ingestion Helpers
export async function fetchAndAutoPublishAllRSS() {
  try {
    // 1. Sync Kaleva
    const kalevaFeed = await parser.parseURL(KALEVA_RSS_URL);
    for (const item of kalevaFeed.items) {
      const existing = await sql`SELECT id FROM "StorySubmission" WHERE title = ${item.title} LIMIT 1;`;
      if (existing.length === 0) {
        await sql`
          INSERT INTO "StorySubmission" (title, summary, content, community, category, "authorId", stage, priority, "sourceType")
          VALUES (${item.title || 'Untitled'}, ${item.contentSnippet || item.summary || item.title || ''}, ${item.content || item.link || ''}, 'Oulu', 'Kaleva RSS', 'rss-system', 'PUBLISHED', 0, 'KALEVA_RSS');
        `;
      }
    }

    // 2. Sync Outside Sources
    for (const url of OUTSIDE_RSS_URLS) {
      const outsideFeed = await parser.parseURL(url);
      for (const item of outsideFeed.items) {
        const existing = await sql`SELECT id FROM "StorySubmission" WHERE title = ${item.title} LIMIT 1;`;
        if (existing.length === 0) {
          await sql`
            INSERT INTO "StorySubmission" (title, summary, content, community, category, "authorId", stage, priority, "sourceType")
            VALUES (${item.title || 'Untitled'}, ${item.contentSnippet || item.summary || item.title || ''}, ${item.content || item.link || ''}, 'Northern Finland', 'Outside Source', 'outside-system', 'PUBLISHED', 0, 'OUTSIDE');
          `;
        }
      }
    }
  } catch (error) {
    console.error('Error syncing RSS feeds:', error);
  }
}

/**
 * Blended Ratio Feed: Combines local Kaleva and outside sources (e.g. 70/30 ratio)
 * with unseen-first priority ranking and pagination.
 */
export async function getBlendedNewsFeed(userId, limit = 10, offset = 0) {
  await fetchAndAutoPublishAllRSS();

  const localLimit = Math.round(limit * 0.7);
  const outsideLimit = limit - localLimit;
  const localOffset = Math.round(offset * 0.7);
  const outsideOffset = offset - localOffset;

  try {
    if (!userId) {
      return await sql`
        WITH Combined AS (
          (SELECT * FROM "StorySubmission" WHERE stage = 'PUBLISHED' AND ("sourceType" = 'KALEVA_RSS' OR "sourceType" IS NULL) ORDER BY "createdAt" DESC LIMIT ${localLimit} OFFSET ${localOffset})
          UNION ALL
          (SELECT * FROM "StorySubmission" WHERE stage = 'PUBLISHED' AND "sourceType" = 'OUTSIDE' ORDER BY "createdAt" DESC LIMIT ${outsideLimit} OFFSET ${outsideOffset})
        )
        SELECT * FROM Combined ORDER BY "createdAt" DESC;
      `;
    }

    const blendedFeed = await sql`
      WITH RankedCombined AS (
        SELECT s.*,
          CASE 
            WHEN s.id IN (SELECT "storyId" FROM "UserReadHistory" WHERE "userId" = ${userId}) THEN 2 
            ELSE 1 
          END as read_priority
        FROM "StorySubmission" s
        WHERE s.stage = 'PUBLISHED'
      ),
      RatioBlend AS (
        (SELECT * FROM RankedCombined WHERE ("sourceType" = 'KALEVA_RSS' OR "sourceType" IS NULL) ORDER BY read_priority ASC, "createdAt" DESC LIMIT ${localLimit} OFFSET ${localOffset})
        UNION ALL
        (SELECT * FROM RankedCombined WHERE "sourceType" = 'OUTSIDE' ORDER BY read_priority ASC, "createdAt" DESC LIMIT ${outsideLimit} OFFSET ${outsideOffset})
      )
      SELECT id, title, summary, content, community, category, "authorId", stage, priority, "createdAt", "updatedAt", "sourceType"
      FROM RatioBlend
      ORDER BY read_priority ASC, "createdAt" DESC;
    `;

    return blendedFeed;
  } catch (error) {
    console.error('Error fetching blended news feed:', error);
    return [];
  }
}

/**
 * Marks a story as read.
 */
export async function markStoryAsRead(userId, storyId) {
  if (!userId || !storyId) return { success: false, error: 'Missing userId or storyId' };

  try {
    await sql`
      INSERT INTO "UserReadHistory" ("userId", "storyId")
      VALUES (${userId}, ${storyId})
      ON CONFLICT ("userId", "storyId") DO NOTHING;
    `;
    return { success: true };
  } catch (error) {
    console.error('Error marking story as read:', error);
    return { success: false, error: error.message };
  }
}
