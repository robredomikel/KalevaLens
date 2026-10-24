import { z } from "zod";

export const SourceVerificationReportSchema = z.object({
  candidateId: z.string(),
  sourceIdentity: z.string(),
  confidenceScore: z.number().min(0).max(100),
  isVerifiedSource: z.boolean(),
  evidenceSummary: z.string(),
  unverifiedClaims: z.array(z.string()),
  contradictions: z.array(z.string()),
  riskLevel: z.enum(["low", "medium", "high"]),
  requiresHumanReview: z.boolean(),
});

export type SourceVerificationReport = z.infer<typeof SourceVerificationReportSchema>;

export const ContentVerificationReportSchema = z.object({
  draftTitle: z.string(),
  passed: z.boolean(),
  confidenceScore: z.number().min(0).max(100),
  unsupportedClaims: z.array(z.string()),
  inaccuraciesFound: z.array(z.string()),
  misleadingHeadlines: z.boolean(),
  suggestedRevisions: z.array(z.string()),
});

export type ContentVerificationReport = z.infer<typeof ContentVerificationReportSchema>;
