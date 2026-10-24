import { z } from "zod";

export const StoryProposalSchema = z.object({
  candidateId: z.string(),
  deservesCoverage: z.boolean(),
  angle: z.string(),
  editorialPriority: z.enum(["low", "medium", "high", "urgent"]),
  targetCommunity: z.string(),
  primaryReaderNeed: z.string(),
  reasoning: z.string(),
});

export type StoryProposal = z.infer<typeof StoryProposalSchema>;

export const EditorialDecisionSchema = z.object({
  taskId: z.string(),
  storyId: z.string(),
  moderatorId: z.string(),
  decision: z.enum(["APPROVE", "REJECT", "REQUEST_CHANGES", "ESCALATE"]),
  notes: z.string().optional(),
});

export type EditorialDecision = z.infer<typeof EditorialDecisionSchema>;

export const CommunityIntelligenceReportSchema = z.object({
  communityName: z.string(),
  trendingTopics: z.array(z.string()),
  correctionRequests: z.array(
    z.object({
      articleId: z.string(),
      issueReported: z.string(),
      suggestedCorrection: z.string(),
    })
  ),
  suggestedTasks: z.array(
    z.object({
      taskType: z.string(),
      description: z.string(),
      urgency: z.string(),
    })
  ),
});

export type CommunityIntelligenceReport = z.infer<
  typeof CommunityIntelligenceReportSchema
>;
