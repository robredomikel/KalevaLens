import { NextResponse } from 'next/server';
import { ingestAllRSSFeeds, getRSSFeedLogs } from '@/lib/news/ingestion';

export async function GET(request: Request) {
  return handleIngestion(request);
}

export async function POST(request: Request) {
  return handleIngestion(request);
}

async function handleIngestion(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const authHeader = request.headers.get('authorization');
    const secretParam = searchParams.get('secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (expectedSecret) {
      const isHeaderValid = authHeader === `Bearer ${expectedSecret}`;
      const isParamValid = secretParam === expectedSecret;
      if (!isHeaderValid && !isParamValid) {
        return NextResponse.json({ error: 'Unauthorized: Invalid cron secret' }, { status: 401 });
      }
    }

    const result = await ingestAllRSSFeeds(true);
    const feedLogs = await getRSSFeedLogs();

    return NextResponse.json({
      success: true,
      summary: {
        timestamp: result.timestamp,
        totalSourcesProcessed: result.totalSourcesProcessed,
        totalArticlesParsed: result.totalArticlesParsed,
        newArticlesInserted: result.newArticlesInserted,
        duplicatesSkipped: result.duplicatesSkipped,
        articlesUpdated: result.articlesUpdated,
      },
      validations: result.validations,
      feedLogs,
    });
  } catch (error: unknown) {
    console.error('Cron Ingestion Endpoint Error:', error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
