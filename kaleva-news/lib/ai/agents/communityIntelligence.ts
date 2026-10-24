import { generateAgentStructured } from "../generate";
import { CommunityIntelligenceReport, CommunityIntelligenceReportSchema } from "../schemas/editorial";

const SYSTEM_INSTRUCTION = `
You are the Community Engagement & Intelligence Officer at Kaleva Media.
Analyze community discussions, reader comments, and story suggestions.
Identify trending concerns, potential correction requests, and actionable editorial tasks for journalists.
Community input MUST NOT automatically become published facts without verification.
`;

export async function runCommunityIntelligenceAgent(
  communityName: string,
  comments: Array<{ author: string; text: string; timestamp?: string }>
): Promise<CommunityIntelligenceReport> {
  const prompt = `
Analyze community activity for @${communityName}:
Comments:
${comments.map((c) => `- @${c.author}: "${c.text}"`).join("\n")}

Identify trending local topics, correction requests, and actionable editorial tasks.
`;

  const fallbackResponse: CommunityIntelligenceReport = {
    communityName,
    trendingTopics: ["Local events", "Oulu technology updates"],
    correctionRequests: [],
    suggestedTasks: [
      {
        taskType: "Community Follow-up",
        description: `Investigate popular reader questions in @${communityName}`,
        urgency: "medium",
      },
    ],
  };

  const result = await generateAgentStructured({
    agentName: "communityIntelligence",
    prompt,
    systemInstruction: SYSTEM_INSTRUCTION,
    schema: CommunityIntelligenceReportSchema,
    fallbackResponse,
  });

  return result.data;
}
