import { describe, expect, it } from 'vitest';
import {
  extractArticleImage,
  decodeHtmlEntities,
  normalizeUrl,
  isTrackingOrInvalidImage,
  parseSrcset,
} from '../extractArticleImage';

describe('Centralized Image Extraction Utility', () => {
  it('decodes HTML entities correctly', () => {
    expect(decodeHtmlEntities('https://example.com/test?a=1&amp;b=2')).toBe('https://example.com/test?a=1&b=2');
    expect(decodeHtmlEntities('&lt;img src=&quot;test.jpg&quot;&gt;')).toBe('<img src="test.jpg">');
  });

  it('normalizes relative and protocol-relative URLs against base URL', () => {
    expect(normalizeUrl('//cdn.example.com/image.jpg')).toBe('https://cdn.example.com/image.jpg');
    expect(normalizeUrl('/images/photo.png', 'https://news.org/articles/1')).toBe('https://news.org/images/photo.png');
    expect(normalizeUrl('invalid-url-$$$')).toBeUndefined();
  });

  it('filters out tracking pixels and tiny icons', () => {
    expect(isTrackingOrInvalidImage('https://example.com/tracking/1x1.gif')).toBe(true);
    expect(isTrackingOrInvalidImage('https://example.com/stat.gif?id=123')).toBe(true);
    expect(isTrackingOrInvalidImage('https://example.com/hero.jpg', 800, 600)).toBe(false);
  });

  it('parses srcset attribute and selects highest descriptor URL', () => {
    const srcset = 'small.jpg 300w, medium.jpg 600w, large.jpg 1200w';
    const best = parseSrcset(srcset, 'https://example.com/');
    expect(best).toBe('https://example.com/large.jpg');
  });

  it('extracts image from media:content', async () => {
    const item = {
      mediaContent: [
        { $: { url: 'https://example.com/media.jpg', width: '800', medium: 'image' } },
      ],
    };
    const extracted = await extractArticleImage(item, { allowOgFallback: false });
    expect(extracted?.url).toBe('https://example.com/media.jpg');
    expect(extracted?.source).toBe('media-content');
  });

  it('extracts image from media:thumbnail', async () => {
    const item = {
      mediaThumbnail: [
        { $: { url: 'https://example.com/thumb.jpg', width: '300' } },
      ],
    };
    const extracted = await extractArticleImage(item, { allowOgFallback: false });
    expect(extracted?.url).toBe('https://example.com/thumb.jpg');
    expect(extracted?.source).toBe('media-thumbnail');
  });

  it('extracts valid image enclosure while ignoring audio/video enclosures', async () => {
    const audioItem = {
      enclosure: { url: 'https://example.com/podcast.mp3', type: 'audio/mpeg' },
    };
    const audioExtracted = await extractArticleImage(audioItem, { allowOgFallback: false });
    expect(audioExtracted).toBeUndefined();

    const imageItem = {
      enclosure: { url: 'https://example.com/photo.jpg', type: 'image/jpeg' },
    };
    const imageExtracted = await extractArticleImage(imageItem, { allowOgFallback: false });
    expect(imageExtracted?.url).toBe('https://example.com/photo.jpg');
    expect(imageExtracted?.source).toBe('enclosure');
  });

  it('extracts image from HTML content and lazy-loaded attributes', async () => {
    const item = {
      content: '<p>Article text</p><img data-src="https://example.com/lazy.webp" alt="Lazy image" />',
    };
    const extracted = await extractArticleImage(item, { allowOgFallback: false });
    expect(extracted?.url).toBe('https://example.com/lazy.webp');
    expect(extracted?.source).toBe('html-content');
    expect(extracted?.alt).toBe('Lazy image');
  });
});
