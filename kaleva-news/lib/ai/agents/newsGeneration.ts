import { generateAgentStructured } from "../generate";
import { NewsCandidate, CanonicalArticleDraft, CanonicalArticleDraftSchema } from "../schemas/article";
import { StoryProposal } from "../schemas/editorial";
import { SourceVerificationReport } from "../schemas/verification";

const SYSTEM_INSTRUCTION = `
You are a professional journalist for Kaleva Lens.
Write a clear, factual, InShorts-style micro-news article draft based strictly on the provided candidate content and verified evidence.
DO NOT invent facts, quotes, or sources.
The output MUST include:
- A punchy headline (title)
- A concise lead sentence
- 3 informative summary bullet points (each under 25 words)
- A short 2-3 paragraph body
- Category and community tags
- Read time estimate (e.g. "1 min read")
- Source references and a claim-to-evidence map.
`;

export async function runNewsGenerationAgent(
  candidate: NewsCandidate,
  proposal: StoryProposal,
  verification: SourceVerificationReport,
  revisionNotes?: string
): Promise<CanonicalArticleDraft> {
  const prompt = `
Generate a canonical micro-news article draft:
Original Title: ${candidate.title}
Editorial Angle: ${proposal.angle}
Target Community: ${proposal.targetCommunity}
Verified Source: ${verification.sourceIdentity}
Raw Content/Evidence: ${candidate.summary} ${candidate.content || ""}
${revisionNotes ? `REVISION NOTES TO FIX: ${revisionNotes}` : ""}

Draft a clean, professional, concise article strictly adhering to the schema.
`;

  const fallbackResponse: CanonicalArticleDraft = {
    title: candidate.title,
    lead: candidate.summary.substring(0, 120),
    summaryBullets: [
      candidate.summary.substring(0, 100) || "Key update for Northern Finland.",
      "Verified local reporting by Kaleva newsroom.",
      "Stay tuned for further developments.",
    ],
    body: candidate.content || candidate.summary,
    category: "Local News",
    community: proposal.targetCommunity || "Oulu Tech Hub",
    readTime: "1 min read",
    sourceReferences: [candidate.sourceName],
    claimToEvidenceMap: [
      {
        claim: candidate.title,
        evidence: verification.evidenceSummary,
        verified: true,
      },
    ],
  };

  const result = await generateAgentStructured({
    agentName: "newsGeneration",
    prompt,
    systemInstruction: SYSTEM_INSTRUCTION,
    schema: CanonicalArticleDraftSchema,
    fallbackResponse,
  });

  return result.data;
}
