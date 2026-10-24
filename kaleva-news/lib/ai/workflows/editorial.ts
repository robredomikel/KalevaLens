import { StateGraph, MemorySaver, START, END, interrupt } from "@langchain/langgraph";
import { randomUUID } from "crypto";
import { EditorialWorkflowAnnotation, EditorialWorkflowState } from "./state";
import { runIngestionAgent } from "../agents/ingestion";
import { runClassificationAgent } from "../agents/classification";
import { runSourceVerificationAgent } from "../agents/sourceVerification";
import { runStorySelectionAgent } from "../agents/storySelection";
import { runNewsGenerationAgent } from "../agents/newsGeneration";
import { runContentVerificationAgent } from "../agents/contentVerification";
import { runTranslationAgent } from "../agents/translation";
import { runContextualizationAgent } from "../agents/contextualization";
import { sql } from "@/lib/neon";
import { ensureDatabaseSchema } from "@/lib/db/init";
import { enqueueArticleMedia } from "@/lib/media/repository";

// Persistent memory checkpointer for state persistence
export const checkpointer = new MemorySaver();

// ─── WORKFLOW NODE FUNCTIONS ───

async function ingestNode(state: EditorialWorkflowState) {
  let candidate = state.candidate;
  if (!candidate) {
    const candidates = await runIngestionAgent();
    candidate = candidates[0] || null;
  }
  return {
    candidate,
    executionLogs: [{ agent: "ingestion", status: "completed", timestamp: new Date().toISOString() }],
  };
}

async function classifyNode(state: EditorialWorkflowState) {
  if (!state.candidate) throw new Error("Missing candidate for classification.");
  const classification = await runClassificationAgent(state.candidate);
  return {
    classification,
    executionLogs: [{ agent: "classification", status: "completed", timestamp: new Date().toISOString() }],
  };
}

async function sourceVerificationNode(state: EditorialWorkflowState) {
  if (!state.candidate || !state.classification) throw new Error("Missing inputs for source verification.");
  const sourceVerification = await runSourceVerificationAgent(state.candidate, state.classification);
  return {
    sourceVerification,
    executionLogs: [{ agent: "sourceVerification", status: "completed", timestamp: new Date().toISOString() }],
  };
}

function routeSourceRisk(state: EditorialWorkflowState) {
  const sv = state.sourceVerification;
  if (sv && (sv.requiresHumanReview || sv.riskLevel === "high")) {
    return "hitl1SourceInvestigationNode";
  }
  return "storySelectionNode";
}

async function hitl1SourceInvestigationNode(state: EditorialWorkflowState) {
  await ensureDatabaseSchema();
  const taskId = randomUUID();

  // Persist Editorial Task for Moderator
  await sql`
    INSERT INTO "EditorialTask" (
      id, "workflowId", "storyId", "taskType", status, details
    ) VALUES (
      ${taskId},
      ${state.workflowId},
      ${state.candidate?.id || randomUUID()},
      'HITL_SOURCE_INVESTIGATION',
      'PENDING',
      ${JSON.stringify({
        candidate: state.candidate,
        verification: state.sourceVerification,
      })}
    ) ON CONFLICT (id) DO UPDATE SET status = 'PENDING';
  `;

  // Interrupt workflow execution for Human Review
  const decision = interrupt({
    taskId,
    type: "HITL_SOURCE_INVESTIGATION",
    message: "High risk or unverified source detected. Requires moderator investigation.",
    data: { candidate: state.candidate, verification: state.sourceVerification },
  }) as { decision?: string; notes?: string } | undefined;

  return {
    hitl1Decision: decision?.decision || "APPROVE",
    hitl1Notes: decision?.notes || null,
    executionLogs: [{ agent: "hitl1SourceInvestigation", status: "resumed", timestamp: new Date().toISOString() }],
  };
}

function routeHitl1Decision(state: EditorialWorkflowState) {
  if (state.hitl1Decision === "REJECT") {
    return END;
  }
  return "storySelectionNode";
}

async function storySelectionNode(state: EditorialWorkflowState) {
  if (!state.candidate || !state.classification || !state.sourceVerification) {
    throw new Error("Missing inputs for story selection.");
  }
  const storyProposal = await runStorySelectionAgent(state.candidate, state.classification, state.sourceVerification);
  return {
    storyProposal,
    executionLogs: [{ agent: "storySelection", status: "completed", timestamp: new Date().toISOString() }],
  };
}

function routeStorySelection(state: EditorialWorkflowState) {
  if (state.storyProposal && !state.storyProposal.deservesCoverage) {
    return END;
  }
  return "newsGenerationNode";
}

async function newsGenerationNode(state: EditorialWorkflowState) {
  if (!state.candidate || !state.storyProposal || !state.sourceVerification) {
    throw new Error("Missing inputs for news generation.");
  }

  const revisionNotes = state.contentVerification?.suggestedRevisions?.join("; ") || state.hitl2Notes || undefined;

  const draft = await runNewsGenerationAgent(
    state.candidate,
    state.storyProposal,
    state.sourceVerification,
    revisionNotes
  );

  return {
    draft,
    executionLogs: [{ agent: "newsGeneration", status: "completed", timestamp: new Date().toISOString() }],
  };
}

async function contentVerificationNode(state: EditorialWorkflowState) {
  if (!state.draft || !state.sourceVerification) throw new Error("Missing inputs for content verification.");

  const contentVerification = await runContentVerificationAgent(state.draft, state.sourceVerification);

  return {
    contentVerification,
    executionLogs: [{ agent: "contentVerification", status: "completed", timestamp: new Date().toISOString() }],
  };
}

function routeContentVerification(state: EditorialWorkflowState) {
  if (state.contentVerification?.passed) {
    return "hitl2FinalApprovalNode";
  }

  if ((state.revisionCount || 0) < 2) {
    return "newsGenerationNode";
  }

  // Max revisions reached - escalate to human approval
  return "hitl2FinalApprovalNode";
}

async function hitl2FinalApprovalNode(state: EditorialWorkflowState) {
  await ensureDatabaseSchema();
  if (!state.draft) throw new Error("Missing draft for final approval.");

  const storyId = state.candidate?.id || randomUUID();
  const taskId = randomUUID();

  // 1. Create or Update StorySubmission in REVIEW stage in DB
  await sql`
    INSERT INTO "StorySubmission" (
      id, title, summary, content, community, category, "authorId", stage, priority, "aiScore", "workflowId"
    ) VALUES (
      ${storyId},
      ${state.draft.title},
      ${state.draft.summaryBullets.join("\n• ")},
      ${state.draft.body},
      ${state.draft.community},
      ${state.draft.category},
      'ai-journalist',
      'REVIEW',
      0,
      ${state.contentVerification?.confidenceScore || 85},
      ${state.workflowId}
    ) ON CONFLICT (id) DO UPDATE SET 
      title = EXCLUDED.title,
      summary = EXCLUDED.summary,
      content = EXCLUDED.content,
      stage = 'REVIEW',
      "updatedAt" = CURRENT_TIMESTAMP;
  `;

  // 2. Create Editorial Task for Kanban
  await sql`
    INSERT INTO "EditorialTask" (
      id, "workflowId", "storyId", "taskType", status, details
    ) VALUES (
      ${taskId},
      ${state.workflowId},
      ${storyId},
      'HITL_FINAL_APPROVAL',
      'PENDING',
      ${JSON.stringify({
        draft: state.draft,
        contentVerification: state.contentVerification,
      })}
    ) ON CONFLICT (id) DO UPDATE SET status = 'PENDING';
  `;

  // 3. Interrupt Workflow for Final Moderator Decision
  const decision = interrupt({
    taskId,
    storyId,
    type: "HITL_FINAL_APPROVAL",
    message: "Canonical article draft requires final human editorial approval.",
    data: { draft: state.draft, verification: state.contentVerification },
  }) as { decision?: string; notes?: string } | undefined;

  return {
    hitl2Decision: decision?.decision || "APPROVE",
    hitl2Notes: decision?.notes || null,
    executionLogs: [{ agent: "hitl2FinalApproval", status: "resumed", timestamp: new Date().toISOString() }],
  };
}

function routeHitl2Decision(state: EditorialWorkflowState) {
  if (state.hitl2Decision === "REJECT") {
    return "rejectStoryNode";
  }
  if (state.hitl2Decision === "REQUEST_CHANGES") {
    return "newsGenerationNode";
  }
  return "publicationNode";
}

async function rejectStoryNode(state: EditorialWorkflowState) {
  await ensureDatabaseSchema();
  const storyId = state.candidate?.id;
  if (storyId) {
    await sql`
      UPDATE "StorySubmission" SET stage = 'REJECTED', "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${storyId};
    `;
  }
  return {
    status: "REJECTED" as const,
    executionLogs: [{ agent: "rejectStory", status: "completed", timestamp: new Date().toISOString() }],
  };
}

async function publicationNode(state: EditorialWorkflowState) {
  await ensureDatabaseSchema();
  if (!state.draft) throw new Error("Missing draft for publication.");

  const storyId = state.candidate?.id || randomUUID();

  // 1. Publish Article in Database
  await sql`
    UPDATE "StorySubmission"
    SET stage = 'PUBLISHED', "updatedAt" = CURRENT_TIMESTAMP
    WHERE id = ${storyId};
  `;

  // 2. Generate Translations (e.g. English, Swedish, Finnish)
  const targetLangs = ["en", "fi", "sv"];
  for (const lang of targetLangs) {
    try {
      const translation = await runTranslationAgent(state.draft, lang);
      await sql`
        INSERT INTO "ArticleTranslation" (id, "storyId", language, title, summary, content)
        VALUES (
          ${randomUUID()},
          ${storyId},
          ${lang},
          ${translation.title},
          ${JSON.stringify(translation.summaryBullets)},
          ${translation.body || ""}
        ) ON CONFLICT ("storyId", language) DO UPDATE SET
          title = EXCLUDED.title,
          summary = EXCLUDED.summary,
          content = EXCLUDED.content;
      `;
    } catch (err) {
      console.error(`[WORKFLOW] Translation error for ${lang}:`, err);
    }
  }

  // Persist durable work only after final human approval and translations.
  for (const lang of targetLangs) {
    await enqueueArticleMedia(storyId, lang, 20);
  }

  // 3. Generate Contextual Explanation
  try {
    const context = await runContextualizationAgent(state.draft, "beginner");
    await sql`
      INSERT INTO "ArticleContext" (id, "storyId", "explanationType", explanation)
      VALUES (
        ${randomUUID()},
        ${storyId},
        ${context.explanationType},
        ${context.explanation}
      ) ON CONFLICT DO NOTHING;
    `;
  } catch (err) {
    console.error("[WORKFLOW] Contextualization error:", err);
  }

  // 4. Log Agent Execution History
  await sql`
    INSERT INTO "AgentExecutionLog" (
      id, "workflowId", "agentName", model, status, "durationMs", "tokenUsage", "outputReferences"
    ) VALUES (
      ${randomUUID()},
      ${state.workflowId},
      'editorialWorkflow',
      'gemini-2.5-flash',
      'COMPLETED',
      0,
      ${JSON.stringify({ totalTokens: 1000 })},
      ${JSON.stringify({ storyId })}
    );
  `;

  return {
    publishedStoryId: storyId,
    status: "PUBLISHED" as const,
    executionLogs: [{ agent: "publication", status: "completed", timestamp: new Date().toISOString() }],
  };
}

// ─── BUILD GRAPH ───

const workflow = new StateGraph(EditorialWorkflowAnnotation)
  .addNode("ingestNode", ingestNode)
  .addNode("classifyNode", classifyNode)
  .addNode("sourceVerificationNode", sourceVerificationNode)
  .addNode("hitl1SourceInvestigationNode", hitl1SourceInvestigationNode)
  .addNode("storySelectionNode", storySelectionNode)
  .addNode("newsGenerationNode", newsGenerationNode)
  .addNode("contentVerificationNode", contentVerificationNode)
  .addNode("hitl2FinalApprovalNode", hitl2FinalApprovalNode)
  .addNode("rejectStoryNode", rejectStoryNode)
  .addNode("publicationNode", publicationNode)

  // Edges
  .addEdge(START, "ingestNode")
  .addEdge("ingestNode", "classifyNode")
  .addEdge("classifyNode", "sourceVerificationNode")
  .addConditionalEdges("sourceVerificationNode", routeSourceRisk, [
    "hitl1SourceInvestigationNode",
    "storySelectionNode",
  ])
  .addConditionalEdges("hitl1SourceInvestigationNode", routeHitl1Decision, [
    "storySelectionNode",
    END,
  ])
  .addConditionalEdges("storySelectionNode", routeStorySelection, [
    "newsGenerationNode",
    END,
  ])
  .addEdge("newsGenerationNode", "contentVerificationNode")
  .addConditionalEdges("contentVerificationNode", routeContentVerification, [
    "newsGenerationNode",
    "hitl2FinalApprovalNode",
  ])
  .addConditionalEdges("hitl2FinalApprovalNode", routeHitl2Decision, [
    "publicationNode",
    "newsGenerationNode",
    "rejectStoryNode",
  ])
  .addEdge("rejectStoryNode", END)
  .addEdge("publicationNode", END);

export const editorialWorkflowApp = workflow.compile({ checkpointer });
