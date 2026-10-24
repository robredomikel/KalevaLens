import { NextResponse } from 'next/server';
import { RSS_SOURCES_REGISTRY } from '@/lib/news/sources';
import { getRSSFeedLogs } from '@/lib/news/ingestion';

export async function GET() {
  try {
    const feedLogs = await getRSSFeedLogs();
    return NextResponse.json({
      success: true,
      sources: RSS_SOURCES_REGISTRY.map((s) => ({
        id: s.id,
        publisher: s.publisher,
        url: s.url,
        classification: s.classification,
        enabled: s.enabled,
        permissions: s.permissions,
      })),
      feedLogs,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
