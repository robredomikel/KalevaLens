'use server';

import { neon } from '@neondatabase/serverless';
import { fetchAndAutoPublishAllRSS } from '@/app/actions/news';
import { applyUserPreferences } from '@/lib/preferences/feed';

const sql = neon(process.env.DATABASE_URL);

/**
 * Fetches priority news feed (unseen first, seen as fallback) with pagination.
 */
export async function getPersonalizedFeed(userId, limit = 10, offset = 0) {
  await fetchAndAutoPublishAllRSS();

  try {
    const parsedLimit = parseInt(limit, 10) || 10;
    const parsedOffset = parseInt(offset, 10) || 0;

    if (!userId) {
      const feed = await sql`
        SELECT id, title, summary, content, community, category, "authorId", stage, priority, "createdAt", "updatedAt", "canonicalId", "articleVersion", "sourceUrl"
        FROM "StorySubmission" 
        WHERE stage = 'PUBLISHED' 
        ORDER BY "createdAt" DESC
        LIMIT ${parsedLimit} OFFSET ${parsedOffset};
      `;
      return applyUserPreferences(feed, userId);
    }

    const feed = await sql`
      WITH RankedStories AS (
        SELECT s.id, s.title, s.summary, s.content, s.community, s.category, s."authorId", s.stage, s.priority, s."createdAt", s."updatedAt", s."canonicalId", s."articleVersion", s."sourceUrl",
          CASE 
            WHEN s.id IN (SELECT "storyId" FROM "UserReadHistory" WHERE "userId" = ${userId}) THEN 2 
            ELSE 1 
          END as read_priority
        FROM "StorySubmission" s
        WHERE s.stage = 'PUBLISHED'
      )
      SELECT id, title, summary, content, community, category, "authorId", stage, priority, "createdAt", "updatedAt", "canonicalId", "articleVersion", "sourceUrl"
      FROM RankedStories
      ORDER BY read_priority ASC, "createdAt" DESC
      LIMIT ${parsedLimit} OFFSET ${parsedOffset};
    `;

    return applyUserPreferences(feed, userId);
  } catch (error) {
    console.error('Error fetching feed:', error);
    return [];
  }
}
