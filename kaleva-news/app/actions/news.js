'use server';

import { randomUUID } from 'crypto';
import { neon } from '@neondatabase/serverless';
import { ensureDatabaseSchema } from '@/lib/db/init';
import { runIngestionAgent } from '@/lib/ai/agents/ingestion';
import { runPersonalizationAgent } from '@/lib/ai/agents/personalization';
import { editorialWorkflowApp } from '@/lib/ai/workflows/editorial';
import { enqueueArticleMedia, attachMedia } from '@/lib/media/repository';
import { applyUserPreferences } from '@/lib/preferences/feed';
import { ingestAllRSSFeeds } from '@/lib/news/ingestion';

const sql = neon(process.env.DATABASE_URL);

// RSS Ingestion Helpers
export async function fetchAndAutoPublishAllRSS(force = false) {
  return await ingestAllRSSFeeds(force);
}

/**
 * Blended Ratio Feed: Combines local Kaleva and outside sources (e.g. 70/30 ratio)
 * with unseen-first priority ranking and pagination.
 */
export async function getBlendedNewsFeed(userId, limit = 10, offset = 0) {
  await fetchAndAutoPublishAllRSS();

  const localLimit = Math.round(limit * 0.7);
  const outsideLimit = limit - localLimit;
  const localOffset = Math.round(offset * 0.7);
  const outsideOffset = offset - localOffset;

  try {
    if (!userId) {
      const feed = await sql`
        WITH Combined AS (
          (SELECT * FROM "StorySubmission" WHERE stage = 'PUBLISHED' AND ("sourceType" = 'KALEVA_RSS' OR "sourceType" IS NULL) ORDER BY "createdAt" DESC LIMIT ${localLimit} OFFSET ${localOffset})
          UNION ALL
          (SELECT * FROM "StorySubmission" WHERE stage = 'PUBLISHED' AND "sourceType" = 'OUTSIDE' ORDER BY "createdAt" DESC LIMIT ${outsideLimit} OFFSET ${outsideOffset})
        )
        SELECT * FROM Combined ORDER BY "createdAt" DESC;
      `;
      return applyUserPreferences(feed, userId);
    }

    const blendedFeed = await sql`
      WITH RankedCombined AS (
        SELECT s.*,
          CASE 
            WHEN s.id IN (SELECT "storyId" FROM "UserReadHistory" WHERE "userId" = ${userId}) THEN 2 
            ELSE 1 
          END as read_priority
        FROM "StorySubmission" s
        WHERE s.stage = 'PUBLISHED'
      ),
      RatioBlend AS (
        (SELECT * FROM RankedCombined WHERE ("sourceType" = 'KALEVA_RSS' OR "sourceType" IS NULL) ORDER BY read_priority ASC, "createdAt" DESC LIMIT ${localLimit} OFFSET ${localOffset})
        UNION ALL
        (SELECT * FROM RankedCombined WHERE "sourceType" = 'OUTSIDE' ORDER BY read_priority ASC, "createdAt" DESC LIMIT ${outsideLimit} OFFSET ${outsideOffset})
      )
      SELECT id, title, summary, content, community, category, "authorId", stage, priority, "createdAt", "updatedAt", "sourceType", "canonicalId", "articleVersion", "sourceUrl", "imageUrl", "contentAccessLevel", "licensingRules"
      FROM RatioBlend
      ORDER BY read_priority ASC, "createdAt" DESC;
    `;

    return applyUserPreferences(blendedFeed, userId);
  } catch (error) {
    console.error('Error fetching blended news feed:', error);
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
      SELECT id, title, summary, content, community, category, "authorId", stage, priority, "aiScore", "verificationReport", "createdAt", "imageUrl", "sourceUrl"
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
    const taskRows = taskId ? await sql`SELECT "workflowId", "taskType", details FROM "EditorialTask" WHERE id=${taskId} LIMIT 1;` : [];
    const newStage = decision === 'APPROVE' ? 'PUBLISHED' : decision === 'REJECT' ? 'REJECTED' : 'REVIEW';

    // 1. Update StorySubmission in database
    await sql`
      UPDATE "StorySubmission"
      SET stage = ${newStage}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${storyId};
    `;
    if (decision === 'APPROVE') {
      const audioLanguage = taskRows[0]?.taskType === 'HITL_MEDIA_AUDIT' ? taskRows[0]?.details?.language || 'en' : 'en';
      await enqueueArticleMedia(storyId, audioLanguage, 20);
    }

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
  const rawArticles = await getBlendedNewsFeed(userPrefs?.userId, 20, 0);

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

    return attachMedia([...rawArticles].sort((a, b) => {
      const scoreA = rankingMap.get(a.id) ?? 50;
      const scoreB = rankingMap.get(b.id) ?? 50;
      return scoreB - scoreA;
    }));
  } catch (err) {
    console.error('Personalization error, returning priority feed:', err);
    return attachMedia(rawArticles);
  }
}

/**
 * Retrieves a single article by ID from the database or mock data fallback.
 */
export async function getArticleById(articleId) {
  await ensureDatabaseSchema();

  try {
    // 1. Query database for StorySubmission
    const dbStories = await sql`
      SELECT id, title, summary, content, community, category, "authorId", stage, priority, "aiScore", "createdAt", "updatedAt", "canonicalId", "articleVersion", "sourceUrl", "imageUrl", "contentAccessLevel", "licensingRules"
      FROM "StorySubmission"
      WHERE id = ${articleId} LIMIT 1;
    `;

    if (dbStories.length > 0) {
      const story = dbStories[0];
      const translations = await sql`
        SELECT language, title, summary, content FROM "ArticleTranslation" WHERE "storyId" = ${articleId};
      `;
      const contextRows = await sql`
        SELECT "explanationType", explanation FROM "ArticleContext" WHERE "storyId" = ${articleId} LIMIT 1;
      `;

      return {
        success: true,
        article: {
          id: story.id,
          title: story.title,
          summary: story.summary ? story.summary.split('\n• ').filter(Boolean) : [story.title],
          content: story.content || story.summary,
          community: story.community || 'Oulu',
          category: story.category || 'Verified News',
          author: story.authorId || 'Kaleva Editorial',
          createdAt: story.createdAt,
          imageUrl: story.imageUrl || null,
          sourceUrl: story.sourceUrl || null,
          translations: translations || [],
          contextualExplanation: contextRows[0]?.explanation || null,
          media: (await attachMedia([story]))[0]?.media || {},
        },
      };
    }
  } catch (err) {
    console.error('Error fetching article from DB:', err);
  }

  // 2. Search mock data fallback
  try {
    const { mockSectionsData } = await import('@/data/mockNews');
    const allMockArticles = [];

    if (mockSectionsData.outside) allMockArticles.push(...mockSectionsData.outside);
    if (mockSectionsData['my-news']) allMockArticles.push(...mockSectionsData['my-news']);
    if (mockSectionsData.communities) {
      Object.values(mockSectionsData.communities).forEach((commObj) => {
        if (commObj.verified) allMockArticles.push(...commObj.verified);
        if (commObj.unverified) allMockArticles.push(...commObj.unverified);
      });
    }

    const foundMock = allMockArticles.find((item) => item.id === articleId);
    if (foundMock) {
      return {
        success: true,
        article: {
          id: foundMock.id,
          title: foundMock.title,
          summary: Array.isArray(foundMock.summary) ? foundMock.summary : [foundMock.summary],
          content: foundMock.content || (Array.isArray(foundMock.summary) ? foundMock.summary.join(' ') : foundMock.summary),
          community: foundMock.community,
          category: foundMock.category,
          author: 'Kaleva Media',
          createdAt: new Date().toISOString(),
          translations: [],
          contextualExplanation: 'This article provides verified news coverage for Northern Finland.',
        },
      };
    }
  } catch (mockErr) {
    console.error('Error importing mock data:', mockErr);
  }

  return { success: false, error: 'Article not found' };
}

/**
 * Queries updated media status for a specific article.
 */
export async function getArticleMediaStatus(articleId, canonicalId, language = 'en') {
  if (!articleId && !canonicalId) return {};
  try {
    const dummyArticle = { id: articleId, canonicalId: canonicalId || articleId };
    const attached = await attachMedia([dummyArticle], language);
    return attached[0]?.media || {};
  } catch (err) {
    console.error('Error checking media status:', err);
    return {};
  }
}

/**
 * Marks a story as read.
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

