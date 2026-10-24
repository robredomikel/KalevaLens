import { RSS_SOURCES_REGISTRY } from '../lib/news/sources.ts';
import { fetchAndParseSource } from '../lib/news/parser.ts';

async function runPublisherDiagnostics() {
  console.log('=== RSS PUBLISHER IMAGE EXTRACTION DIAGNOSTIC REPORT ===\n');

  const report = [];

  for (const source of RSS_SOURCES_REGISTRY) {
    if (!source.enabled) continue;

    try {
      const { items, validation } = await fetchAndParseSource(source);
      if (!validation.accessible || items.length === 0) {
        report.push({
          publisher: source.publisher,
          sourceId: source.id,
          imageAvailable: 'No (Unreachable)',
          extractionMethod: 'N/A',
          urlExtracted: 'No',
          sampleUrl: '',
          rendering: 'Fail (Unreachable)',
        });
        continue;
      }

      // Check items
      const itemsWithImages = items.filter((i) => Boolean(i.imageUrl));
      const hasImage = itemsWithImages.length > 0;
      const sampleItem = itemsWithImages[0] || items[0];

      report.push({
        publisher: source.publisher,
        sourceId: source.id,
        imageAvailable: hasImage ? 'Yes' : 'No',
        urlExtracted: hasImage ? 'Yes' : 'No',
        sampleUrl: sampleItem.imageUrl || '',
        rendering: hasImage ? 'Pass' : 'N/A',
      });
    } catch {
      report.push({
        publisher: source.publisher,
        sourceId: source.id,
        imageAvailable: 'Error',
        extractionMethod: 'N/A',
        urlExtracted: 'No',
        sampleUrl: '',
        rendering: 'Fail',
      });
    }
  }

  console.table(report);
}

runPublisherDiagnostics();
