import RSSParser from 'rss-parser';
import { sql } from '@/lib/neon';

const parser = new RSSParser();
const KALEVA_RSS_URL = 'https://www.kaleva.fi/feedit/rss/managed-listing/rss-maksuttomat/';

export async function fetchAndAutoPublishRSS() {
  try {
    const feed = await parser.parseURL(KALEVA_RSS_URL);
    
    for (const item of feed.items) {
      // Check if story already exists by title to prevent duplicate entries
      const existing = await sql`
        SELECT id FROM "StorySubmission" WHERE title = ${item.title} LIMIT 1;
      `;

      if (existing.length === 0) {
        // Insert new RSS items directly into the PUBLISHED stage for instant live viewing
        await sql`
          INSERT INTO "StorySubmission" (
            title, 
            summary, 
            content, 
            community, 
            category, 
            "authorId", 
            stage, 
            priority
          ) VALUES (
            ${item.title || 'Untitled'},
            ${item.contentSnippet || item.summary || item.title || ''},
            ${item.content || item.link || ''},
            'Oulu',
            'Kaleva RSS',
            'rss-system',
            'PUBLISHED',
            0
          );
        `;
      }
    }
    return { success: true, message: 'RSS feed synced successfully!' };
  } catch (error) {
    console.error('Error auto-publishing Kaleva RSS:', error);
    return { success: false, error: error.message };
  }
}
