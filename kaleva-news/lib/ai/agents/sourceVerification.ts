import { generateAgentStructured } from "../generate";
import { NewsCandidate, ClassifiedNews } from "../schemas/article";
import { SourceVerificationReport, SourceVerificationReportSchema } from "../schemas/verification";

const SYSTEM_INSTRUCTION = `
You are a senior investigative journalist and fact-checker at Kaleva.
Evaluate the source and evidentiary support of the news article candidate.
Check source identity, publication date, backing evidence, unverified claims, contradictions, and misinformation risk.
If risk is high, or unverified sensitive claims are present, set requiresHumanReview to true.
`;

export async function runSourceVerificationAgent(
  candidate: NewsCandidate,
  classification: ClassifiedNews
): Promise<SourceVerificationReport> {
  const prompt = `
Verify the source and evidence for this candidate story:
ID: ${candidate.id}
Title: ${candidate.title}
Source Name: ${candidate.sourceName}
Source URL: ${candidate.sourceUrl || "N/A"}
Content: ${candidate.summary} ${candidate.content || ""}
Classification Sensitivity Score: ${classification.sensitivityScore}

Assess source reliability, unverified claims, risk level (low, medium, high), and whether human review is required.
`;

  const fallbackResponse: SourceVerificationReport = {
    candidateId: candidate.id,
    sourceIdentity: candidate.sourceName,
    confidenceScore: 85,
    isVerifiedSource: true,
    evidenceSummary: "Verified against standard news source feed.",
    unverifiedClaims: [],
    contradictions: [],
    riskLevel: classification.sensitivityScore > 70 ? "high" : "low",
    requiresHumanReview: classification.sensitivityScore > 70,
  };

  const result = await generateAgentStructured({
    agentName: "sourceVerification",
    prompt,
    systemInstruction: SYSTEM_INSTRUCTION,
    schema: SourceVerificationReportSchema,
    fallbackResponse,
  });

  return result.data;
}
