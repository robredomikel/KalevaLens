import RSSParser from 'rss-parser';

const RSS_SOURCES_REGISTRY = [
  { id: 'kaleva-free', publisher: 'Kaleva', url: 'https://www.kaleva.fi/feedit/rss/managed-listing/rss-maksuttomat/' },
  { id: 'yle-north-ostrobothnia', publisher: 'Yle', url: 'https://yle.fi/rss/t/18-148154/fi' },
  { id: 'yle-english', publisher: 'Yle', url: 'https://yle.fi/rss/news' },
  { id: 'guardian-world', publisher: 'The Guardian', url: 'https://www.theguardian.com/world/rss' },
  { id: 'bbc-world', publisher: 'BBC News', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { id: 'dw-english', publisher: 'Deutsche Welle', url: 'https://rss.dw.com/rdf/rss-en-all' },
  { id: 'euronews-latest', publisher: 'Euronews', url: 'https://www.euronews.com/rss' },
  { id: 'aljazeera-english', publisher: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { id: 'skynews-world', publisher: 'Sky News', url: 'https://feeds.skynews.com/feeds/rss/world.xml' },
];

const parser = new RSSParser({
  timeout: 8000,
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

async function main() {
  console.log('=== DEBUGGING RSS SOURCES FOR IMAGE EXTRACTION ===\n');

  for (const source of RSS_SOURCES_REGISTRY) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Publisher: ${source.publisher} (${source.id})`);
    console.log(`URL: ${source.url}`);
    try {
      const feed = await parser.parseURL(source.url);
      console.log(`Total items fetched: ${feed.items?.length || 0}`);
      
      const item = feed.items?.[0];
      if (!item) {
        console.log('NO ITEMS FOUND');
        continue;
      }

      console.log(`Sample Title: ${item.title}`);
      console.log(`Sample Link: ${item.link}`);
      console.log(`Item Keys:`, Object.keys(item));
      
      if (item.enclosure) console.log(`Enclosure:`, item.enclosure);
      if (item.mediaContent) console.log(`MediaContent:`, JSON.stringify(item.mediaContent, null, 2));
      if (item.mediaThumbnail) console.log(`MediaThumbnail:`, JSON.stringify(item.mediaThumbnail, null, 2));
      if (item.mediaGroup) console.log(`MediaGroup:`, JSON.stringify(item.mediaGroup, null, 2));

      // Snippets of description & contentEncoded
      const desc = String(item.description || item.summary || '');
      const contentEnc = String(item.contentEncoded || item.content || '');
      
      console.log(`Description Snippet (first 250 chars):`, desc.substring(0, 250));
      if (contentEnc) {
        console.log(`ContentEncoded Snippet (first 250 chars):`, contentEnc.substring(0, 250));
      }

      // Quick search for img tags or url matches
      const imgMatchesInDesc = desc.match(/<img[^>]+>/gi);
      const imgMatchesInContent = contentEnc.match(/<img[^>]+>/gi);
      if (imgMatchesInDesc) console.log(`Img tags in desc:`, imgMatchesInDesc);
      if (imgMatchesInContent) console.log(`Img tags in contentEncoded:`, imgMatchesInContent);

    } catch (err) {
      console.error(`Error fetching/parsing ${source.id}:`, err.message);
    }
  }
}

main();
