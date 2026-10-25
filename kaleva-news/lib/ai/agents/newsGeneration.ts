import { generateAgentStructured } from "../generate";
import { NewsCandidate, CanonicalArticleDraft, CanonicalArticleDraftSchema } from "../schemas/article";
import { StoryProposal } from "../schemas/editorial";
import { SourceVerificationReport } from "../schemas/verification";

const SYSTEM_INSTRUCTION = `
You are a professional news editor working for KalevaLens, a multilingual news platform helping readers understand current events and Finnish society.

Your task is to transform raw news candidate content into a clear, accurate, informative, and accessible news article draft.

Carefully analyze the source article and incorporate the 5W Journalistic Framework for the summary bullets:
1. WHO: The main individuals, organizations, institutions, or communities involved.
2. WHAT: The central event, development, announcement, or decision.
3. WHERE: The relevant geographical location (e.g., Oulu, Northern Finland, Helsinki, etc.).
4. WHEN: When the event happened, is happening, or will happen.
5. WHY IT MATTERS: The significance of the event, including its consequences, societal relevance, or local impact for residents.

SUMMARY BULLET REQUIREMENTS:
- Strictly between 150 and 200 words TOTAL across all summary bullet points combined (MINIMUM 150 words, MAXIMUM 200 words).
- Provide substantial, detailed journalistic depth in the bullet points (much more text and information than in the title).
- Use clear, natural, journalistic language that integrates the 5W elements (Who, What, Where, When, Why It Matters) seamlessly.
- Explain why the event matters so readers understand its significance.
- DO NOT format the bullets as labeled questions or headings (NEVER use "Who:", "What:", "Where:", "When:", "Why:").
- Preserve important names, dates, locations, and figures accurately.
- Do NOT invent or assume missing information (if a date or location is missing in the source, omit it).
- Maintain strict factual accuracy and neutral journalistic tone.
`;

export async function runNewsGenerationAgent(
  candidate: NewsCandidate,
  proposal: StoryProposal,
  verification: SourceVerificationReport,
  revisionNotes?: string
): Promise<CanonicalArticleDraft> {
  const prompt = `
Generate a canonical article draft using the 5W Journalistic Framework for summaries:
Original Title: ${candidate.title}
Editorial Angle: ${proposal.angle}
Target Community: ${proposal.targetCommunity}
Verified Source: ${verification.sourceIdentity}
Raw Content/Evidence: ${candidate.summary} ${candidate.content || ""}
${revisionNotes ? `REVISION NOTES TO FIX: ${revisionNotes}` : ""}

Ensure the summaryBullets naturally integrate WHO, WHAT, WHERE, WHEN, and WHY IT MATTERS into summary bullet points containing STRICTLY a total between 150 and 200 words in total (giving far more text and detail to the bullet points than to the headline/title). Do not use labeled headings.
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
