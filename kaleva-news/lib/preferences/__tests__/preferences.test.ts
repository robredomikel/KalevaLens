import { describe, expect, it } from "vitest";
import { normalizePreferences, DEFAULT_PREFERENCES } from "../config";
import { runTranslationAgent } from "@/lib/ai/agents/translation";
import { runArticlePreferenceAgent } from "@/lib/ai/agents/articlePreference";

describe("User Onboarding & Preferences Model", () => {
  it("normalizes default preferences correctly", () => {
    const normalized = normalizePreferences({});
    expect(normalized.preferredLanguage).toBe("en");
    expect(normalized.preferredLanguageLevel).toBe("B2");
    expect(normalized.finnishPracticeFrequency).toBe("none");
    expect(normalized.finnishPracticeMode).toBeNull();
    expect(normalized.onboardingCompleted).toBe(false);
    expect(normalized.discoveryOpenness).toBe(50);
  });

  it("handles complete onboarding preferences input", () => {
    const input = {
      preferredLanguage: "Spanish",
      preferredLanguageLevel: "B1" as const,
      customLanguage: "",
      finnishPracticeFrequency: "occasionally" as const,
      finnishPracticeMode: "simplified" as const,
      userSituation: "International student or PhD researcher",
      timeInFinland: "Less than 6 months",
      finnishSocietyFamiliarity: "beginner" as const,
      topicInterests: ["Science & technology", "Culture & traditions"],
      newsGoals: ["Understand what’s happening around me"],
      contextLevel: "detailed" as const,
      discoveryOpenness: 75,
      onboardingCompleted: true,
      onboardingCompletedAt: "2026-10-24T12:00:00.000Z",
    };

    const normalized = normalizePreferences(input);
    expect(normalized.preferredLanguage).toBe("Spanish");
    expect(normalized.preferredLanguageLevel).toBe("B1");
    expect(normalized.finnishPracticeFrequency).toBe("occasionally");
    expect(normalized.finnishPracticeMode).toBe("simplified");
    expect(normalized.userSituation).toBe("International student or PhD researcher");
    expect(normalized.finnishSocietyFamiliarity).toBe("beginner");
    expect(normalized.topicInterests).toEqual(["Science & technology", "Culture & traditions"]);
    expect(normalized.contextLevel).toBe("detailed");
    expect(normalized.articleLength).toBe("detailed");
    expect(normalized.discoveryOpenness).toBe(75);
    expect(normalized.onboardingCompleted).toBe(true);
  });

  it("sanitizes invalid or out-of-range slider values and invalid language levels", () => {
    const invalidInput = {
      discoveryOpenness: 150,
      preferredLanguageLevel: "Z9" as any,
      finnishPracticeFrequency: "invalid" as any,
    };

    const normalized = normalizePreferences(invalidInput);
    expect(normalized.discoveryOpenness).toBe(100);
    expect(normalized.preferredLanguageLevel).toBe(DEFAULT_PREFERENCES.preferredLanguageLevel);
    expect(normalized.finnishPracticeFrequency).toBe("none");
    expect(normalized.finnishPracticeMode).toBeNull();
  });

  it("invokes translation agent with CEFR language level guidelines", async () => {
    const draft = {
      title: "Oulu Tech Summit 2026",
      lead: "Annual tech conference highlights regional innovation.",
      summaryBullets: ["Annual tech conference highlights regional innovation."],
      body: "The Oulu Tech Summit brought together researchers and entrepreneurs to discuss clean tech.",
      category: "Tech",
      community: "Oulu Tech Hub",
      readTime: "1 min",
      sourceReferences: ["Kaleva"],
      claimToEvidenceMap: [{ claim: "Tech summit", evidence: "Kaleva report", verified: true }],
    };

    const result = await runTranslationAgent(draft, "en", null, "A1");
    expect(result).toBeDefined();
    expect(result.title).toBeDefined();
    expect(result.body).toBeDefined();
  }, 40000);

  it("invokes article preference agent with language level guidelines", async () => {
    const article = {
      title: "Local Cultural Festival Returns to Oulu",
      summary: "Annual autumn cultural event features regional artists and music.",
      content: "The annual Oulu autumn cultural festival opens this weekend with performances and food markets.",
    };

    const result = await runArticlePreferenceAgent(article, "fi", "short", "A2");
    expect(result).toBeDefined();
    expect(result.title).toBeDefined();
  }, 40000);
});
