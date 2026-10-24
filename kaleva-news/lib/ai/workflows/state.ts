import { Annotation } from "@langchain/langgraph";
import { NewsCandidate, ClassifiedNews, CanonicalArticleDraft } from "../schemas/article";
import { SourceVerificationReport, ContentVerificationReport } from "../schemas/verification";
import { StoryProposal } from "../schemas/editorial";

export const EditorialWorkflowAnnotation = Annotation.Root({
  workflowId: Annotation<string>(),
  candidate: Annotation<NewsCandidate | null>(),
  classification: Annotation<ClassifiedNews | null>(),
  sourceVerification: Annotation<SourceVerificationReport | null>(),
  storyProposal: Annotation<StoryProposal | null>(),
  draft: Annotation<CanonicalArticleDraft | null>(),
  contentVerification: Annotation<ContentVerificationReport | null>(),
  
  // HITL States
  hitl1Decision: Annotation<"APPROVE" | "REJECT" | "REQUEST_MORE_EVIDENCE" | null>(),
  hitl1Notes: Annotation<string | null>(),
  
  hitl2Decision: Annotation<"APPROVE" | "REJECT" | "REQUEST_CHANGES" | null>(),
  hitl2Notes: Annotation<string | null>(),
  
  revisionCount: Annotation<number>({
    reducer: (x, y) => (y !== undefined ? y : x),
    default: () => 0,
  }),
  
  publishedStoryId: Annotation<string | null>(),
  status: Annotation<"IN_PROGRESS" | "WAITING_HITL1" | "WAITING_HITL2" | "PUBLISHED" | "REJECTED" | "FAILED">(),
  error: Annotation<string | null>(),
  executionLogs: Annotation<Array<{ agent: string; status: string; timestamp: string }>>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
});

export type EditorialWorkflowState = typeof EditorialWorkflowAnnotation.State;
