import { describe, it, expect } from "vitest";
import { runIngestionAgent } from "../agents/ingestion";
import { runClassificationAgent } from "../agents/classification";
import { runSourceVerificationAgent } from "../agents/sourceVerification";
import { runStorySelectionAgent } from "../agents/storySelection";
import { runNewsGenerationAgent } from "../agents/newsGeneration";
import { runContentVerificationAgent } from "../agents/contentVerification";
import { runTranslationAgent } from "../agents/translation";
import { runContextualizationAgent } from "../agents/contextualization";
import { runPersonalizationAgent } from "../agents/personalization";
import { runCommunityIntelligenceAgent } from "../agents/communityIntelligence";
import { editorialWorkflowApp } from "../workflows/editorial";

describe("Gemini Multi-Agent Architecture", () => {
  const dummyCandidate = {
    id: "cand-test-1",
    title: "Oulu Quantum Lab Announced",
    summary: "A major research grant has been awarded to establish a quantum lab in Linnanmaa.",
    content: "University of Oulu faculty confirmed the Nordic grant allocation.",
    sourceName: "Kaleva RSS",
    pubDate: new Date().toISOString(),
  };

  it("Agent 1 & 2: Classification", async () => {
    const classification = await runClassificationAgent(dummyCandidate);
    expect(classification).toBeDefined();
    expect(classification.category).toBeDefined();
    expect(classification.community).toBeDefined();
  });

  it("Agent 3: Source Verification", async () => {
    const classification = await runClassificationAgent(dummyCandidate);
    const verification = await runSourceVerificationAgent(dummyCandidate, classification);
    expect(verification).toBeDefined();
    expect(verification.confidenceScore).toBeGreaterThanOrEqual(0);
  });

  it("Agent 4: Story Selection", async () => {
    const classification = await runClassificationAgent(dummyCandidate);
    const verification = await runSourceVerificationAgent(dummyCandidate, classification);
    const proposal = await runStorySelectionAgent(dummyCandidate, classification, verification);
    expect(proposal.deservesCoverage).toBe(true);
  });

  it("Agent 5 & 6: Generation & Content Verification", async () => {
    const classification = await runClassificationAgent(dummyCandidate);
    const verification = await runSourceVerificationAgent(dummyCandidate, classification);
    const proposal = await runStorySelectionAgent(dummyCandidate, classification, verification);
    const draft = await runNewsGenerationAgent(dummyCandidate, proposal, verification);
    expect(draft.title).toBeDefined();
    expect(draft.summaryBullets.length).toBeGreaterThan(0);

    const contentVerify = await runContentVerificationAgent(draft, verification);
    expect(contentVerify).toBeDefined();
  });

  it("Agent 7, 8, 9, 10: Multilingual, Context, Personalization, Community", async () => {
    const classification = await runClassificationAgent(dummyCandidate);
    const verification = await runSourceVerificationAgent(dummyCandidate, classification);
    const proposal = await runStorySelectionAgent(dummyCandidate, classification, verification);
    const draft = await runNewsGenerationAgent(dummyCandidate, proposal, verification);

    const translation = await runTranslationAgent(draft, "en");
    expect(translation.title).toBeDefined();

    const context = await runContextualizationAgent(draft, "beginner");
    expect(context.explanation).toBeDefined();

    const ranked = await runPersonalizationAgent(
      { topicInterests: ["science"], subscribedCommunities: ["Oulu Tech Hub"] },
      [{ id: "cand-test-1", title: draft.title, category: draft.category, community: draft.community, summary: draft.lead }]
    );
    expect(ranked.length).toBe(1);

    const commIntel = await runCommunityIntelligenceAgent("Oulu Tech Hub", [
      { author: "Matti", text: "When is the quantum lab opening?" },
    ]);
    expect(commIntel.communityName).toBe("Oulu Tech Hub");
  });

  it("LangGraph Editorial Workflow Compiled App", () => {
    expect(editorialWorkflowApp).toBeDefined();
  });
});
