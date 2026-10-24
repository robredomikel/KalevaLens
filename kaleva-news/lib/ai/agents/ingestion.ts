import RSSParser from "rss-parser";
import { sql } from "@/lib/neon";
import { NewsCandidate } from "../schemas/article";

const parser = new RSSParser();
const DEFAULT_RSS_FEEDS = [
  "https://www.kaleva.fi/feedit/rss/managed-listing/rss-maksuttomat/",
];

export async function runIngestionAgent(customFeedUrls?: string[]): Promise<NewsCandidate[]> {
  const envFeeds = process.env.NEWS_RSS_FEEDS
    ? process.env.NEWS_RSS_FEEDS.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const feedUrls = customFeedUrls && customFeedUrls.length > 0
    ? customFeedUrls
    : envFeeds.length > 0
    ? envFeeds
    : DEFAULT_RSS_FEEDS;

  const newCandidates: NewsCandidate[] = [];

  for (const feedUrl of feedUrls) {
    try {
      const feed = await parser.parseURL(feedUrl);
      const sourceName = feed.title || "Kaleva RSS";

      for (const item of feed.items) {
        if (!item.title) continue;

        // Check if candidate already exists in database
        const existing = await sql`
          SELECT id FROM "StorySubmission" WHERE title = ${item.title} LIMIT 1;
        `;

        if (existing.length === 0) {
          const candidateId = `cand-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          const candidate: NewsCandidate = {
            id: candidateId,
            title: item.title,
            summary: item.contentSnippet || item.summary || item.title || "",
            content: item.content || item.link || "",
            sourceUrl: item.link || feedUrl,
            sourceName,
            pubDate: item.pubDate || new Date().toISOString(),
          };

          newCandidates.push(candidate);
        }
      }
    } catch (err) {
      console.error(`[INGESTION AGENT] Error parsing RSS feed ${feedUrl}:`, err);
    }
  }

  return newCandidates;
}
