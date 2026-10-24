export type ImageSourceType =
  | 'media-content'
  | 'media-thumbnail'
  | 'enclosure'
  | 'html-content'
  | 'open-graph'
  | 'other';

export interface ArticleImage {
  url: string;
  source: ImageSourceType;
  alt?: string;
  width?: number;
  height?: number;
}

interface ImageCandidate {
  url: string;
  source: ImageSourceType;
  alt?: string;
  width?: number;
  height?: number;
  score: number;
}

const TRACKING_OR_LOGO_PATTERN = /(1x1|pixel|tracking|stat\.gif|feedburner|beacon|spinner|placeholder|favicon|avatar|icon-16|icon-32)/i;

/**
 * Decodes HTML entities commonly found in RSS text/URLs
 */
export function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, '/')
    .replace(/&nbsp;/gi, ' ');
}

/**
 * Resolves relative URLs to absolute URLs safely against a base URL
 */
export function normalizeUrl(rawUrl: string, baseUrl?: string): string | undefined {
  if (!rawUrl || typeof rawUrl !== 'string') return undefined;
  
  let cleanUrl = decodeHtmlEntities(rawUrl.trim());
  if (cleanUrl.startsWith('//')) {
    cleanUrl = `https:${cleanUrl}`;
  }

  try {
    const parsed = baseUrl ? new URL(cleanUrl, baseUrl) : new URL(cleanUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return undefined;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}

/**
 * Checks if a URL points to a tracking pixel or tiny utility icon
 */
export function isTrackingOrInvalidImage(url: string, width?: number, height?: number): boolean {
  if (!url) return true;
  if (width === 1 || height === 1) return true;
  if (width && width < 50 && height && height < 50) return true;
  if (TRACKING_OR_LOGO_PATTERN.test(url)) return true;
  return false;
}

/**
 * Parses srcset attribute and extracts the highest quality image URL candidate
 */
export function parseSrcset(srcsetStr: string, baseUrl?: string): string | undefined {
  if (!srcsetStr) return undefined;
  const entries = srcsetStr.split(',').map((entry) => entry.trim()).filter(Boolean);
  let bestUrl: string | undefined = undefined;
  let maxDescriptor = 0;

  for (const entry of entries) {
    const parts = entry.split(/\s+/);
    const urlCandidate = parts[0];
    const descriptor = parts[1];

    let numericVal = 1;
    if (descriptor) {
      if (descriptor.endsWith('w')) {
        numericVal = parseInt(descriptor.slice(0, -1), 10) || 1;
      } else if (descriptor.endsWith('x')) {
        numericVal = parseFloat(descriptor.slice(0, -1)) * 1000 || 1;
      }
    }

    const norm = normalizeUrl(urlCandidate, baseUrl);
    if (norm && numericVal > maxDescriptor) {
      maxDescriptor = numericVal;
      bestUrl = norm;
    }
  }

  return bestUrl;
}

/**
 * Helper to extract image candidates from Media RSS elements
 */
function extractMediaRssCandidates(
  mediaItems: unknown,
  sourceType: 'media-content' | 'media-thumbnail',
  baseUrl?: string
): ImageCandidate[] {
  const candidates: ImageCandidate[] = [];
  if (!mediaItems) return candidates;

  const itemsArray = Array.isArray(mediaItems) ? mediaItems : [mediaItems];

  for (const rawObj of itemsArray) {
    if (!rawObj || typeof rawObj !== 'object') continue;
    
    // Support rss-parser structure where properties may be under $
    const itemObj = rawObj as Record<string, unknown>;
    const attrs = (itemObj.$ && typeof itemObj.$ === 'object' ? itemObj.$ : itemObj) as Record<string, unknown>;
    
    const url = normalizeUrl(String(attrs.url || itemObj.url || ''), baseUrl);
    if (!url) continue;

    const medium = String(attrs.medium || itemObj.medium || '');
    const type = String(attrs.type || itemObj.type || '');
    const width = parseInt(String(attrs.width || itemObj.width || ''), 10) || undefined;
    const height = parseInt(String(attrs.height || itemObj.height || ''), 10) || undefined;

    // Reject non-image media
    if (medium && medium !== 'image') continue;
    if (type && !type.startsWith('image/')) continue;

    if (isTrackingOrInvalidImage(url, width, height)) continue;

    let score = sourceType === 'media-content' ? 80 : 60;
    if (width) {
      if (width >= 600) score += 20;
      else if (width >= 300) score += 10;
      else if (width < 200) score -= 20;
    }

    candidates.push({
      url,
      source: sourceType,
      width,
      height,
      score,
    });
  }

  return candidates;
}

/**
 * Extracts image candidates from RSS enclosure elements
 */
function extractEnclosureCandidates(enclosures: unknown, baseUrl?: string): ImageCandidate[] {
  const candidates: ImageCandidate[] = [];
  if (!enclosures) return candidates;

  const encArray = Array.isArray(enclosures) ? enclosures : [enclosures];

  for (const rawEnc of encArray) {
    if (!rawEnc || typeof rawEnc !== 'object') continue;
    const enc = rawEnc as Record<string, unknown>;
    const attrs = (enc.$ && typeof enc.$ === 'object' ? enc.$ : enc) as Record<string, unknown>;

    const url = normalizeUrl(String(attrs.url || enc.url || ''), baseUrl);
    if (!url) continue;

    const type = String(attrs.type || enc.type || '');

    // Ignore audio/video enclosures
    if (type && (type.startsWith('audio/') || type.startsWith('video/'))) {
      continue;
    }

    // Must be image type or end with image extension
    const isImageFileType = type.startsWith('image/') || /\.(jpg|jpeg|png|webp|avif|gif)(\?.*)?$/i.test(url);
    if (!isImageFileType) continue;

    if (isTrackingOrInvalidImage(url)) continue;

    candidates.push({
      url,
      source: 'enclosure',
      score: 70,
    });
  }

  return candidates;
}

/**
 * Extracts image candidates from HTML content / description tags
 */
function extractHtmlImageCandidates(htmlStr: string, baseUrl?: string): ImageCandidate[] {
  const candidates: ImageCandidate[] = [];
  if (!htmlStr) return candidates;

  const decodedHtml = decodeHtmlEntities(htmlStr);

  // Match <img> tags
  const imgRegex = /<img\s+([^>]+)>/gi;
  let match: RegExpExecArray | null;

  while ((match = imgRegex.exec(decodedHtml)) !== null) {
    const attrString = match[1];

    // Extract src, data-src, data-original, srcset
    const srcMatch = attrString.match(/src=["']([^"']+)["']/i);
    const dataSrcMatch = attrString.match(/data-src=["']([^"']+)["']/i);
    const dataOrigMatch = attrString.match(/data-original=["']([^"']+)["']/i);
    const srcsetMatch = attrString.match(/srcset=["']([^"']+)["']/i);
    const altMatch = attrString.match(/alt=["']([^"']*)["']/i);
    const widthMatch = attrString.match(/width=["']?(\d+)["']?/i);
    const heightMatch = attrString.match(/height=["']?(\d+)["']?/i);

    const width = widthMatch ? parseInt(widthMatch[1], 10) : undefined;
    const height = heightMatch ? parseInt(heightMatch[1], 10) : undefined;
    const alt = altMatch ? altMatch[1] : undefined;

    let targetUrl: string | undefined;

    if (srcsetMatch && srcsetMatch[1]) {
      targetUrl = parseSrcset(srcsetMatch[1], baseUrl);
    }

    if (!targetUrl && dataOrigMatch && dataOrigMatch[1]) {
      targetUrl = normalizeUrl(dataOrigMatch[1], baseUrl);
    }

    if (!targetUrl && dataSrcMatch && dataSrcMatch[1]) {
      targetUrl = normalizeUrl(dataSrcMatch[1], baseUrl);
    }

    if (!targetUrl && srcMatch && srcMatch[1]) {
      targetUrl = normalizeUrl(srcMatch[1], baseUrl);
    }

    if (!targetUrl) continue;

    if (isTrackingOrInvalidImage(targetUrl, width, height)) continue;

    candidates.push({
      url: targetUrl,
      source: 'html-content',
      alt,
      width,
      height,
      score: 50,
    });
  }

  return candidates;
}

/**
 * Bounded Open Graph / Page Metadata Fallback
 */
export async function fetchPageOpenGraphImage(articleUrl: string, timeoutMs = 1500): Promise<ArticleImage | undefined> {
  const normArticleUrl = normalizeUrl(articleUrl);
  if (!normArticleUrl) return undefined;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(normArticleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebkit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) return undefined;

    const html = await response.text();

    // Search og:image, twitter:image, link rel="image_src"
    const ogMatch = html.match(/<meta[^>]+property=["']og:image(?::url)?["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::url)?["']/i);

    const twitterMatch = html.match(/<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i);

    const linkImageSrc = html.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i);

    const rawCandidateUrl = ogMatch?.[1] || twitterMatch?.[1] || linkImageSrc?.[1];
    if (!rawCandidateUrl) return undefined;

    const finalUrl = normalizeUrl(rawCandidateUrl, normArticleUrl);
    if (finalUrl && !isTrackingOrInvalidImage(finalUrl)) {
      return {
        url: finalUrl,
        source: 'open-graph',
      };
    }
  } catch {
    // Network or timeout failure - non-blocking return
  }

  return undefined;
}

/**
 * Centralized Article Image Extraction Utility
 */
export async function extractArticleImage(
  item: Record<string, unknown>,
  options: {
    baseUrl?: string;
    rawXmlSnippet?: string;
    allowOgFallback?: boolean;
  } = {}
): Promise<ArticleImage | undefined> {
  const baseUrl = options.baseUrl || (typeof item.link === 'string' ? item.link : undefined);
  const candidates: ImageCandidate[] = [];

  // 1. Media RSS (mediaContent, mediaThumbnail, mediaGroup)
  if (item.mediaContent) {
    candidates.push(...extractMediaRssCandidates(item.mediaContent, 'media-content', baseUrl));
  }
  if (item.mediaThumbnail) {
    candidates.push(...extractMediaRssCandidates(item.mediaThumbnail, 'media-thumbnail', baseUrl));
  }
  if (item.mediaGroup && typeof item.mediaGroup === 'object') {
    const group = item.mediaGroup as Record<string, unknown>;
    if (group.mediaContent) {
      candidates.push(...extractMediaRssCandidates(group.mediaContent, 'media-content', baseUrl));
    }
    if (group.mediaThumbnail) {
      candidates.push(...extractMediaRssCandidates(group.mediaThumbnail, 'media-thumbnail', baseUrl));
    }
  }

  // 2. Enclosures
  if (item.enclosure) {
    candidates.push(...extractEnclosureCandidates(item.enclosure, baseUrl));
  }

  // 3. Embedded HTML in content:encoded, content, description, summary, or rawXmlSnippet
  const htmlSources = [
    String(item['content:encoded'] || ''),
    String(item.content || ''),
    String(item.description || ''),
    String(item.summary || ''),
    String(options.rawXmlSnippet || ''),
  ];

  for (const html of htmlSources) {
    if (html) {
      candidates.push(...extractHtmlImageCandidates(html, baseUrl));
    }
  }

  // Pick highest scoring candidate
  if (candidates.length > 0) {
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    return {
      url: best.url,
      source: best.source,
      alt: best.alt,
      width: best.width,
      height: best.height,
    };
  }

  // 4. Bounded Open Graph / Page Metadata Fallback
  if (options.allowOgFallback !== false && baseUrl) {
    const ogImage = await fetchPageOpenGraphImage(baseUrl);
    if (ogImage) {
      return ogImage;
    }
  }

  return undefined;
}
