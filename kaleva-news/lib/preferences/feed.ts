import "server-only";
import { attachMedia } from "@/lib/media/repository";
import { attachPreferredContent, getUserPreferences } from "./service";

export async function applyUserPreferences<T extends Record<string, unknown>>(articles: T[], userId?: string | null) {
  const preferences = await getUserPreferences(userId);
  const content = await attachPreferredContent(articles, preferences.articleLanguage, preferences.articleLength);
  return attachMedia(content, preferences.audioLanguage);
}
