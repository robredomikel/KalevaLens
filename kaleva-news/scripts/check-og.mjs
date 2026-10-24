const urlsToTest = [
  { publisher: 'Yle', url: 'https://yle.fi/a/74-20252871?origin=rss' },
  { publisher: 'Deutsche Welle', url: 'https://www.dw.com/en/german-national-facing-trial-for-alleged-attempt-to-join-is/a-79751032?maca=en-rss-en-all-1573-rdf' },
  { publisher: 'Euronews', url: 'https://www.euronews.com/video/2026/10/24/latest-news-bulletin-october-24th-2026-evening' },
  { publisher: 'Al Jazeera', url: 'https://www.aljazeera.com/news/2026/10/24/more-than-2000-forced-from-homes-in-hebron-amid-israels-west-bank-raids?traffic_source=rss' },
];

async function checkOpenGraph(publisher, url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebkit/537.36' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const html = await res.text();

    const ogImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const twitterImage = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);

    console.log(`\nPublisher: ${publisher}`);
    console.log(`URL: ${url}`);
    console.log(`og:image:`, ogImage ? ogImage[1] : 'NONE');
    console.log(`twitter:image:`, twitterImage ? twitterImage[1] : 'NONE');
  } catch (err) {
    console.error(`Error checking OG for ${publisher}:`, err.message);
  }
}

async function main() {
  for (const item of urlsToTest) {
    await checkOpenGraph(item.publisher, item.url);
  }
}

main();
