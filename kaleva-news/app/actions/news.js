'use server';

import { sql } from '@/lib/neon';
import { fetchAndAutoPublishRSS } from '@/lib/rss';

/**
 * Fetches the news feed with priority given to unseen articles,
 * followed by seen articles as a fallback. Automatically syncs RSS on call.
 */
export async function getPriorityNewsFeed(userId, limit = 10, offset = 0) {
  await fetchAndAutoPublishRSS();

  try {
    if (!userId) {
      return await sql`
        SELECT id, title, summary, content, community, category, "authorId", stage, priority, "createdAt", "updatedAt"
        FROM "StorySubmission" 
        WHERE stage = 'PUBLISHED' 
        ORDER BY "createdAt" DESC
        LIMIT ${limit} OFFSET ${offset};
      `;
    }

    const priorityFeed = await sql`
      WITH RankedStories AS (
        SELECT s.id, s.title, s.summary, s.content, s.community, s.category, s."authorId", s.stage, s.priority, s."createdAt", s."updatedAt",
          CASE 
            WHEN s.id IN (SELECT "storyId" FROM "UserReadHistory" WHERE "userId" = ${userId}) THEN 2 
            ELSE 1 
          END as read_priority
        FROM "StorySubmission" s -- or "StorySubmission" depending on your table name
        WHERE s.stage = 'PUBLISHED'
      )
      SELECT id, title, summary, content, community, category, "authorId", stage, priority, "createdAt", "updatedAt"
      FROM RankedStories
      ORDER BY read_priority ASC, "createdAt" DESC
      LIMIT ${limit} OFFSET ${offset};
    `;

    return priorityFeed;
  } catch (error) {
    console.error('Error fetching priority news feed:', error);
    return [];
  }
}


/**
 * Marks a specific story as read by a user so it drops to the seen fallback section.
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
