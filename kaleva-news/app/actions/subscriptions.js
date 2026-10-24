'use server';

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

/**
 * Get all communities a user is currently actively subscribed to.
 */
export async function getUserSubscribedCommunities(userId) {
  try {
    const subscriptions = await sql`
      SELECT c.id, c.name 
      FROM "UserCommunitySubscription" ucs
      JOIN "Community" c ON ucs."communityId" = c.id
      WHERE ucs."userId" = ${userId} AND ucs."isActive" = TRUE
      ORDER BY c.name ASC;
    `;
    return subscriptions;
  } catch (error) {
    console.error('Error fetching user subscriptions:', error);
    return [];
  }
}

/**
 * Upsert subscription: Subscribe (activates) or Unsubscribe (sets isActive = false)
 */
export async function toggleUserSubscription(userId, communityName, subscribe = true) {
  if (!userId || !communityName) {
    return { success: false, error: 'Missing userId or communityName' };
  }

  try {
    console.log("Subscribe------.......",subscribe)
    // 1. Get community id from name
    const community = await sql`
      SELECT id FROM "Community" WHERE name = ${communityName};
    `;

    if (community.length === 0) {
      return { success: false, error: 'Community not found' };
    }

    const communityId = community[0].id;

    // 2. Upsert the mapping record and set isActive accordingly
    await sql`
      INSERT INTO "UserCommunitySubscription" ("userId", "communityId", "isActive", "updatedAt")
      VALUES (${userId}, ${communityId}, ${subscribe}, NOW())
      ON CONFLICT ("userId", "communityId") 
      DO UPDATE SET "isActive" = ${subscribe}, "updatedAt" = NOW();
    `;

    return { success: true, subscribed: subscribe };
  } catch (error) {
    console.error('Error toggling user subscription:', error);
    return { success: false, error: error.message };
  }
}
