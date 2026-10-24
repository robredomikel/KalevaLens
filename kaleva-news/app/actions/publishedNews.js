'use server';

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

/**
 * Create a new user publication / story submission.
 */
export async function createPublishedStory({ userId, title, summary, content, community, category }) {
  if (!userId || !title || !content || !community) {
    return { success: false, error: 'Missing required fields for publication.' };
  }

  try {
    const result = await sql`
      INSERT INTO "StorySubmission" (
        title, 
        summary, 
        content, 
        community, 
        category, 
        "authorId", 
        stage, 
        "createdAt"
      )
      VALUES (
        ${title}, 
        ARRAY[${summary}], 
        ${content}, 
        ${community}, 
        ${category || 'Community Post'}, 
        ${userId}, 
        'PENDING', 
        NOW()
      )
      RETURNING id, title, stage, "createdAt";
    `;

    return { success: true, story: result[0] };
  } catch (error) {
    console.error('Error creating publication:', error);
    return { success: false, error: error.message };
  }
}

/**
 * List all stories published by a specific user.
 */
export async function getPublishedStoriesByUser(userId) {
  if (!userId) return [];

  try {
    const stories = await sql`
      SELECT 
        id, 
        title, 
        summary, 
        content, 
        category, 
        stage, 
        "createdAt",
        community
      FROM "StorySubmission"
      WHERE "authorId" = ${userId} OR "userId" = ${userId}
      ORDER BY "createdAt" DESC;
    `;
    return stories;
  } catch (error) {
    console.error('Error fetching user publications:', error);
    return [];
  }
}
