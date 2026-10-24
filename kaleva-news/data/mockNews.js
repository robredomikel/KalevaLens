// data/mockNews.js

export const mockSectionsData = {
  'outside': [
    { 
      id: 'o1', 
      category: 'Global Wire', 
      community: 'Reuters', 
      title: 'Global Tech Giants Announce New Cross-Border AI Standards', 
      summary: [
        'Major international firms agree on strict data privacy and sharing protocols.',
        'Independent security audits will become mandatory for all public-facing models.',
        'European regulators praise the framework as a step toward safe innovation.'
      ], 
      readTime: '2 min read' 
    },
    { 
      id: 'o2', 
      category: 'Nordic Markets', 
      community: 'Nordic Business Report', 
      title: 'Nordic Clean Energy Investments Hit Record High in Q3', 
      summary: [
        'Cross-border green energy grids see a 40% surge in institutional backing.',
        'Finland and Sweden lead regional development in hydrogen storage technology.',
        'Experts predict further expansion into northern manufacturing corridors.'
      ], 
      readTime: '1.5 min read' 
    }
  ],

  'my-news': [
    { 
      id: 'm1', 
      category: 'Oulu Local', 
      community: 'Kaleva Personal', 
      title: 'Oulu Innovation Alliance Announces €10M New Tech Grants', 
      summary: [
        'Oulu region sees a massive surge in tech and startup investments this quarter.',
        'Local authorities announce new sustainable public transit integration plans.',
        'Kaleva cultural festival sets record-breaking attendance numbers downtown.'
      ], 
      readTime: '1 min read' 
    },
    { 
      id: 'm2', 
      category: 'Nordic Culture', 
      community: 'Kaleva Personal', 
      title: 'Winter Season Festivals Prepare for Historic International Crowds', 
      summary: [
        'Tourism boards launch digital-first guides to attract travelers from Central Europe.',
        'Traditional winter markets expand their footprint into the central market square.',
        'Hotels report near 90% booking volumes ahead of the upcoming holiday season.'
      ], 
      readTime: '1 min read' 
    }
  ],

  'communities': {
    'Oulu Tech Hub': {
      'verified': [
        { 
          id: 'cv1', 
          category: 'Verified Community', 
          community: 'Oulu Tech Hub', 
          title: 'New Deep Tech Incubator Opens Doors in Karjasilta', 
          summary: [
            'Over 20 early-stage software and hardware teams have secured collaborative office space.',
            'Direct mentorship programs sponsored by regional enterprise leaders.',
            'Grant funding applications open for next semester starting in November.'
          ], 
          readTime: '1 min read' 
        },
        { 
          id: 'cv1-b', 
          category: 'Verified Community', 
          community: 'Oulu Tech Hub', 
          title: 'University of Oulu Unveils 6G Testbed Phase 2 Expansion', 
          summary: [
            'New laboratories equipped with state-of-the-art millimeter wave transmitters.',
            'Partnerships confirmed with key European telecom equipment manufacturers.',
            'Open house scheduled for local engineering students next Thursday.'
          ], 
          readTime: '1.5 min read' 
        }
      ],
      'unverified': [
        { 
          id: 'cu1', 
          category: 'Citizen Scoop', 
          community: 'Oulu Tech Hub', 
          title: 'Rumors Swirl Regarding Major Semiconductor Plant Expansion', 
          summary: [
            'Local engineering circles whisper about upcoming multi-shift factory expansions.',
            'Unconfirmed reports hint at a partnership with international chip designers.',
            'No official press release or corporate confirmation has been issued yet.'
          ], 
          readTime: '45 sec read' 
        }
      ]
    },
    'Northern Photographers': {
      'verified': [
        { 
          id: 'cv2', 
          category: 'Verified Community', 
          community: 'Northern Photographers', 
          title: 'Annual Aurora Borealis Gallery Exhibition Announced for November', 
          summary: [
            'Top local photographers showcase rare high-definition night-sky captures.',
            'Special workshop scheduled for mobile astrophotography techniques.',
            'Gallery entry is completely free for students, youth, and senior citizens.'
          ], 
          readTime: '1 min read' 
        }
      ],
      'unverified': [
        { 
          id: 'cu2', 
          category: 'Citizen Scoop', 
          community: 'Northern Photographers', 
          title: 'Best Kept Secret Locations for Drone Sunset Shots Over Nallikari', 
          summary: [
            'A community member shares GPS coordinates for optimal golden hour reflections.',
            'Reminders posted regarding local airspace restrictions and wind speed safety.',
            'Brisk discussion follows regarding winter battery drain management.'
          ], 
          readTime: '1 min read' 
        }
      ]
    },
    'Oulu Food & Culture': {
      'verified': [
        { 
          id: 'cv3', 
          category: 'Verified Community', 
          community: 'Oulu Food & Culture', 
          title: 'Winter Restaurant Week Highlights Local Arctic Ingredients', 
          summary: [
            'Over fifteen downtown dining spots commit to locally sourced foraging menus.',
            'Special tasting passes available through regional tourism apps.',
            'Culinary judges praise the innovation in traditional fish and berry recipes.'
          ], 
          readTime: '1.2 min read' 
        }
      ],
      'unverified': [
        { 
          id: 'cu3', 
          category: 'Citizen Scoop', 
          community: 'Oulu Food & Culture', 
          title: 'Pop-up Artisan Bakery Causing Long Morning Queues', 
          summary: [
            'Word of mouth brings crowds to a small basement bakery near Rotuaari.',
            'Locals claim their sourdough is the best north of Helsinki.',
            'Sells out daily within the first two hours of opening.'
          ], 
          readTime: '30 sec read' 
        }
      ]
    }
  },

  'published': [
    { 
      id: 'p1', 
      category: 'My Story', 
      community: 'Self-Published', 
      title: 'My Take on Oulu’s Rapidly Growing Student Startup Ecosystem', 
      summary: [
        'Why local campus incubators are fundamentally changing the game for young founders.',
        'Exclusive interview insights drawn from discussions with university entrepreneurs.',
        'A call to action for stronger angel investor networks in Northern Finland.'
      ], 
      readTime: '1.5 min read' 
    }
  ]
};
