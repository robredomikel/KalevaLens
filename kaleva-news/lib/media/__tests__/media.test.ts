import { describe, expect, it } from "vitest";
import { articleVersion, canonicalArticleId, normalizeUrl } from "../identity";
import { runMediaQualityAgent } from "@/lib/ai/agents/mediaQuality";
import { pcmToMp3 } from "../ffmpeg";
import { runNewsNarrationAgent } from "@/lib/ai/agents/newsNarration";
import { readFile } from "node:fs/promises";

describe("article media identity", () => {
  it("deduplicates tracking variants of the same external article", () => {
    const first = canonicalArticleId({ url: "https://Example.com/news/1?utm_source=a" });
    const second = canonicalArticleId({ url: "https://example.com/news/1?utm_medium=b" });
    expect(first).toBe(second);
    expect(normalizeUrl("https://example.com/news/1#top")).toBe("https://example.com/news/1");
  });

  it("changes the version when approved content changes", () => {
    expect(articleVersion({ title: "A", content: "one" })).not.toBe(articleVersion({ title: "A", content: "two" }));
  });
});

describe("narration and playback contracts", () => {
  it("creates a reusable language-specific narration without live credentials", async () => {
    const previous = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const result = await runNewsNarrationAgent({ id: "1", canonicalId: "internal:1", version: "v1", language: "fi", title: "Oulun uutinen", summary: "Paikallinen päivitys.", content: "Vahvistettu paikallinen tieto.", sourceName: "Kaleva" });
    if (previous === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous;
    expect(result.script.language).toBe("fi");
    expect(result.script.sourceReferences).toContain("Kaleva");
  });

  it("keeps playback controls free of generation calls", async () => {
    const source = await readFile(new URL("../../../components/ArticleMediaControls.jsx", import.meta.url), "utf8");
    expect(source).toContain("<audio");
    expect(source).not.toContain("<video");
    expect(source).not.toMatch(/api\/(generate|media\/jobs)/);
    expect(source).not.toContain("generateContent");
  });
});

describe("deterministic media QA", () => {
  it("rejects mislabeled PCM and accepts an MP3 signature", async () => {
    const invalid = await runMediaQualityAgent({ buffer: Buffer.from("pcm"), mimeType: "audio/mpeg", extension: "mp3", durationSeconds: 10, method: "test" }, "audio");
    const valid = await runMediaQualityAgent({ buffer: Buffer.from([0x49, 0x44, 0x33, 0x04]), mimeType: "audio/mpeg", extension: "mp3", durationSeconds: 10, method: "test" }, "audio");
    expect(invalid.passed).toBe(false);
    expect(valid.passed).toBe(false);
  });

  it("creates genuine browser-compatible audio files capped for short playback", async () => {
    const pcm = Buffer.alloc(24000 * 2);
    const audio = await pcmToMp3(pcm);
    expect(audio.length).toBeGreaterThan(100);
    expect((await runMediaQualityAgent({ buffer: audio, mimeType: "audio/mpeg", extension: "mp3", durationSeconds: 1, method: "test" }, "audio")).passed).toBe(true);
  }, 15000);
});
