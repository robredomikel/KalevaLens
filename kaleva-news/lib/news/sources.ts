export interface ContentPermissions {
  allowFullContentDisplay: boolean;
  allowAIAutoTranslation: boolean;
  allowSummaryDisplay: boolean;
  requireSourceAttribution: boolean;
  maxExcerptLength: number;
  allowImageDisplay: boolean;
}

export type SourceClassification = 'local' | 'finnish' | 'european' | 'international';

export interface RSSSourceConfig {
  id: string;
  publisher: string;
  url: string;
  focus: string;
  language: string;
  defaultCategory: string;
  classification: SourceClassification;
  enabled: boolean;
  priority: number;
  permissions: ContentPermissions;
}

export const KALEVA_PERMISSIONS: ContentPermissions = {
  allowFullContentDisplay: true,
  allowAIAutoTranslation: true,
  allowSummaryDisplay: true,
  requireSourceAttribution: true,
  maxExcerptLength: 5000,
  allowImageDisplay: true,
};

export const DEFAULT_THIRD_PARTY_PERMISSIONS: ContentPermissions = {
  allowFullContentDisplay: false,
  allowAIAutoTranslation: true,
  allowSummaryDisplay: true,
  requireSourceAttribution: true,
  maxExcerptLength: 300,
  allowImageDisplay: true,
};

export const RSS_SOURCES_REGISTRY: RSSSourceConfig[] = [
  // A. Kaleva — Primary Local News Source
  {
    id: 'kaleva-free',
    publisher: 'Kaleva',
    url: 'https://www.kaleva.fi/feedit/rss/managed-listing/rss-maksuttomat/',
    focus: 'Oulu / Northern Finland',
    language: 'fi',
    defaultCategory: 'Local News',
    classification: 'local',
    enabled: true,
    priority: 100,
    permissions: KALEVA_PERMISSIONS,
  },

  // B. Finnish and Regional News — Yle
  {
    id: 'yle-north-ostrobothnia',
    publisher: 'Yle',
    url: 'https://yle.fi/rss/t/18-148154/fi',
    focus: 'Northern Ostrobothnia',
    language: 'fi',
    defaultCategory: 'Local News',
    classification: 'local',
    enabled: true,
    priority: 85,
    permissions: DEFAULT_THIRD_PARTY_PERMISSIONS,
  },
  {
    id: 'yle-english',
    publisher: 'Yle',
    url: 'https://yle.fi/rss/news',
    focus: 'Finland',
    language: 'en',
    defaultCategory: 'Finnish Society',
    classification: 'finnish',
    enabled: true,
    priority: 85,
    permissions: DEFAULT_THIRD_PARTY_PERMISSIONS,
  },
  {
    id: 'yle-science',
    publisher: 'Yle',
    url: 'https://yle.fi/rss/t/18-819/fi',
    focus: 'Finland',
    language: 'fi',
    defaultCategory: 'Science',
    classification: 'finnish',
    enabled: true,
    priority: 75,
    permissions: DEFAULT_THIRD_PARTY_PERMISSIONS,
  },
  {
    id: 'yle-culture',
    publisher: 'Yle',
    url: 'https://yle.fi/rss/t/18-150067/fi',
    focus: 'Finland',
    language: 'fi',
    defaultCategory: 'Culture',
    classification: 'finnish',
    enabled: true,
    priority: 75,
    permissions: DEFAULT_THIRD_PARTY_PERMISSIONS,
  },
  {
    id: 'yle-selkouutiset',
    publisher: 'Yle',
    url: 'https://yle.fi/rss/selkouutiset',
    focus: 'Finland',
    language: 'fi-selko',
    defaultCategory: 'Education',
    classification: 'finnish',
    enabled: true,
    priority: 90,
    permissions: DEFAULT_THIRD_PARTY_PERMISSIONS,
  },

  // C. The Guardian
  {
    id: 'guardian-world',
    publisher: 'The Guardian',
    url: 'https://www.theguardian.com/world/rss',
    focus: 'World',
    language: 'en',
    defaultCategory: 'International News',
    classification: 'international',
    enabled: true,
    priority: 70,
    permissions: DEFAULT_THIRD_PARTY_PERMISSIONS,
  },
  {
    id: 'guardian-science',
    publisher: 'The Guardian',
    url: 'https://www.theguardian.com/science/rss',
    focus: 'International',
    language: 'en',
    defaultCategory: 'Science',
    classification: 'international',
    enabled: true,
    priority: 70,
    permissions: DEFAULT_THIRD_PARTY_PERMISSIONS,
  },
  {
    id: 'guardian-technology',
    publisher: 'The Guardian',
    url: 'https://www.theguardian.com/uk/technology/rss',
    focus: 'International',
    language: 'en',
    defaultCategory: 'Technology',
    classification: 'international',
    enabled: true,
    priority: 70,
    permissions: DEFAULT_THIRD_PARTY_PERMISSIONS,
  },
  {
    id: 'guardian-europe',
    publisher: 'The Guardian',
    url: 'https://www.theguardian.com/world/europe-news/rss',
    focus: 'Europe',
    language: 'en',
    defaultCategory: 'International News',
    classification: 'european',
    enabled: true,
    priority: 75,
    permissions: DEFAULT_THIRD_PARTY_PERMISSIONS,
  },

  // D. BBC News
  {
    id: 'bbc-world',
    publisher: 'BBC News',
    url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    focus: 'World',
    language: 'en',
    defaultCategory: 'International News',
    classification: 'international',
    enabled: true,
    priority: 80,
    permissions: DEFAULT_THIRD_PARTY_PERMISSIONS,
  },
  {
    id: 'bbc-technology',
    publisher: 'BBC News',
    url: 'https://feeds.bbci.co.uk/news/technology/rss.xml',
    focus: 'International',
    language: 'en',
    defaultCategory: 'Technology',
    classification: 'international',
    enabled: true,
    priority: 75,
    permissions: DEFAULT_THIRD_PARTY_PERMISSIONS,
  },
  {
    id: 'bbc-science',
    publisher: 'BBC News',
    url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml',
    focus: 'International',
    language: 'en',
    defaultCategory: 'Environment',
    classification: 'international',
    enabled: true,
    priority: 75,
    permissions: DEFAULT_THIRD_PARTY_PERMISSIONS,
  },

  // E. Deutsche Welle
  {
    id: 'dw-english',
    publisher: 'Deutsche Welle',
    url: 'https://rss.dw.com/rdf/rss-en-all',
    focus: 'Germany / Europe',
    language: 'en',
    defaultCategory: 'International News',
    classification: 'european',
    enabled: true,
    priority: 70,
    permissions: DEFAULT_THIRD_PARTY_PERMISSIONS,
  },

  // F. Euronews
  {
    id: 'euronews-latest',
    publisher: 'Euronews',
    url: 'https://www.euronews.com/rss',
    focus: 'Europe',
    language: 'en',
    defaultCategory: 'International News',
    classification: 'european',
    enabled: true,
    priority: 70,
    permissions: DEFAULT_THIRD_PARTY_PERMISSIONS,
  },

  // G. Al Jazeera
  {
    id: 'aljazeera-english',
    publisher: 'Al Jazeera',
    url: 'https://www.aljazeera.com/xml/rss/all.xml',
    focus: 'International',
    language: 'en',
    defaultCategory: 'International News',
    classification: 'international',
    enabled: true,
    priority: 65,
    permissions: DEFAULT_THIRD_PARTY_PERMISSIONS,
  },

  // H. Sky News
  {
    id: 'skynews-world',
    publisher: 'Sky News',
    url: 'https://feeds.skynews.com/feeds/rss/world.xml',
    focus: 'World',
    language: 'en',
    defaultCategory: 'International News',
    classification: 'international',
    enabled: true,
    priority: 65,
    permissions: DEFAULT_THIRD_PARTY_PERMISSIONS,
  },
];

export function getEnabledRSSSources(): RSSSourceConfig[] {
  return RSS_SOURCES_REGISTRY.filter((s) => s.enabled);
}

export function getRSSSourceById(id: string): RSSSourceConfig | undefined {
  return RSS_SOURCES_REGISTRY.find((s) => s.id === id);
}
