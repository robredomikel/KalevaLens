'use server';

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

/**
 * Get all comments for a specific article.
 */
export async function getCommentsForArticle(articleId) {
  if (!articleId) return [];

  try {
    const comments = await sql`
      SELECT 
        id, 
        "articleId", 
        "userId", 
        content, 
        "createdAt"
      FROM "Comment"
      WHERE "articleId" = ${articleId}
      ORDER BY "createdAt" ASC;
    `;
    return comments;
  } catch (error) {
    console.error('Error fetching comments:', error);
    return [];
  }
}

/**
 * Add a new comment to an article.
 */
export async function addComment({ articleId, userId, content }) {
  if (!articleId || !userId || !content || !content.trim()) {
    return { success: false, error: 'Missing required fields for comment.' };
  }

  try {
    const result = await sql`
      INSERT INTO "Comment" (
        "articleId", 
        "userId", 
        content, 
        "createdAt"
      )
      VALUES (
        ${articleId}, 
        ${userId}, 
        ${content.trim()}, 
        NOW()
      )
      RETURNING id, "articleId", "userId", content, "createdAt";
    `;

    return { success: true, comment: result[0] };
  } catch (error) {
    console.error('Error adding comment:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a comment (ensuring it belongs to the requesting user).
 */
export async function deleteComment(commentId, userId) {
  if (!commentId || !userId) {
    return { success: false, error: 'Missing commentId or userId.' };
  }

  try {
    const result = await sql`
      DELETE FROM "Comment"
      WHERE id = ${commentId} AND "userId" = ${userId}
      RETURNING id;
    `;

    if (result.length === 0) {
      return { success: false, error: 'Comment not found or unauthorized to delete.' };
    }

    return { success: true, deletedId: result[0].id };
  } catch (error) {
    console.error('Error deleting comment:', error);
    return { success: false, error: error.message };
  }
}