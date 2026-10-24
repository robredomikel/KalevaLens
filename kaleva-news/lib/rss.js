import { ingestAllRSSFeeds } from '@/lib/news/ingestion';

export async function fetchAndAutoPublishRSS(force = false) {
  try {
    const result = await ingestAllRSSFeeds(force);
    return {
      success: true,
      message: `RSS feeds synced successfully! Inserted ${result.newArticlesInserted} new articles, skipped ${result.duplicatesSkipped} duplicates.`,
      result,
    };
  } catch (error) {
    console.error('Error auto-publishing RSS feeds:', error);
    return { success: false, error: error.message };
  }
}
