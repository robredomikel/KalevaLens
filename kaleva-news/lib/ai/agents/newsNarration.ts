import { generateAgentStructured } from "../generate";
import { NarrationScript, NarrationScriptSchema, MediaArticle } from "@/lib/media/types";

export async function runNewsNarrationAgent(article: MediaArticle, targetSeconds = 90): Promise<{ script: NarrationScript; model: string }> {
  const maxWords = Math.max(35, Math.floor(targetSeconds * 2));
  const words = [article.summary, article.content].filter(Boolean).join(" ").split(/\s+/).slice(0, 900).join(" ");
  const fallback: NarrationScript = {
    articleId: article.canonicalId,
    language: article.language,
    narrationTitle: article.title,
    introduction: article.summary || article.title,
    mainExplanation: words || article.title,
    practicalImplications: "Follow the original publisher for updates and practical guidance.",
    conclusion: `This AI-generated explanation is based on reporting by ${article.sourceName}.`,
    sourceReferences: [article.sourceUrl || article.sourceName],
    estimatedDurationSeconds: Math.max(15, Math.min(targetSeconds, Math.ceil(words.split(/\s+/).length / 2.4))),
    scriptVersion: "v1",
  };
  const prompt = `Create a local-news spoken explanation in ${article.language} using no more than ${maxWords} total spoken words across introduction, mainExplanation, practicalImplications, and conclusion. Synthesize the full supplied information instead of merely reading the displayed summary. Explain what happened, why it matters, who is affected, and practical consequences for people in Finland. Use only supplied facts. Never invent quotes or details. Preserve attribution. Shorter is better than exceeding ${targetSeconds} seconds.\n\nTitle: ${article.title}\nDisplayed summary: ${article.summary}\nFull authorized article information: ${article.content}\nContext: ${article.context || "None"}\nPublisher: ${article.sourceName}\nOriginal: ${article.sourceUrl || "Not supplied"}`;
  const result = await generateAgentStructured({
    agentName: "newsNarration",
    prompt,
    systemInstruction: "You are a neutral Finnish local-news presenter. Return structured JSON. Do not reproduce source text verbatim or add unsupported claims.",
    schema: NarrationScriptSchema,
    responseJsonSchema: {
      type: "object",
      additionalProperties: false,
      required: ["articleId", "language", "narrationTitle", "introduction", "mainExplanation", "practicalImplications", "conclusion", "sourceReferences", "estimatedDurationSeconds", "scriptVersion"],
      properties: {
        articleId: { type: "string" },
        language: { type: "string" },
        narrationTitle: { type: "string" },
        introduction: { type: "string" },
        mainExplanation: { type: "string" },
        practicalImplications: { type: "string" },
        conclusion: { type: "string" },
        sourceReferences: { type: "array", items: { type: "string" } },
        estimatedDurationSeconds: { type: "number" },
        scriptVersion: { type: "string" },
      },
    },
    fallbackResponse: fallback,
  });
  return { script: result.data, model: result.model };
}

export function narrationText(script: NarrationScript) {
  return [script.introduction, script.mainExplanation, script.practicalImplications, script.conclusion].filter(Boolean).join("\n\n");
}

export function createSummaryNarration(article: MediaArticle, maxSeconds = 30): NarrationScript {
  const maxWords = Math.max(20, Math.floor(maxSeconds * 2));
  const words = (article.summary || article.title).trim().split(/\s+/).filter(Boolean);
  const spokenSummary = words.slice(0, maxWords).join(" ");
  return {
    articleId: article.canonicalId,
    language: article.language,
    narrationTitle: article.title,
    introduction: "",
    mainExplanation: spokenSummary,
    practicalImplications: "",
    conclusion: "",
    sourceReferences: [article.sourceUrl || article.sourceName],
    estimatedDurationSeconds: Math.min(maxSeconds, Math.max(1, Math.ceil(Math.min(words.length, maxWords) / 2))),
    scriptVersion: "summary-v1",
  };
}
