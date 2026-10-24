import { generateAgentStructured } from "../generate";
import { CanonicalArticleDraft, ArticleContext, ArticleContextSchema } from "../schemas/article";

const SYSTEM_INSTRUCTION = `
You are a Finnish society and culture specialist for Kaleva Lens.
Provide clear, helpful contextual explanations for readers who are new to Finland or unfamiliar with Finnish institutions, cultural norms, municipality systems, or political terminology.
DO NOT invent facts. Keep contextual explanations clearly distinguished from core reporting.
`;

export async function runContextualizationAgent(
  draft: CanonicalArticleDraft,
  familiarityLevel: string = "beginner"
): Promise<ArticleContext> {
  const prompt = `
Provide contextual explanation for an international reader living in Finland:
Article Title: ${draft.title}
Article Content: ${draft.body}
Reader Familiarity Level: ${familiarityLevel}

Identify key Finnish terms, institutions, or cultural background in the article and explain them simply.
`;

  const fallbackResponse: ArticleContext = {
    explanationType: "institution",
    explanation: "This article discusses local governance and public services in Northern Finland.",
    targetFamiliarityLevel: familiarityLevel,
  };

  const result = await generateAgentStructured({
    agentName: "contextualization",
    prompt,
    systemInstruction: SYSTEM_INSTRUCTION,
    schema: ArticleContextSchema,
    fallbackResponse,
  });

  return result.data;
}
