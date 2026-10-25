import { z } from "zod";
import { generateAgentStructured } from "../generate";

const ResultSchema = z.object({
  title: z.string(),
  summary: z.array(z.string()).min(1).max(4),
  content: z.string(),
});

const wordTargets: Record<string, number> = { short: 70, standard: 150, detailed: 300 };

type SourceArticle = { title?: unknown; summary?: unknown; content?: unknown };

export async function runArticlePreferenceAgent(
  article: SourceArticle,
  language: string,
  length: string,
  languageLevel?: string
) {
  const source = String(article.content || article.summary || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const fallback = { title: String(article.title || "Untitled"), summary: [String(article.summary || source).slice(0, 500)], content: source };
  const result = await generateAgentStructured({
    agentName: "translation",
    systemInstruction: `You are a professional news editor for KalevaLens. You adapt news for readers while preserving factual accuracy, names, numbers, dates, attribution, and uncertainty. Never invent information.

When generating the summary bullets, use the 5W Journalistic Framework:
1. WHO: People, organizations, institutions, or communities involved.
2. WHAT: Central event, development, decision, or announcement.
3. WHERE: Specific geographical location.
4. WHEN: When the event occurred or will occur (do not invent missing dates).
5. WHY IT MATTERS: Significance, local societal impact, and why readers should care.

Integrate these 5 elements naturally into summary bullets. The combined total length of all summary bullets MUST be between 150 and 200 words (minimum 150 words, maximum 200 words), providing substantial text and detail in the bullet points compared to the short title. Never use labeled headings like "Who:", "What:", etc.`,
    prompt: `Rewrite this full news article in language code ${language}. Use approximately ${wordTargets[length] || 150} words for the article body (${length} length). ${languageLevel ? `Adapt vocabulary and sentence complexity to CEFR language level ${languageLevel} (A1/A2=elementary, B1/B2=intermediate, C1=advanced fluent).` : ""}

Return a concise title, summary bullets (totaling STRICTLY between 150 and 200 words in total following the 5W framework: Who, What, Where, When, Why It Matters), and the complete adapted body. Do not format bullets with labels. Give much more text and detail to the bullet points than to the title.

Title: ${article.title}
Summary: ${article.summary}
Full source: ${source}`,
    schema: ResultSchema,
    responseJsonSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        summary: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 4 },
        content: { type: "string" },
      },
      required: ["title", "summary", "content"],
    },
    fallbackResponse: fallback,
  });
  return { ...result.data, model: result.model };
}
