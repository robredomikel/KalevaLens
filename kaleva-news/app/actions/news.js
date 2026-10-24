'use server';

import { sql } from '@/lib/neon';
import { randomUUID } from 'crypto';
import { fetchAndAutoPublishRSS } from '@/lib/rss';
import { ensureDatabaseSchema } from '@/lib/db/init';
import { editorialWorkflowApp } from '@/lib/ai/workflows/editorial';
import { runPersonalizationAgent } from '@/lib/ai/agents/personalization';
import { runIngestionAgent } from '@/lib/ai/agents/ingestion';

/**
 * Fetches the news feed with priority given to unseen articles,
 * followed by seen articles as a fallback. Automatically syncs RSS on call.
 */
export async function getPriorityNewsFeed(userId, limit = 10, offset = 0) {
  await ensureDatabaseSchema();
  await fetchAndAutoPublishRSS();

  try {
    if (!userId) {
      return await sql`
        SELECT id, title, summary, content, community, category, "authorId", stage, priority, "aiScore", "createdAt", "updatedAt"
        FROM "StorySubmission" 
        WHERE stage = 'PUBLISHED' 
        ORDER BY "createdAt" DESC
        LIMIT ${limit} OFFSET ${offset};
      `;
    }

    const priorityFeed = await sql`
      WITH RankedStories AS (
        SELECT s.id, s.title, s.summary, s.content, s.community, s.category, s."authorId", s.stage, s.priority, s."aiScore", s."createdAt", s."updatedAt",
          CASE 
            WHEN s.id IN (SELECT "storyId" FROM "UserReadHistory" WHERE "userId" = ${userId}) THEN 2 
            ELSE 1 
          END as read_priority
        FROM "StorySubmission" s
        WHERE s.stage = 'PUBLISHED'
      )
      SELECT id, title, summary, content, community, category, "authorId", stage, priority, "aiScore", "createdAt", "updatedAt"
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
 * Trigger Gemini-powered multi-agent editorial workflow using LangGraph
 */
export async function triggerEditorialWorkflow(customCandidate = null) {
  await ensureDatabaseSchema();
  const workflowId = randomUUID();

  try {
    let candidate = customCandidate;
    if (!candidate) {
      const candidates = await runIngestionAgent();
      candidate = candidates[0] || null;
    }

    if (!candidate) {
      return { success: false, message: 'No new news candidates found for ingestion.' };
    }

    const initialState = {
      workflowId,
      candidate,
      status: 'IN_PROGRESS',
      executionLogs: [],
    };

    const finalState = await editorialWorkflowApp.invoke(initialState, {
      configurable: { thread_id: workflowId },
    });

    return {
      success: true,
      workflowId,
      status: finalState.status,
      publishedStoryId: finalState.publishedStoryId,
      draft: finalState.draft,
    };
  } catch (error) {
    console.error('Error triggering editorial workflow:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get pending tasks and submissions for the Moderator Kanban
 */
export async function getPendingEditorialTasks() {
  await ensureDatabaseSchema();

  try {
    const submissions = await sql`
      SELECT id, title, summary, content, community, category, "authorId", stage, priority, "aiScore", "verificationReport", "createdAt"
      FROM "StorySubmission"
      ORDER BY "createdAt" DESC;
    `;

    const tasks = await sql`
      SELECT id, "workflowId", "storyId", "taskType", status, details, "createdAt"
      FROM "EditorialTask"
      WHERE status = 'PENDING'
      ORDER BY "createdAt" DESC;
    `;

    return { success: true, submissions, tasks };
  } catch (error) {
    console.error('Error fetching moderator tasks:', error);
    return { success: false, submissions: [], tasks: [], error: error.message };
  }
}

/**
 * Submit human editorial decision for HITL checkpoints
 */
export async function submitModeratorDecision({
  taskId,
  storyId,
  decision, // 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES'
  notes = '',
  moderatorId = 'MOD-07',
}) {
  await ensureDatabaseSchema();

  try {
    const newStage = decision === 'APPROVE' ? 'PUBLISHED' : decision === 'REJECT' ? 'REJECTED' : 'REVIEW';

    // 1. Update StorySubmission in database
    await sql`
      UPDATE "StorySubmission"
      SET stage = ${newStage}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${storyId};
    `;

    // 2. Update EditorialTask if taskId supplied
    if (taskId) {
      await sql`
        UPDATE "EditorialTask"
        SET status = ${decision}, "decisionNotes" = ${notes}, "moderatorId" = ${moderatorId}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = ${taskId};
      `;
    }

    // 3. Resume LangGraph Workflow if thread exists
    try {
      const taskRows = await sql`
        SELECT "workflowId" FROM "EditorialTask" WHERE id = ${taskId} LIMIT 1;
      `;
      if (taskRows.length > 0) {
        const workflowId = taskRows[0].workflowId;
        await editorialWorkflowApp.invoke(
          { hitl2Decision: decision, hitl2Notes: notes },
          { configurable: { thread_id: workflowId } }
        );
      }
    } catch (resumeErr) {
      console.log('LangGraph thread resume note:', resumeErr);
    }

    return { success: true, newStage };
  } catch (error) {
    console.error('Error submitting moderator decision:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get personalized news feed using Gemini Personalization Agent
 */
export async function getPersonalizedNewsFeed(userPrefs) {
  await ensureDatabaseSchema();
  const rawArticles = await getPriorityNewsFeed(userPrefs?.userId);

  if (!rawArticles || rawArticles.length === 0) return [];

  try {
    const formattedForAgent = rawArticles.map((a) => ({
      id: a.id,
      title: a.title,
      category: a.category || 'Local News',
      community: a.community || 'Oulu Tech Hub',
      summary: a.summary,
    }));

    const rankings = await runPersonalizationAgent(userPrefs, formattedForAgent);

    const rankingMap = new Map(rankings.map((r) => [r.storyId, r.relevanceScore]));

    return [...rawArticles].sort((a, b) => {
      const scoreA = rankingMap.get(a.id) ?? 50;
      const scoreB = rankingMap.get(b.id) ?? 50;
      return scoreB - scoreA;
    });
  } catch (err) {
    console.error('Personalization error, returning priority feed:', err);
    return rawArticles;
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

