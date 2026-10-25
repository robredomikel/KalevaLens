// List of your 5 local ad photos from the adData folder
// (Make sure these match your exact filenames inside public/ads/ or your assets folder)
const AD_POSTERS = [
  {
    id: 'ad-1',
    title: 'Oulu Tech Conference',
    image: '/1792904157897.png', // Update with your actual filename
    sponsor: 'Oulu Tech Hub',
    cta: 'Order Now 🚀'
  },
  {
    id: 'ad-2',
    title: 'Organic Market & Local Bakery',
    image: '/1792906155690.png',
    sponsor: 'Northern Harvest',
    cta: 'Join US 🍏'
  },
  {
    id: 'ad-3',
    title: 'Developer Community Meetup',
    image: '/1792906332018.png',
    sponsor: 'Nordic Coders',
    cta: 'Visit Us 💻'
  },
  {
    id: 'ad-4',
    title: 'Northern Lights Cultural Festival',
    image: '/1792906472059.png',
    sponsor: 'Oulu Tourism',
    cta: 'Book Now ✨'
  },
  {
    id: 'ad-5',
    title: 'Northern Innovation Awards',
    image: '/1792906472059.png',
    sponsor: 'Business Oulu',
    cta: 'Learn More 🌟'
  }
];

/**
 * Injected randomly and spaced out (every 4-6 items) to prevent clustering.
 */
export function injectAdsIntoFeed(articles) {
  if (!Array.isArray(articles) || articles.length === 0) return articles;

  const feedWithAds = [...articles];
  let adIndex = 0;

  // Start injecting after index 3, spacing out every 5 items
  for (let i = 3; i < feedWithAds.length; i += 5) {
    const currentAd = AD_POSTERS[adIndex % AD_POSTERS.length];
    
    const adTile = {
      id: `sponsored-${currentAd.id}-${i}`,
      isAd: true,
      title: currentAd.title,
      // summary: [`Sponsored advertisement presented by ${currentAd.sponsor}. Discover exclusive offers and local events in Oulu today.`],
      imageUrl: currentAd.image,
      category: 'Sponsored',
      cta: currentAd.cta
    };

    feedWithAds.splice(i, 0, adTile);
    adIndex++;
  }

  return feedWithAds;
}
