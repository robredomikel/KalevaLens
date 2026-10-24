export const SUPPORTED_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "fi", label: "Finnish" },
  { value: "sv", label: "Swedish" },
] as const;

export const ARTICLE_LENGTHS = [
  { value: "short", label: "Short", words: 70 },
  { value: "standard", label: "Standard", words: 150 },
  { value: "detailed", label: "Detailed", words: 300 },
] as const;

export type UserPreferences = {
  audioLanguage: string;
  articleLanguage: string;
  articleLength: string;
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  audioLanguage: "en",
  articleLanguage: "en",
  articleLength: "standard",
};

export function normalizePreferences(value: Partial<UserPreferences> = {}): UserPreferences {
  const languages = new Set<string>(SUPPORTED_LANGUAGES.map((item) => item.value));
  const lengths = new Set<string>(ARTICLE_LENGTHS.map((item) => item.value));
  return {
    audioLanguage: languages.has(String(value.audioLanguage)) ? String(value.audioLanguage) : DEFAULT_PREFERENCES.audioLanguage,
    articleLanguage: languages.has(String(value.articleLanguage)) ? String(value.articleLanguage) : DEFAULT_PREFERENCES.articleLanguage,
    articleLength: lengths.has(String(value.articleLength)) ? String(value.articleLength) : DEFAULT_PREFERENCES.articleLength,
  };
}

export function audioScriptVersion() {
  return "grounded-30s-v2";
}
