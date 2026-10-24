import 'server-only'
import { Annotation, Command, END, START, StateGraph, interrupt } from '@langchain/langgraph'
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres'
import { db } from '@/lib/db'
import { humanDecisionSchema } from '@/lib/ai/schemas'
import type { UserPreferences } from '@/lib/profile'
import {
  agentRuntimeConfig, classifyCandidate, contextualizeArticle, generateDraft, selectStory,
  translateArticle, verifyContent, verifySources,
} from './nodes'
import { hasExactVersionApproval, nextAfterAutomatedVerification, nextAfterFinalDecision } from './policy'

type Verification = Awaited<ReturnType<typeof verifySources>>
type Proposal = Awaited<ReturnType<typeof selectStory>>
type DraftResult = Awaited<ReturnType<typeof generateDraft>>
type ContentVerification = Awaited<ReturnType<typeof verifyContent>>
type Decision = ReturnType<typeof humanDecisionSchema.parse>

const EditorialState = Annotation.Root({
  workflowId: Annotation<string>(),
  candidateId: Annotation<string>(),
  classification: Annotation<Record<string, unknown> | undefined>(),
  sourceVerification: Annotation<Verification | undefined>(),
  sourceDecision: Annotation<Decision | undefined>(),
  proposal: Annotation<Proposal | undefined>(),
  draft: Annotation<DraftResult | undefined>(),
  contentVerification: Annotation<ContentVerification | undefined>(),
  revisionCount: Annotation<number>(),
  finalDecision: Annotation<Decision | undefined>(),
  targetLanguage: Annotation<string>(),
  error: Annotation<string | undefined>(),
})

type State = typeof EditorialState.State

const markAgent = (state: State, currentAgent: string) => db.workflowRun.update({ where: { id: state.workflowId }, data: { currentAgent, status: 'RUNNING', waitingFor: null } })

const classifyNode = async (state: State) => {
  await markAgent(state, 'news_classification')
  return { classification: await classifyCandidate(state.workflowId, state.candidateId) }
}
const verifySourcesNode = async (state: State) => {
  await markAgent(state, 'source_verification')
  return { sourceVerification: await verifySources(state.workflowId, state.candidateId) }
}
const sourceReviewNode = async (state: State) => {
  await db.workflowRun.update({ where: { id: state.workflowId }, data: { status: 'WAITING_HUMAN', waitingFor: 'SOURCE_REVIEW', currentAgent: 'human_source_review' } })
  const existing = await db.editorialTask.findFirst({ where: { workflowId: state.workflowId, checkpoint: 'SOURCE_REVIEW' } })
  if (!existing) await db.editorialTask.create({
    data: { workflowId: state.workflowId, checkpoint: 'SOURCE_REVIEW', candidateId: state.candidateId, reason: state.sourceVerification?.unresolvedIssues.join('\n') || 'Source review required' },
  })
  const decision = humanDecisionSchema.parse(interrupt({ checkpoint: 'SOURCE_REVIEW', workflowId: state.workflowId, candidateId: state.candidateId }))
  if (decision.action === 'reject') {
    await db.$transaction([
      db.newsCandidate.update({ where: { id: state.candidateId }, data: { status: 'REJECTED' } }),
      db.workflowRun.update({ where: { id: state.workflowId }, data: { status: 'REJECTED', waitingFor: null } }),
    ])
  }
  return { sourceDecision: decision }
}
const selectionNode = async (state: State) => {
  await markAgent(state, 'story_selection')
  return { proposal: await selectStory(state.workflowId, state.candidateId) }
}
const generationNode = async (state: State) => {
  await markAgent(state, 'news_generation')
  return { draft: await generateDraft(state.workflowId, state.candidateId, state.proposal, state.contentVerification?.issues || []) }
}
const contentVerificationNode = async (state: State) => {
  if (!state.draft) throw new Error('Draft is missing before content verification.')
  await markAgent(state, 'content_verification')
  const report = await verifyContent(state.workflowId, state.draft.versionId)
  return { contentVerification: report, revisionCount: report.passed ? state.revisionCount : state.revisionCount + 1 }
}
const finalReviewNode = async (state: State) => {
  if (!state.draft) throw new Error('Draft is missing before final review.')
  await db.canonicalArticle.update({ where: { id: state.draft.articleId }, data: { status: 'IN_REVIEW' } })
  await db.workflowRun.update({ where: { id: state.workflowId }, data: { status: 'WAITING_HUMAN', waitingFor: 'FINAL_APPROVAL', currentAgent: 'human_final_review' } })
  const existing = await db.editorialTask.findFirst({ where: { workflowId: state.workflowId, checkpoint: 'FINAL_APPROVAL', articleVersionId: state.draft.versionId } })
  if (!existing) await db.editorialTask.create({
    data: { workflowId: state.workflowId, checkpoint: 'FINAL_APPROVAL', candidateId: state.candidateId, articleId: state.draft.articleId, articleVersionId: state.draft.versionId, reason: state.contentVerification?.passed ? 'Mandatory final approval' : 'Automated revision limit reached' },
  })
  const decision = humanDecisionSchema.parse(interrupt({ checkpoint: 'FINAL_APPROVAL', workflowId: state.workflowId, articleVersionId: state.draft.versionId }))
  if (decision.action === 'reject') await db.workflowRun.update({ where: { id: state.workflowId }, data: { status: 'REJECTED', waitingFor: null } })
  return { finalDecision: decision, revisionCount: decision.action === 'request_changes' ? state.revisionCount + 1 : state.revisionCount }
}
const localizationNode = async (state: State) => {
  if (!state.draft) throw new Error('Approved draft is missing.')
  await markAgent(state, 'translation_localization')
  await translateArticle(state.workflowId, state.draft.versionId, state.targetLanguage || 'en')
  return {}
}
const contextualizationNode = async (state: State) => {
  if (!state.draft) throw new Error('Approved draft is missing.')
  await markAgent(state, 'contextual_explanation')
  const genericPreferences: UserPreferences = {
    preferredLanguage: state.targetLanguage || 'en', finnishPracticeFrequency: 'none', finnishPracticeMode: null,
    userSituation: 'other', timeInFinland: 'not_moved', finnishSocietyFamiliarity: 'beginner',
    topicInterests: [], newsGoals: [], contextLevel: 'balanced', discoveryOpenness: 50,
  }
  await contextualizeArticle(state.workflowId, state.draft.versionId, genericPreferences)
  return {}
}
const publicationNode = async (state: State) => {
  if (!state.draft) throw new Error('Approved draft is missing.')
  await markAgent(state, 'publication')
  const approval = await db.editorialDecision.findFirst({
    where: { articleVersionId: state.draft.versionId, decision: 'APPROVE', moderator: { role: { in: ['MODERATOR', 'ADMIN'] } } },
    include: { moderator: { select: { role: true } } },
  })
  if (!approval || !hasExactVersionApproval({
    currentVersionId: state.draft.versionId,
    approvedVersionId: approval.articleVersionId,
    decision: approval.decision,
    moderatorRole: approval.moderator.role,
  })) throw new Error('Publication denied: this exact article version lacks authorized editorial approval.')
  await db.$transaction([
    db.canonicalArticle.update({ where: { id: state.draft.articleId }, data: { status: 'PUBLISHED', publishedAt: new Date() } }),
    db.workflowRun.update({ where: { id: state.workflowId }, data: { status: 'COMPLETED', currentAgent: 'personalization', waitingFor: null } }),
  ])
  return {}
}

const afterEvidence = (state: State) => state.sourceVerification?.recommendedAction === 'proceed' ? 'story_selection' : 'source_review'
const afterSourceReview = (state: State) => state.sourceDecision?.action === 'approve' ? 'story_selection' : END
const afterVerification = (state: State) => {
  return nextAfterAutomatedVerification(Boolean(state.contentVerification?.passed), state.revisionCount, agentRuntimeConfig.maxRevisionCycles)
}
const afterFinalReview = (state: State) => {
  const next = nextAfterFinalDecision(state.finalDecision?.action, state.revisionCount, agentRuntimeConfig.maxRevisionCycles)
  return next === 'end' ? END : next
}

let graphPromise: Promise<ReturnType<ReturnType<typeof buildGraph>['compile']>> | null = null
let checkpointer: PostgresSaver | null = null

function buildGraph() {
  return new StateGraph(EditorialState)
    .addNode('news_classification', classifyNode)
    .addNode('source_verification', verifySourcesNode)
    .addNode('source_review', sourceReviewNode)
    .addNode('story_selection', selectionNode)
    .addNode('news_generation', generationNode)
    .addNode('content_verification', contentVerificationNode)
    .addNode('final_review', finalReviewNode)
    .addNode('translation_localization', localizationNode)
    .addNode('contextual_explanation', contextualizationNode)
    .addNode('publication', publicationNode)
    .addEdge(START, 'news_classification')
    .addEdge('news_classification', 'source_verification')
    .addConditionalEdges('source_verification', afterEvidence)
    .addConditionalEdges('source_review', afterSourceReview)
    .addEdge('story_selection', 'news_generation')
    .addEdge('news_generation', 'content_verification')
    .addConditionalEdges('content_verification', afterVerification)
    .addConditionalEdges('final_review', afterFinalReview)
    .addEdge('translation_localization', 'contextual_explanation')
    .addEdge('contextual_explanation', 'publication')
    .addEdge('publication', END)
}

export async function getEditorialGraph() {
  graphPromise ??= (async () => {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for durable workflow checkpoints.')
    checkpointer = PostgresSaver.fromConnString(process.env.DATABASE_URL, { schema: 'langgraph' })
    await checkpointer.setup()
    return buildGraph().compile({ checkpointer })
  })()
  return graphPromise
}

export async function startEditorialWorkflow(candidateId: string, targetLanguage = 'en') {
  const workflowId = crypto.randomUUID()
  await db.workflowRun.create({ data: { id: workflowId, candidateId, currentAgent: 'news_classification' } })
  const graph = await getEditorialGraph()
  await graph.invoke({ workflowId, candidateId, revisionCount: 0, targetLanguage }, { configurable: { thread_id: workflowId } })
  return db.workflowRun.findUniqueOrThrow({ where: { id: workflowId } })
}

export async function resumeEditorialWorkflow(workflowId: string, decision: Decision) {
  const graph = await getEditorialGraph()
  await graph.invoke(new Command({ resume: humanDecisionSchema.parse(decision) }), { configurable: { thread_id: workflowId } })
  return db.workflowRun.findUniqueOrThrow({ where: { id: workflowId } })
}
