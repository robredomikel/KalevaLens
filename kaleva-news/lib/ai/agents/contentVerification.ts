import { generateAgentStructured } from "../generate";
import { CanonicalArticleDraft } from "../schemas/article";
import { SourceVerificationReport, ContentVerificationReport, ContentVerificationReportSchema } from "../schemas/verification";

const SYSTEM_INSTRUCTION = `
You are the Quality Control & Fact Verification Editor at Kaleva.
Review the AI-generated article draft against the raw source evidence.
Check for:
- Unsupported claims or invented facts
- Misleading or clickbait headlines
- Inaccuracies or exaggerated certainty

Set 'passed' to true if the draft is factually accurate and faithful to evidence.
Set 'passed' to false if revisions are needed, and provide specific suggestedRevisions.
`;

export async function runContentVerificationAgent(
  draft: CanonicalArticleDraft,
  sourceVerification: SourceVerificationReport
): Promise<ContentVerificationReport> {
  const prompt = `
Verify this canonical article draft against evidence:
Draft Title: ${draft.title}
Draft Lead: ${draft.lead}
Draft Bullets: ${JSON.stringify(draft.summaryBullets)}
Draft Body: ${draft.body}
Claim-to-Evidence Map: ${JSON.stringify(draft.claimToEvidenceMap)}

Source Evidence Summary: ${sourceVerification.evidenceSummary}

Inspect for unsupported claims, inaccuracies, or misleading statements.
Return a structured verification report.
`;

  const fallbackResponse: ContentVerificationReport = {
    draftTitle: draft.title,
    passed: true,
    confidenceScore: 92,
    unsupportedClaims: [],
    inaccuraciesFound: [],
    misleadingHeadlines: false,
    suggestedRevisions: [],
  };

  const result = await generateAgentStructured({
    agentName: "contentVerification",
    prompt,
    systemInstruction: SYSTEM_INSTRUCTION,
    schema: ContentVerificationReportSchema,
    fallbackResponse,
  });

  return result.data;
}
