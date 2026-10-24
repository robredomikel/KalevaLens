import { generateAgentStructured } from "../generate";
import { CanonicalArticleDraft, ArticleTranslation, ArticleTranslationSchema } from "../schemas/article";

const SYSTEM_INSTRUCTION = `
You are a professional multilingual news translator for Kaleva Media in Finland.
Translate the news article accurately into the target language while preserving factual accuracy, proper names, dates, numbers, and quotations.
If target language is Finnish and practice mode is requested (e.g., 'simplified' or 'translation'), adapt the text appropriately for language learners.
`;

export async function runTranslationAgent(
  draft: CanonicalArticleDraft,
  targetLanguage: string,
  finnishPracticeMode?: "simplified" | "translation" | "original" | null
): Promise<ArticleTranslation> {
  const prompt = `
Translate this article:
Title: ${draft.title}
Summary Bullets: ${JSON.stringify(draft.summaryBullets)}
Body: ${draft.body}

Target Language: ${targetLanguage}
${targetLanguage === "fi" && finnishPracticeMode ? `Finnish Practice Mode: ${finnishPracticeMode} (use easy, accessible Finnish vocabulary and clear sentences for language learners)` : ""}

Return structured translation adhering strictly to schema.
`;

  const fallbackResponse: ArticleTranslation = {
    language: targetLanguage,
    title: draft.title,
    summaryBullets: draft.summaryBullets,
    body: draft.body,
  };

  const result = await generateAgentStructured({
    agentName: "translation",
    prompt,
    systemInstruction: SYSTEM_INSTRUCTION,
    schema: ArticleTranslationSchema,
    fallbackResponse,
  });

  return result.data;
}
