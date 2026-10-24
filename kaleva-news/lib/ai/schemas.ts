import { z } from 'zod'

export const readerNeedSchema = z.enum(['information', 'understanding', 'usefulness', 'emotion', 'break', 'community'])
export const candidateSchema = z.object({
  id: z.string(), title: z.string(), description: z.string().nullable(), content: z.string().nullable(),
  originalUrl: z.string().url().nullable(), language: z.string().nullable(), communityId: z.string().nullable(),
})
export const classificationSchema = z.object({
  topics: z.array(z.string()), geographicRelevance: z.array(z.string()), communityRelevance: z.array(z.string()),
  language: z.string(), urgency: z.enum(['low', 'normal', 'high', 'breaking']), readerNeeds: z.array(readerNeedSchema),
  editorialSensitivity: z.enum(['low', 'medium', 'high']), sensitivityReasons: z.array(z.string()),
})
export const evidenceReferenceSchema = z.object({ id: z.string(), url: z.string().url(), excerpt: z.string().nullable() })
export const verificationReportSchema = z.object({
  candidateId: z.string(), evidenceReferences: z.array(z.string()), supportedClaims: z.array(z.string()),
  unsupportedClaims: z.array(z.string()), unresolvedIssues: z.array(z.string()), riskLevel: z.enum(['low', 'medium', 'high']),
  recommendedAction: z.enum(['proceed', 'human_review', 'reject']),
})
export const storyProposalSchema = z.object({
  candidateId: z.string(), editorialAngle: z.string(), targetCommunities: z.array(z.string()),
  readerNeeds: z.array(readerNeedSchema), priority: z.number().int().min(0).max(100), rationale: z.string(), sourceReferences: z.array(z.string()),
})
export const articleDraftSchema = z.object({
  headline: z.string(), lead: z.string(), body: z.string(), summary: z.array(z.string()).min(1).max(5),
  categories: z.array(z.string()), sourceReferences: z.array(z.string()),
  claimEvidence: z.array(z.object({ claim: z.string(), evidenceIds: z.array(z.string()).min(1) })),
})
export const contentVerificationSchema = z.object({
  passed: z.boolean(), issues: z.array(z.object({ claim: z.string(), issueType: z.string(), severity: z.enum(['low', 'medium', 'high']), supportingEvidence: z.array(z.string()), recommendedCorrection: z.string() })),
})
export const translationSchema = articleDraftSchema.pick({ headline: true, lead: true, body: true, summary: true }).extend({ significantChanges: z.array(z.string()) })
export const contextSchema = z.object({ title: z.string(), sections: z.array(z.object({ heading: z.string(), explanation: z.string(), referenceIds: z.array(z.string()) })) })
export const rankingSchema = z.object({ ranked: z.array(z.object({ articleId: z.string(), semanticScore: z.number().min(0).max(1), reason: z.string() })) })
export const communityIntelligenceSchema = z.object({
  classification: z.enum(['general_discussion', 'story_suggestion', 'question', 'correction_request', 'potential_misinformation', 'moderation_concern']),
  rationale: z.string(), recommendedEditorialAction: z.string().nullable(),
})
export const humanDecisionSchema = z.object({ action: z.enum(['approve', 'request_changes', 'reject', 'escalate', 'request_evidence']), notes: z.string().max(4000).optional().default('') })
