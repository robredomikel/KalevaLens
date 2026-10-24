import { describe, expect, it } from 'vitest';
import { getEnabledRSSSources, RSS_SOURCES_REGISTRY, DEFAULT_THIRD_PARTY_PERMISSIONS } from '../sources';
import { fetchAndParseSource } from '../parser';
import { canonicalArticleId, articleVersion } from '@/lib/media/identity';

describe('Centralized RSS Sources Registry', () => {
  it('contains registered sources including Kaleva, Yle, Guardian, BBC, DW, Euronews, Al Jazeera, Sky', () => {
    expect(RSS_SOURCES_REGISTRY.length).toBeGreaterThanOrEqual(16);
    const publishers = new Set(RSS_SOURCES_REGISTRY.map((s) => s.publisher));
    expect(publishers.has('Kaleva')).toBe(true);
    expect(publishers.has('Yle')).toBe(true);
    expect(publishers.has('The Guardian')).toBe(true);
    expect(publishers.has('BBC News')).toBe(true);
    expect(publishers.has('Deutsche Welle')).toBe(true);
    expect(publishers.has('Euronews')).toBe(true);
    expect(publishers.has('Al Jazeera')).toBe(true);
    expect(publishers.has('Sky News')).toBe(true);
  });

  it('enforces licensing permissions: Kaleva full content allowed, third-party summary only', () => {
    const kalevaSource = RSS_SOURCES_REGISTRY.find((s) => s.id === 'kaleva-free')!;
    expect(kalevaSource.permissions.allowFullContentDisplay).toBe(true);

    const bbcSource = RSS_SOURCES_REGISTRY.find((s) => s.id === 'bbc-world')!;
    expect(bbcSource.permissions.allowFullContentDisplay).toBe(false);
    expect(bbcSource.permissions.requireSourceAttribution).toBe(true);
  });

  it('returns only enabled sources', () => {
    const enabled = getEnabledRSSSources();
    expect(enabled.every((s) => s.enabled)).toBe(true);
  });
});

describe('RSS Feed Parser and Validation', () => {
  it('gracefully handles unreachable or invalid RSS URLs without throwing', async () => {
    const fakeSource = {
      id: 'test-invalid-url',
      publisher: 'Invalid Publisher',
      url: 'https://invalid-non-existent-domain-12345.org/rss.xml',
      focus: 'Test',
      language: 'en',
      defaultCategory: 'Test',
      classification: 'international' as const,
      enabled: true,
      priority: 50,
      permissions: DEFAULT_THIRD_PARTY_PERMISSIONS,
    };

    const result = await fetchAndParseSource(fakeSource);
    expect(result.validation.accessible).toBe(false);
    expect(result.validation.error).toBeDefined();
    expect(result.items.length).toBe(0);
  });
});

describe('Article Deduplication & Versioning', () => {
  it('produces identical canonical IDs for duplicate URLs regardless of tracking params', () => {
    const id1 = canonicalArticleId({ url: 'https://example.com/news/article-123?utm_source=rss' });
    const id2 = canonicalArticleId({ url: 'https://example.com/news/article-123?utm_medium=feed' });
    expect(id1).toBe(id2);
  });

  it('produces different article versions when title or content changes', () => {
    const v1 = articleVersion({ title: 'Headline A', summary: 'Summary text' });
    const v2 = articleVersion({ title: 'Headline B', summary: 'Summary text' });
    expect(v1).not.toBe(v2);
  });
});
