'use server';

import { neon } from '@neondatabase/serverless';
import { fetchAndAutoPublishAllRSS } from '@/app/actions/news';
import { applyUserPreferences } from '@/lib/preferences/feed';

const sql = neon(process.env.DATABASE_URL);

/**
 * Fetches priority news feed (unseen first, seen as fallback) with pagination.
 * Supports both getPersonalizedFeed(userId, limit, offset) and
 * getPersonalizedFeed(userId, subscribedCommunities, limit, offset).
 */
export async function getPersonalizedFeed(userId, communitiesOrLimit = 10, limitOrOffset = 10, rawOffset = 0) {
  await fetchAndAutoPublishAllRSS();

  let subscribedCommunities = null;
  let limit = 10;
  let offset = 0;

  if (Array.isArray(communitiesOrLimit)) {
    subscribedCommunities = communitiesOrLimit;
    limit = parseInt(limitOrOffset, 10) || 10;
    offset = parseInt(rawOffset, 10) || 0;
  } else {
    limit = parseInt(communitiesOrLimit, 10) || 10;
    offset = parseInt(limitOrOffset, 10) || 0;
  }

  try {
    const parsedLimit = limit;
    const parsedOffset = offset;

    let feed;
    if (!userId) {
      if (subscribedCommunities && subscribedCommunities.length > 0) {
        feed = await sql`
          SELECT id, title, summary, content, community, category, "authorId", stage, priority, "createdAt", "updatedAt", "canonicalId", "articleVersion", "sourceUrl"
          FROM "StorySubmission" 
          WHERE stage = 'PUBLISHED' AND (community = ANY(${subscribedCommunities}) OR community = 'Oulu' OR community = 'Kaleva' OR community IS NULL)
          ORDER BY "createdAt" DESC
          LIMIT ${parsedLimit} OFFSET ${parsedOffset};
        `;
      } else {
        feed = await sql`
          SELECT id, title, summary, content, community, category, "authorId", stage, priority, "createdAt", "updatedAt", "canonicalId", "articleVersion", "sourceUrl"
          FROM "StorySubmission" 
          WHERE stage = 'PUBLISHED' 
          ORDER BY "createdAt" DESC
          LIMIT ${parsedLimit} OFFSET ${parsedOffset};
        `;
      }
      return applyUserPreferences(feed, userId);
    }

    if (subscribedCommunities && subscribedCommunities.length > 0) {
      feed = await sql`
        WITH RankedStories AS (
          SELECT s.id, s.title, s.summary, s.content, s.community, s.category, s."authorId", s.stage, s.priority, s."createdAt", s."updatedAt", s."canonicalId", s."articleVersion", s."sourceUrl",
            CASE 
              WHEN s.id IN (SELECT "storyId" FROM "UserReadHistory" WHERE "userId" = ${userId}) THEN 2 
              ELSE 1 
            END as read_priority
          FROM "StorySubmission" s
          WHERE s.stage = 'PUBLISHED' AND (s.community = ANY(${subscribedCommunities}) OR s.community = 'Oulu' OR s.community = 'Kaleva' OR s.community IS NULL)
        )
        SELECT id, title, summary, content, community, category, "authorId", stage, priority, "createdAt", "updatedAt", "canonicalId", "articleVersion", "sourceUrl"
        FROM RankedStories
        ORDER BY read_priority ASC, "createdAt" DESC
        LIMIT ${parsedLimit} OFFSET ${parsedOffset};
      `;
    } else {
      feed = await sql`
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
    }

    return applyUserPreferences(feed, userId);
  } catch (error) {
    console.error('Error fetching feed:', error);
    return [];
  }
}
