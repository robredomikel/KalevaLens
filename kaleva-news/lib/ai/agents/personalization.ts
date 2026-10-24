import { z } from "zod";
import { generateAgentStructured } from "../generate";

export interface UserPreferencesSummary {
  preferredLanguage?: string;
  preferredLanguageLevel?: string;
  finnishPracticeFrequency?: string;
  finnishPracticeMode?: string | null;
  userSituation?: string;
  timeInFinland?: string;
  finnishSocietyFamiliarity?: string;
  topicInterests?: string[];
  newsGoals?: string[];
  contextLevel?: string;
  discoveryOpenness?: number;
  communityId?: string | null;
  subscribedCommunities?: string[];
}

export interface RankedArticleScore {
  storyId: string;
  relevanceScore: number; // 0 - 100
  reasoning: string;
}

const RankedArticlesSchema = z.object({
  rankings: z.array(
    z.object({
      storyId: z.string(),
      relevanceScore: z.number().min(0).max(100),
      reasoning: z.string(),
    })
  ),
});

const SYSTEM_INSTRUCTION = `
You are the Recommendation & Personalization Engine for Kaleva Lens.
Given a user's preferences (interests, subscribed communities, goals) and a set of candidate articles, evaluate semantic relevance for each article.
`;

export async function runPersonalizationAgent(
  userPrefs: UserPreferencesSummary,
  articles: Array<{ id: string; title: string; category: string; community: string; summary: string }>
): Promise<RankedArticleScore[]> {
  if (articles.length === 0) return [];

  // Deterministic pre-filter / baseline score calculation
  const defaultRankings: RankedArticleScore[] = articles.map((art) => {
    let score = 50;
    if (userPrefs.subscribedCommunities?.includes(art.community) || userPrefs.communityId === art.community) {
      score += 30;
    }
    if (userPrefs.topicInterests?.some((t) => art.category.toLowerCase().includes(t.toLowerCase()))) {
      score += 15;
    }
    return {
      storyId: art.id,
      relevanceScore: Math.min(100, score),
      reasoning: "Matched community and topic preferences.",
    };
  });

  const prompt = `
Evaluate personalization rankings for user:
User Topics: ${JSON.stringify(userPrefs.topicInterests || [])}
User Subscribed Communities: ${JSON.stringify(userPrefs.subscribedCommunities || [])}
User News Goals: ${JSON.stringify(userPrefs.newsGoals || [])}

Articles to Rank:
${articles.map((a) => `- ID: ${a.id} | Title: ${a.title} | Category: ${a.category} | Community: ${a.community}`).join("\n")}

Return structured rankings with relevance scores (0-100) and concise reasoning.
`;

  const result = await generateAgentStructured({
    agentName: "personalization",
    prompt,
    systemInstruction: SYSTEM_INSTRUCTION,
    schema: RankedArticlesSchema,
    fallbackResponse: { rankings: defaultRankings },
  });

  return result.data.rankings;
}
