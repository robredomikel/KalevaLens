'use server';

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

/**
 * Fetch all moderation stories grouped into 4 Kanban stages
 */
export async function getAllModerationStories() {
  try {
    const stories = await sql`
      SELECT 
        id, 
        title, 
        summary, 
        content, 
        community, 
        category, 
        "authorId", 
        stage, 
        "createdAt"
      FROM "StorySubmission"
      ORDER BY "createdAt" DESC;
    `;
    
    const grouped = {
      PENDING: stories.filter(s => s.stage === 'PENDING' || !s.stage),
      IN_PROGRESS: stories.filter(s => s.stage === 'IN_PROGRESS'),
      VERIFIED: stories.filter(s => s.stage === 'VERIFIED'),
      REJECTED: stories.filter(s => s.stage === 'REJECTED')
    };

    return { success: true, stories, grouped };
  } catch (error) {
    console.error('Error fetching all moderation stories:', error);
    return { success: false, error: error.message, grouped: { PENDING: [], IN_PROGRESS: [], VERIFIED: [], REJECTED: [] } };
  }
}

/**
 * Move story stage (e.g. to IN_PROGRESS, VERIFIED, or REJECTED)
 */
export async function updateStoryStage(storyId, newStage) {
  if (!storyId || !newStage) {
    return { success: false, error: 'Story ID and target stage are required.' };
  }

  try {
    const updated = await sql`
      UPDATE "StorySubmission"
      SET stage = ${newStage.toUpperCase()}
      WHERE id = ${storyId}
      RETURNING id, title, stage;
    `;

    if (updated.length === 0) {
      return { success: false, error: 'Story submission not found.' };
    }

    return { success: true, story: updated[0] };
  } catch (error) {
    console.error(`Error updating story stage to ${newStage}:`, error);
    return { success: false, error: error.message };
  }
}
