import { generateAgentStructured } from "../generate";
import { NewsCandidate, ClassifiedNews } from "../schemas/article";
import { SourceVerificationReport } from "../schemas/verification";
import { StoryProposal, StoryProposalSchema } from "../schemas/editorial";

const SYSTEM_INSTRUCTION = `
You are the Managing Editor at Kaleva Media.
Determine if a candidate news item deserves coverage and editorial drafting.
Consider local relevance to Oulu/Northern Finland, reader needs, coverage diversity, and public interest.
`;

export async function runStorySelectionAgent(
  candidate: NewsCandidate,
  classification: ClassifiedNews,
  verification: SourceVerificationReport
): Promise<StoryProposal> {
  const prompt = `
Evaluate story proposal for editorial selection:
Title: ${candidate.title}
Community: ${classification.community}
Category: ${classification.category}
Verification Confidence: ${verification.confidenceScore}%
Risk Level: ${verification.riskLevel}
Summary: ${candidate.summary}

Determine whether this story deserves coverage, the proposed editorial angle, priority level, primary reader need, and concise reasoning.
`;

  const fallbackResponse: StoryProposal = {
    candidateId: candidate.id,
    deservesCoverage: true,
    angle: "Local community update and informational report",
    editorialPriority: "medium",
    targetCommunity: classification.community,
    primaryReaderNeed: classification.readerNeeds[0] || "Information",
    reasoning: "Strong local interest for Northern Finland readers.",
  };

  const result = await generateAgentStructured({
    agentName: "storySelection",
    prompt,
    systemInstruction: SYSTEM_INSTRUCTION,
    schema: StoryProposalSchema,
    fallbackResponse,
  });

  return result.data;
}
