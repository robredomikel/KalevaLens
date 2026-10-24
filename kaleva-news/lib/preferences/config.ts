export const SUPPORTED_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "fi", label: "Finnish" },
  { value: "sv", label: "Swedish" },
  { value: "es", label: "Spanish" },
  { value: "ar", label: "Arabic" },
  { value: "other", label: "Other language" },
] as const;

export const LANGUAGE_LEVELS = [
  { value: "A1", label: "A1 - Beginner (Basic phrases & simple sentences)" },
  { value: "A2", label: "A2 - Elementary (Everyday basic expressions)" },
  { value: "B1", label: "B1 - Intermediate (Main points of clear standard input)" },
  { value: "B2", label: "B2 - Upper Intermediate (Complex texts & main ideas)" },
  { value: "C1", label: "C1 - Advanced (Fluent, flexible & structured expression)" },
] as const;

export const ARTICLE_LENGTHS = [
  { value: "short", label: "Short", words: 70 },
  { value: "standard", label: "Standard", words: 150 },
  { value: "detailed", label: "Detailed", words: 300 },
] as const;

export type UserPreferences = {
  // Onboarding Profile Fields
  preferredLanguage: string;
  preferredLanguageLevel: "A1" | "A2" | "B1" | "B2" | "C1";
  customLanguage?: string;
  finnishPracticeFrequency: "none" | "occasionally" | "regularly";
  finnishPracticeMode: "translation" | "simplified" | "original" | null;
  userSituation: string;
  timeInFinland: string;
  finnishSocietyFamiliarity: "beginner" | "basic" | "intermediate" | "advanced";
  topicInterests: string[];
  newsGoals: string[];
  contextLevel: "brief" | "balanced" | "detailed" | "adaptive";
  discoveryOpenness: number;
  onboardingCompleted: boolean;
  onboardingCompletedAt?: string | null;

  // Legacy/Derived preference compatibility
  audioLanguage: string;
  articleLanguage: string;
  articleLength: string;
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  preferredLanguage: "en",
  preferredLanguageLevel: "B2",
  customLanguage: "",
  finnishPracticeFrequency: "none",
  finnishPracticeMode: null,
  userSituation: "Working professional",
  timeInFinland: "6 months – 2 years",
  finnishSocietyFamiliarity: "basic",
  topicInterests: [],
  newsGoals: [],
  contextLevel: "balanced",
  discoveryOpenness: 50,
  onboardingCompleted: false,
  onboardingCompletedAt: null,

  audioLanguage: "en",
  articleLanguage: "en",
  articleLength: "standard",
};

export function normalizePreferences(value: Partial<UserPreferences> = {}): UserPreferences {
  const prefLang = String(value.preferredLanguage || value.articleLanguage || DEFAULT_PREFERENCES.preferredLanguage);
  const langLevel = ["A1", "A2", "B1", "B2", "C1"].includes(String(value.preferredLanguageLevel))
    ? (String(value.preferredLanguageLevel) as UserPreferences["preferredLanguageLevel"])
    : DEFAULT_PREFERENCES.preferredLanguageLevel;

  const practiceFreq = ["none", "occasionally", "regularly"].includes(String(value.finnishPracticeFrequency))
    ? (String(value.finnishPracticeFrequency) as UserPreferences["finnishPracticeFrequency"])
    : DEFAULT_PREFERENCES.finnishPracticeFrequency;

  const practiceMode = practiceFreq === "none"
    ? null
    : ["translation", "simplified", "original"].includes(String(value.finnishPracticeMode))
    ? (String(value.finnishPracticeMode) as UserPreferences["finnishPracticeMode"])
    : "translation";

  const familiarity = ["beginner", "basic", "intermediate", "advanced"].includes(String(value.finnishSocietyFamiliarity))
    ? (String(value.finnishSocietyFamiliarity) as UserPreferences["finnishSocietyFamiliarity"])
    : DEFAULT_PREFERENCES.finnishSocietyFamiliarity;

  const ctxLevel = ["brief", "balanced", "detailed", "adaptive"].includes(String(value.contextLevel))
    ? (String(value.contextLevel) as UserPreferences["contextLevel"])
    : DEFAULT_PREFERENCES.contextLevel;

  const openness = typeof value.discoveryOpenness === "number" && !isNaN(value.discoveryOpenness)
    ? Math.max(0, Math.min(100, Math.round(value.discoveryOpenness)))
    : DEFAULT_PREFERENCES.discoveryOpenness;

  const topicInterests = Array.isArray(value.topicInterests) ? value.topicInterests.map(String) : [];
  const newsGoals = Array.isArray(value.newsGoals) ? value.newsGoals.map(String) : [];

  // Map context level to legacy articleLength
  const articleLength = ctxLevel === "brief" ? "short" : ctxLevel === "detailed" ? "detailed" : "standard";

  return {
    preferredLanguage: prefLang,
    preferredLanguageLevel: langLevel,
    customLanguage: value.customLanguage ? String(value.customLanguage) : "",
    finnishPracticeFrequency: practiceFreq,
    finnishPracticeMode: practiceMode,
    userSituation: value.userSituation ? String(value.userSituation) : DEFAULT_PREFERENCES.userSituation,
    timeInFinland: value.timeInFinland ? String(value.timeInFinland) : DEFAULT_PREFERENCES.timeInFinland,
    finnishSocietyFamiliarity: familiarity,
    topicInterests,
    newsGoals,
    contextLevel: ctxLevel,
    discoveryOpenness: openness,
    onboardingCompleted: Boolean(value.onboardingCompleted),
    onboardingCompletedAt: value.onboardingCompletedAt ? String(value.onboardingCompletedAt) : null,

    audioLanguage: prefLang === "other" ? "en" : prefLang,
    articleLanguage: prefLang === "other" ? "en" : prefLang,
    articleLength,
  };
}

export function audioScriptVersion() {
  return "grounded-30s-v2";
}
