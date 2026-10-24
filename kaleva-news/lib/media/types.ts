import { z } from "zod";

export const NarrationScriptSchema = z.object({
  articleId: z.string(),
  language: z.string().min(2),
  narrationTitle: z.string(),
  introduction: z.string(),
  mainExplanation: z.string(),
  practicalImplications: z.string(),
  conclusion: z.string(),
  sourceReferences: z.array(z.string()),
  estimatedDurationSeconds: z.number().positive(),
  scriptVersion: z.string(),
});

export type NarrationScript = z.infer<typeof NarrationScriptSchema>;
export type MediaType = "audio";
export type MediaStatus = "pending" | "processing" | "ready" | "failed" | "retrying" | "cancelled";

export interface MediaArticle {
  id: string;
  canonicalId: string;
  version: string;
  title: string;
  summary: string;
  content: string;
  sourceName: string;
  sourceUrl?: string | null;
  publishedAt?: string | Date | null;
  language: string;
  context?: string | null;
}

export interface ProducedMedia {
  buffer: Buffer;
  mimeType: string;
  extension: string;
  durationSeconds: number;
  model?: string;
  method: string;
  voice?: string;
}
