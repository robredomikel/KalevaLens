import RSSParser from 'rss-parser';
import { RSSSourceConfig } from './sources';
import { extractArticleImage } from './extractArticleImage';

export interface NormalizedRSSItem {
  guid: string;
  url: string;
  title: string;
  summary: string;
  content: string;
  pubDate: string;
  sourceId: string;
  publisher: string;
  language: string;
  defaultCategory: string;
  classification: string;
  imageUrl?: string;
  hasFullContent: boolean;
  contentAccessLevel: 'FULL_ARTICLE' | 'SUMMARY_ONLY';
}

export interface FeedValidationResult {
  sourceId: string;
  publisher: string;
  url: string;
  accessible: boolean;
  itemCount: number;
  originalLanguage: string;
  availableMetadataFields: string[];
  lastChecked: string;
  error?: string;
}

const parser = new RSSParser({
  timeout: 6000,
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: true }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: true }],
      ['media:group', 'mediaGroup'],
      ['enclosure', 'enclosure', { keepArray: true }],
      ['content:encoded', 'contentEncoded'],
    ],
  },
});

function sanitizeHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function fetchAndParseSource(
  source: RSSSourceConfig
): Promise<{ items: NormalizedRSSItem[]; validation: FeedValidationResult }> {
  const timestamp = new Date().toISOString();

  try {
    const feed = await parser.parseURL(source.url);

    const itemPromises = (feed.items || []).map(async (rawItem) => {
      const item = (rawItem as unknown) as Record<string, unknown>;
      const titleStr = typeof item.title === 'string' ? item.title.trim() : String(item.title || '').trim();
      if (!titleStr) return null;

      const rawSummary = String(item.contentSnippet || item.summary || item.description || '');
      const cleanSummary = sanitizeHtml(rawSummary) || sanitizeHtml(titleStr);
      
      const rawContent = String(item['content:encoded'] || item.content || '');
      const cleanContent = sanitizeHtml(rawContent);

      const isKaleva = source.id.startsWith('kaleva');
      const hasFullContent = isKaleva || (cleanContent.length > 500 && source.permissions.allowFullContentDisplay);
      const contentAccessLevel: 'FULL_ARTICLE' | 'SUMMARY_ONLY' = hasFullContent ? 'FULL_ARTICLE' : 'SUMMARY_ONLY';

      const guid = String(item.guid || item.id || item.link || `${source.id}-${titleStr}`);
      const url = String(item.link || source.url);
      
      const extractedImageObj = await extractArticleImage(item, {
        baseUrl: url,
        rawXmlSnippet: rawContent || rawSummary,
        allowOgFallback: source.permissions.allowImageDisplay !== false,
      });
      const imageUrl = extractedImageObj?.url;
      const pubDateVal = item.pubDate ? new Date(String(item.pubDate)).toISOString() : timestamp;

      return {
        guid,
        url,
        title: titleStr,
        summary: cleanSummary,
        content: hasFullContent ? (cleanContent || cleanSummary) : cleanSummary,
        pubDate: pubDateVal,
        sourceId: source.id,
        publisher: source.publisher,
        language: source.language,
        defaultCategory: source.defaultCategory,
        classification: source.classification,
        imageUrl,
        hasFullContent,
        contentAccessLevel,
      } as NormalizedRSSItem;
    });

    const parsedResults = await Promise.all(itemPromises);
    const parsedItems: NormalizedRSSItem[] = parsedResults.filter((item): item is NormalizedRSSItem => item !== null);

    const availableFields = new Set<string>();
    if (parsedItems.length > 0) {
      availableFields.add('title');
      availableFields.add('link');
      if (parsedItems.some((i) => i.guid)) availableFields.add('guid');
      if (parsedItems.some((i) => i.summary)) availableFields.add('summary');
      if (parsedItems.some((i) => i.pubDate)) availableFields.add('pubDate');
      if (parsedItems.some((i) => i.imageUrl)) availableFields.add('imageUrl');
    }

    return {
      items: parsedItems,
      validation: {
        sourceId: source.id,
        publisher: source.publisher,
        url: source.url,
        accessible: true,
        itemCount: parsedItems.length,
        originalLanguage: source.language,
        availableMetadataFields: Array.from(availableFields),
        lastChecked: timestamp,
      },
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      items: [],
      validation: {
        sourceId: source.id,
        publisher: source.publisher,
        url: source.url,
        accessible: false,
        itemCount: 0,
        originalLanguage: source.language,
        availableMetadataFields: [],
        lastChecked: timestamp,
        error: errorMessage,
      },
    };
  }
}
