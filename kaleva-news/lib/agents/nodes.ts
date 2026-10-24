import 'server-only'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { agentRuntimeConfig } from '@/lib/ai/config'
import {
  articleDraftSchema, classificationSchema, communityIntelligenceSchema, contentVerificationSchema,
  contextSchema, rankingSchema, storyProposalSchema, translationSchema, verificationReportSchema,
} from '@/lib/ai/schemas'
import { logDeterministicAgent, runLoggedAgent } from './execution'
import type { UserPreferences } from '@/lib/profile'

const json = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue

export async function classifyCandidate(workflowId: string, candidateId: string) {
  const candidate = await db.newsCandidate.findUniqueOrThrow({ where: { id: candidateId } })
  const output = await runLoggedAgent(workflowId, 'news_classification', { candidateId }, {
    agent: 'classification', schema: classificationSchema,
    systemInstruction: 'Classify local Finnish news. Use concise stable category identifiers. Assess sensitivity conservatively. Return only structured data.',
    prompt: JSON.stringify({ title: candidate.title, description: candidate.description, content: candidate.content, language: candidate.language }),
  })
  await db.newsCandidate.update({ where: { id: candidateId }, data: { classification: json(output), language: output.language, status: 'CLASSIFIED' } })
  return output
}

export async function verifySources(workflowId: string, candidateId: string) {
  const candidate = await db.newsCandidate.findUniqueOrThrow({ where: { id: candidateId }, include: { evidence: true } })
  if (candidate.evidence.length === 0) {
    return logDeterministicAgent(workflowId, 'source_verification', { candidateId, evidenceIds: [] }, async () => {
      await db.newsCandidate.update({ where: { id: candidateId }, data: { status: 'NEEDS_REVIEW' } })
      return {
        candidateId, evidenceReferences: [], supportedClaims: [], unsupportedClaims: [],
        unresolvedIssues: ['No retrieved evidence is available.'], riskLevel: 'high' as const,
        recommendedAction: 'human_review' as const,
      }
    })
  }
  const output = await runLoggedAgent(workflowId, 'source_verification', { candidateId, evidenceIds: candidate.evidence.map((item) => item.id) }, {
    agent: 'sourceVerification', schema: verificationReportSchema,
    systemInstruction: 'Evaluate only supplied evidence. Never use internal knowledge as proof and never invent sources. Report insufficient evidence explicitly.',
    prompt: JSON.stringify({ candidate: { id: candidate.id, title: candidate.title, description: candidate.description, content: candidate.content }, evidence: candidate.evidence }),
  })
  await db.newsCandidate.update({ where: { id: candidateId }, data: { status: output.recommendedAction === 'proceed' ? 'VERIFIED' : 'NEEDS_REVIEW' } })
  return output
}

export async function selectStory(workflowId: string, candidateId: string) {
  const candidate = await db.newsCandidate.findUniqueOrThrow({ where: { id: candidateId }, include: { evidence: true } })
  const output = await runLoggedAgent(workflowId, 'story_selection', { candidateId }, {
    agent: 'storySelection', schema: storyProposalSchema,
    systemInstruction: 'Select stories by public interest, local relevance, usefulness and coverage diversity. Never optimize exclusively for engagement.',
    prompt: JSON.stringify({ candidate, recentPublishedHeadlines: await db.articleVersion.findMany({ where: { article: { status: 'PUBLISHED' } }, select: { headline: true }, orderBy: { createdAt: 'desc' }, take: 20 }) }),
  })
  await db.newsCandidate.update({ where: { id: candidateId }, data: { status: 'SELECTED' } })
  return output
}

export async function generateDraft(workflowId: string, candidateId: string, proposal: unknown, revisionIssues: unknown[] = []) {
  const candidate = await db.newsCandidate.findUniqueOrThrow({ where: { id: candidateId }, include: { evidence: true, article: { include: { versions: true } } } })
  const output = await runLoggedAgent(workflowId, 'news_generation', { candidateId, evidenceIds: candidate.evidence.map((item) => item.id) }, {
    agent: 'newsGeneration', schema: articleDraftSchema,
    systemInstruction: 'Draft factual journalism using only supplied evidence. Never invent facts, quotations, statistics or allegations. Map every factual claim to evidence IDs.',
    prompt: JSON.stringify({ proposal, evidence: candidate.evidence, candidate: { title: candidate.title, description: candidate.description, content: candidate.content }, revisionIssues }),
    temperature: 0.15,
  })
  const persisted = await db.$transaction(async (tx) => {
    const article = candidate.article || await tx.canonicalArticle.create({ data: { candidateId } })
    const version = await tx.articleVersion.create({
      data: {
        articleId: article.id, version: (candidate.article?.versions.length || 0) + 1, headline: output.headline,
        lead: output.lead, body: output.body, summary: output.summary, categories: output.categories,
        sourceReferences: output.sourceReferences, claimEvidence: json(output.claimEvidence),
      },
    })
    await tx.newsCandidate.update({ where: { id: candidateId }, data: { status: 'DRAFTED' } })
    return { articleId: article.id, versionId: version.id, version: version.version }
  })
  return { draft: output, ...persisted }
}

export async function verifyContent(workflowId: string, versionId: string) {
  const version = await db.articleVersion.findUniqueOrThrow({ where: { id: versionId }, include: { article: { include: { candidate: { include: { evidence: true } } } } } })
  const output = await runLoggedAgent(workflowId, 'content_verification', { versionId }, {
    agent: 'contentVerification', schema: contentVerificationSchema,
    systemInstruction: 'Compare every draft claim against supplied evidence. Flag wrong numbers, quotations, contradictions, misleading certainty and unsupported conclusions.',
    prompt: JSON.stringify({ draft: version, evidence: version.article.candidate.evidence }), temperature: 0,
  })
  await db.articleVersion.update({ where: { id: versionId }, data: { verification: json(output) } })
  return output
}

export async function translateArticle(workflowId: string, versionId: string, targetLanguage: string, mode = 'STANDARD') {
  const version = await db.articleVersion.findUniqueOrThrow({ where: { id: versionId } })
  const output = await runLoggedAgent(workflowId, 'translation_localization', { versionId, targetLanguage }, {
    agent: 'translation', schema: translationSchema,
    systemInstruction: 'Translate faithfully. Preserve names, dates, numbers and attribution. Translation is not simplification unless explicitly requested. List any potentially significant changes.',
    prompt: JSON.stringify({ targetLanguage, mode, article: version }), temperature: 0.1,
  })
  return db.localizedArticle.upsert({
    where: { articleVersionId_language_mode: { articleVersionId: versionId, language: targetLanguage, mode: mode as 'STANDARD' } },
    update: { ...output, summary: output.summary, consistencyCheck: json({ significantChanges: output.significantChanges }), status: output.significantChanges.length ? 'PENDING_REVIEW' : 'APPROVED' },
    create: { articleId: version.articleId, articleVersionId: versionId, language: targetLanguage, mode: mode as 'STANDARD', ...output, summary: output.summary, consistencyCheck: json({ significantChanges: output.significantChanges }), status: output.significantChanges.length ? 'PENDING_REVIEW' : 'APPROVED' },
  })
}

export async function contextualizeArticle(workflowId: string, versionId: string, preferences: UserPreferences) {
  const version = await db.articleVersion.findUniqueOrThrow({ where: { id: versionId }, include: { article: { include: { candidate: { include: { evidence: true } } } } } })
  const output = await runLoggedAgent(workflowId, 'contextual_explanation', { versionId }, {
    agent: 'contextualization', schema: contextSchema,
    systemInstruction: 'Explain Finnish institutions and cultural references separately from reporting. Ground explanations in supplied references; do not infer personal impact.',
    prompt: JSON.stringify({ article: version, references: version.article.candidate.evidence, profile: { familiarity: preferences.finnishSocietyFamiliarity, contextLevel: preferences.contextLevel, timeInFinland: preferences.timeInFinland } }),
  })
  return db.contextualExplanation.upsert({
    where: { articleVersionId_level_familiarityBand_language: { articleVersionId: versionId, level: preferences.contextLevel.toUpperCase() as 'BALANCED', familiarityBand: preferences.finnishSocietyFamiliarity, language: preferences.preferredLanguage } },
    update: { content: json(output), referenceSources: json(version.article.candidate.evidence.map((item) => item.id)) },
    create: { articleId: version.articleId, articleVersionId: versionId, level: preferences.contextLevel.toUpperCase() as 'BALANCED', familiarityBand: preferences.finnishSocietyFamiliarity, language: preferences.preferredLanguage, content: json(output), referenceSources: json(version.article.candidate.evidence.map((item) => item.id)) },
  })
}

export async function personalizeApprovedArticles(userId: string) {
  return logDeterministicAgent(null, 'personalization', { authenticatedProfile: true }, async () => {
    const profile = await db.userProfile.findUnique({ where: { userId } })
    const preferences = profile?.preferences as unknown as UserPreferences | undefined
    const articles = await db.canonicalArticle.findMany({ where: { status: 'PUBLISHED' }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } }, orderBy: { publishedAt: 'desc' }, take: 100 })
    if (!profile || !preferences) return articles.map((article, index) => ({ articleId: article.id, score: 1 - index / 100, reasons: ['recent'] }))
    return articles.map((article, index) => {
      const version = article.versions[0]
      const topicMatches = version?.categories.filter((category) => preferences.topicInterests.includes(category)).length || 0
      const communityMatch = profile.communityId && profile.communityId === article.communityId ? 1 : 0
      const discovery = preferences.discoveryOpenness / 100
      const score = (topicMatches * (1 - discovery)) + communityMatch + Math.max(0, 1 - index / 100) + (discovery * 0.25)
      return { articleId: article.id, score, reasons: [topicMatches ? 'topic_match' : 'discovery', communityMatch ? 'community_match' : ''].filter(Boolean) }
    }).sort((a, b) => b.score - a.score)
  })
}

export async function analyzeCommunityContribution(workflowId: string, contributionId: string, body: string) {
  return runLoggedAgent(workflowId, 'community_intelligence', { contributionId }, {
    agent: 'communityIntelligence', schema: communityIntelligenceSchema,
    systemInstruction: 'Classify community input as a signal, never as verified fact. Corrections and misinformation reports always require human editorial review.',
    prompt: JSON.stringify({ contributionId, body }),
  })
}

export { agentRuntimeConfig, logDeterministicAgent, rankingSchema }
