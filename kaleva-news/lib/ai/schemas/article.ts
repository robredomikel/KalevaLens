import { z } from "zod";

export const NewsCandidateSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  content: z.string().optional(),
  sourceUrl: z.string().optional(),
  sourceName: z.string(),
  pubDate: z.string().optional(),
});

export type NewsCandidate = z.infer<typeof NewsCandidateSchema>;

export const ClassifiedNewsSchema = z.object({
  candidateId: z.string(),
  category: z.string(),
  community: z.string(),
  primaryLocation: z.string(),
  language: z.string(),
  urgency: z.enum(["low", "medium", "high", "breaking"]),
  readerNeeds: z.array(
    z.enum([
      "Information",
      "Understanding",
      "Usefulness",
      "Emotion",
      "Break",
      "Community",
    ])
  ),
  sensitivityScore: z.number().min(0).max(100),
  isSensitive: z.boolean(),
});

export type ClassifiedNews = z.infer<typeof ClassifiedNewsSchema>;

export const CanonicalArticleDraftSchema = z.object({
  title: z.string(),
  lead: z.string(),
  summaryBullets: z.array(z.string()).min(1).max(5),
  body: z.string(),
  category: z.string(),
  community: z.string(),
  readTime: z.string().default("2 min read"),
  sourceReferences: z.array(z.string()),
  claimToEvidenceMap: z.array(
    z.object({
      claim: z.string(),
      evidence: z.string(),
      verified: z.boolean(),
    })
  ),
});

export type CanonicalArticleDraft = z.infer<typeof CanonicalArticleDraftSchema>;

export const ArticleTranslationSchema = z.object({
  language: z.string(),
  title: z.string(),
  summaryBullets: z.array(z.string()),
  body: z.string().optional(),
});

export type ArticleTranslation = z.infer<typeof ArticleTranslationSchema>;

export const ArticleContextSchema = z.object({
  explanationType: z.enum(["institution", "culture", "politics", "practical"]),
  explanation: z.string(),
  targetFamiliarityLevel: z.string(),
});

export type ArticleContext = z.infer<typeof ArticleContextSchema>;
