import { z } from "zod";
import { generateAgentStructured } from "../generate";

const ResultSchema = z.object({
  title: z.string(),
  summary: z.array(z.string()).min(1).max(4),
  content: z.string(),
});

const wordTargets: Record<string, number> = { short: 70, standard: 150, detailed: 300 };

type SourceArticle = { title?: unknown; summary?: unknown; content?: unknown };

export async function runArticlePreferenceAgent(article: SourceArticle, language: string, length: string) {
  const source = String(article.content || article.summary || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const fallback = { title: String(article.title || "Untitled"), summary: [String(article.summary || source).slice(0, 500)], content: source };
  const result = await generateAgentStructured({
    agentName: "translation",
    systemInstruction: "You adapt news for readers. Preserve every material fact, name, number, date, attribution, and uncertainty. Never invent information.",
    prompt: `Rewrite this full news article in language code ${language}. Use approximately ${wordTargets[length] || 150} words for the article body (${length} length). Return a concise title, 1-4 summary bullets, and the complete adapted body.\n\nTitle: ${article.title}\nSummary: ${article.summary}\nFull source: ${source}`,
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
