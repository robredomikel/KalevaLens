'use server';

import { neon } from '@neondatabase/serverless';
import { fetchAndAutoPublishAllRSS } from '@/app/actions/news';

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
      return await sql`
        SELECT id, title, summary, content, community, category, "authorId", stage, priority, "createdAt", "updatedAt"
        FROM "StorySubmission" 
        WHERE stage = 'PUBLISHED' 
        ORDER BY "createdAt" DESC
        LIMIT ${parsedLimit} OFFSET ${parsedOffset};
      `;
    }

    const feed = await sql`
      WITH RankedStories AS (
        SELECT s.id, s.title, s.summary, s.content, s.community, s.category, s."authorId", s.stage, s.priority, s."createdAt", s."updatedAt",
          CASE 
            WHEN s.id IN (SELECT "storyId" FROM "UserReadHistory" WHERE "userId" = ${userId}) THEN 2 
            ELSE 1 
          END as read_priority
        FROM "StorySubmission" s
        WHERE s.stage = 'PUBLISHED'
      )
      SELECT id, title, summary, content, community, category, "authorId", stage, priority, "createdAt", "updatedAt"
      FROM RankedStories
      ORDER BY read_priority ASC, "createdAt" DESC
      LIMIT ${parsedLimit} OFFSET ${parsedOffset};
    `;

    return feed;
  } catch (error) {
    console.error('Error fetching feed:', error);
    return [];
  }
}
