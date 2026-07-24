export const PUBLIC_MARKETING_SITE_URL = 'https://convo-lab.com';

export const INDEXABLE_ROUTE_CONFIG = {
  '/': {
    title: 'ConvoLab | Japanese Date, Time, Money, Counter & Verb Practice Tools',
    description:
      'Practice Japanese date, time, money, counter reading, and verb conjugation with free furigana-friendly tools from ConvoLab.',
    robots: 'index,follow',
    canonicalUrl: `${PUBLIC_MARKETING_SITE_URL}/`,
  },
  '/tools': {
    title: 'Japanese Learning Tools | ConvoLab',
    description:
      'Use free ConvoLab tools to practice Japanese dates, time, money, counters, and verb conjugation with furigana-friendly quiz flows.',
    robots: 'index,follow',
    canonicalUrl: `${PUBLIC_MARKETING_SITE_URL}/tools`,
  },
  '/tools/japanese-date': {
    title: 'Japanese Date Practice Tool (Furigana + Audio) | ConvoLab',
    description:
      'Practice reading Japanese dates with furigana and audio playback. Convert Gregorian dates into natural Japanese quickly.',
    robots: 'index,follow',
    canonicalUrl: `${PUBLIC_MARKETING_SITE_URL}/tools/japanese-date`,
  },
  '/tools/japanese-time': {
    title: 'Japanese Time Practice Tool (Furigana + Audio) | ConvoLab',
    description:
      'Train Japanese time reading with furigana, audio playback, and interactive practice for AM/PM and 24-hour formats.',
    robots: 'index,follow',
    canonicalUrl: `${PUBLIC_MARKETING_SITE_URL}/tools/japanese-time`,
  },
  '/tools/japanese-counters': {
    title: 'Japanese Counter Practice Tool (Furigana Quiz) | ConvoLab',
    description:
      'Practice Japanese counters with random object drills, ruby furigana answers, and retro textbook-style quiz cards.',
    robots: 'index,follow',
    canonicalUrl: `${PUBLIC_MARKETING_SITE_URL}/tools/japanese-counters`,
  },
  '/tools/japanese-money': {
    title: 'Japanese Large Number Reading Tool | ConvoLab',
    description:
      'Practice reading large Japanese numbers with receipt-style visuals and furigana over Arabic numerals.',
    robots: 'index,follow',
    canonicalUrl: `${PUBLIC_MARKETING_SITE_URL}/tools/japanese-money`,
  },
  '/tools/japanese-verbs': {
    title: 'Japanese Verb Conjugation Tool (N5/N4) | ConvoLab',
    description:
      'Practice Japanese verb conjugation with N5/N4 filters, verb group targeting, and textbook vs colloquial potential drills.',
    robots: 'index,follow',
    canonicalUrl: `${PUBLIC_MARKETING_SITE_URL}/tools/japanese-verbs`,
  },
  '/tools/credits': {
    title: 'Credits | ConvoLab Tools',
    description: 'Review icon credits and source license information for ConvoLab tools.',
    robots: 'index,follow',
    canonicalUrl: `${PUBLIC_MARKETING_SITE_URL}/tools/credits`,
  },
};

export const NOINDEX_PREFIXES = [
  '/app',
  '/login',
  '/claim-invite',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
];

export const LEGACY_REDIRECTS = {
  '/tools/date': '/tools/japanese-date',
  '/tools/time': '/tools/japanese-time',
  '/tools/money': '/tools/japanese-money',
};

export const normalizePathname = (pathname) => {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }

  return pathname;
};

export const escapeHtml = (value) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const getSeoConfigForPath = (pathname) => {
  const normalizedPath = normalizePathname(pathname);
  const indexableConfig = INDEXABLE_ROUTE_CONFIG[normalizedPath];
  if (indexableConfig) {
    return indexableConfig;
  }

  const shouldNoIndex = NOINDEX_PREFIXES.some(
    (prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
  );

  if (shouldNoIndex) {
    return {
      title: 'ConvoLab',
      description: 'ConvoLab language learning application.',
      robots: 'noindex,nofollow',
    };
  }

  return {
    title: 'Page Not Found | ConvoLab',
    description: 'The page you requested could not be found on ConvoLab.',
    robots: 'noindex,nofollow',
  };
};

export const injectSeoMeta = (html, config) => {
  const titleTag = `<title>${escapeHtml(config.title)}</title>`;
  const descriptionTag = `<meta name="description" content="${escapeHtml(config.description)}" />`;

  let updatedHtml = html;
  updatedHtml = updatedHtml.replace(/<title>[\s\S]*?<\/title>/i, titleTag);
  updatedHtml = updatedHtml.replace(/<meta\s+name=["']description["'][^>]*>/i, descriptionTag);

  const extraTags = [
    `<meta name="robots" content="${escapeHtml(config.robots)}" />`,
    config.canonicalUrl
      ? `<link rel="canonical" href="${escapeHtml(config.canonicalUrl)}" />`
      : null,
    '<meta property="og:type" content="website" />',
    `<meta property="og:title" content="${escapeHtml(config.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(config.description)}" />`,
    config.canonicalUrl
      ? `<meta property="og:url" content="${escapeHtml(config.canonicalUrl)}" />`
      : null,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeHtml(config.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(config.description)}" />`,
  ]
    .filter(Boolean)
    .join('\n    ');

  return updatedHtml.replace('</head>', `    ${extraTags}\n  </head>`);
};
