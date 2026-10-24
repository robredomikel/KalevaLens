'use server';

import { neon } from '@neondatabase/serverless';
import { fetchAndAutoPublishAllRSS } from '@/app/actions/news';
import { applyUserPreferences } from '@/lib/preferences/feed';

const sql = neon(process.env.DATABASE_URL);
const CURRENT_USER_ID = "current-user-id";

/**
 * Fetches all available communities from the database
 */
export async function getCommunitiesList() {
  try {
    const communities = await sql`
      SELECT id, name FROM "Community" ORDER BY name ASC;
    `;
    return communities;
  } catch (error) {
    console.error('Error fetching communities list:', error);
    // Fallback list if table isn't queried successfully
    return [
      { id: 1, name: 'Indian' },
      { id: 2, name: 'Spanish' },
      { id: 3, name: 'Food' },
      { id: 4, name: 'PhD Researcher in Oulu' },
      { id: 5, name: 'Tech Jobs' }
    ];
  }
}

/**
 * Fetches stories for a specific community, split by verified (PUBLISHED) vs unverified (PENDING)
 */
export async function getCommunityFeed(communityName, isVerified = true, limit = 10, offset = 0) {
  await fetchAndAutoPublishAllRSS();

  const parsedLimit = parseInt(limit, 10) || 10;
  const parsedOffset = parseInt(offset, 10) || 0;
  // verified = PUBLISHED, unverified = PENDING
  const targetStage = isVerified ? 'PUBLISHED' : 'PENDING';

  try {
    const feed = await sql`
      WITH RankedStories AS (
        SELECT s.id, s.title, s.summary, s.content, s.community, s.category, s."authorId", s.stage, s.priority, s."createdAt", s."updatedAt", s."sourceType", s."sourceUrl", s."sourceGuid", s."canonicalId", s."articleVersion", s."sourceId", s."imageUrl", s."contentAccessLevel", s."licensingRules",
          CASE 
            WHEN s.id IN (SELECT "storyId" FROM "UserReadHistory" WHERE "userId" = ${CURRENT_USER_ID}) THEN 2 
            ELSE 1 
          END as read_priority
        FROM "StorySubmission" s
        WHERE s.community = ${communityName} AND s.stage = ${targetStage}
      )
      SELECT id, title, summary, content, community, category, "authorId", stage, priority, "createdAt", "updatedAt", "sourceType", "sourceUrl", "sourceGuid", "canonicalId", "articleVersion", "sourceId", "imageUrl", "contentAccessLevel", "licensingRules"
      FROM RankedStories
      ORDER BY read_priority ASC, "createdAt" DESC
      LIMIT ${parsedLimit} OFFSET ${parsedOffset};
    `;

    return applyUserPreferences(feed, CURRENT_USER_ID);
  } catch (error) {
    console.error(`Error fetching community feed for ${communityName}:`, error);
    return [];
  }
}

/**
 * Submits a new citizen scoop/story to a community as unverified (PENDING)
 */
export async function submitToCommunity({ title, summary, content, community, category }) {
  if (!title || !community) {
    return { success: false, error: 'Title and Community are required' };
  }

  try {
    const result = await sql`
      INSERT INTO "StorySubmission" (title, summary, content, community, category, "authorId", stage, priority, "sourceType")
      VALUES (${title}, ${summary || ''}, ${content || ''}, ${community}, ${category || 'Community Post'}, ${CURRENT_USER_ID}, 'PENDING', 0, 'COMMUNITY')
      RETURNING id;
    `;
    return { success: true, storyId: result[0].id };
  } catch (error) {
    console.error('Error submitting story to community:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Moderator action to verify/publish a community story (moves PENDING -> PUBLISHED)
 */
export async function verifyCommunityStory(storyId) {
  try {
    await sql`
      UPDATE "StorySubmission"
      SET stage = 'PUBLISHED', "updatedAt" = NOW()
      WHERE id = ${storyId};
    `;
    return { success: true };
  } catch (error) {
    console.error('Error verifying story:', error);
    return { success: false, error: error.message };
  }
}
