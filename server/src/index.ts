/* eslint-disable import/no-named-as-default-member */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';

import passport from './config/passport.js';
import { createRedisConnection } from './config/redis.js';
import { prisma } from './db/client.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import adminRoutes from './routes/admin.js';
import adminCourseRoutes from './routes/adminCourses.js';
import adminScriptLabRoutes from './routes/adminScriptLab.js';
import audioRoutes from './routes/audio.js';
import authRoutes from './routes/auth.js';
import billingRoutes from './routes/billing.js';
import courseRoutes from './routes/courses.js';
import dialogueRoutes from './routes/dialogue.js';
import episodeRoutes from './routes/episodes.js';
import featureFlagRoutes from './routes/featureFlags.js';
import imageRoutes from './routes/images.js';
import toolAnalyticsRoutes from './routes/toolAnalytics.js';
import toolAudioRoutes from './routes/toolAudio.js';
import verificationRoutes from './routes/verification.js';

// Workers now run in Cloud Run Job, not embedded in API service

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const SITE_URL = 'https://convo-lab.com';

interface SeoConfig {
  title: string;
  description: string;
  robots: string;
  canonicalUrl?: string;
}

const INDEXABLE_ROUTE_CONFIG: Record<string, SeoConfig> = {
  '/': {
    title: 'ConvoLab | Japanese Date, Time, Money & Counter Practice Tools',
    description:
      'Practice Japanese date, time, money, and counter reading with free furigana-friendly tools from ConvoLab.',
    robots: 'index,follow',
    canonicalUrl: `${SITE_URL}/`,
  },
  '/pricing': {
    title: 'Pricing | ConvoLab',
    description:
      'Compare ConvoLab plans for Japanese language practice, AI dialogue generation, and audio tools.',
    robots: 'index,follow',
    canonicalUrl: `${SITE_URL}/pricing`,
  },
  '/tools': {
    title: 'Japanese Learning Tools | ConvoLab',
    description:
      'Use free ConvoLab tools to practice Japanese dates, time, money, and counters with furigana-friendly quiz flows.',
    robots: 'index,follow',
    canonicalUrl: `${SITE_URL}/tools`,
  },
  '/tools/japanese-date': {
    title: 'Japanese Date Practice Tool (Furigana + Audio) | ConvoLab',
    description:
      'Practice reading Japanese dates with furigana and audio playback. Convert Gregorian dates into natural Japanese quickly.',
    robots: 'index,follow',
    canonicalUrl: `${SITE_URL}/tools/japanese-date`,
  },
  '/tools/japanese-time': {
    title: 'Japanese Time Practice Tool (Furigana + Audio) | ConvoLab',
    description:
      'Train Japanese time reading with furigana, audio playback, and interactive practice for AM/PM and 24-hour formats.',
    robots: 'index,follow',
    canonicalUrl: `${SITE_URL}/tools/japanese-time`,
  },
  '/tools/japanese-counters': {
    title: 'Japanese Counter Practice Tool (Furigana Quiz) | ConvoLab',
    description:
      'Practice Japanese counters with random object drills, ruby furigana answers, and retro textbook-style quiz cards.',
    robots: 'index,follow',
    canonicalUrl: `${SITE_URL}/tools/japanese-counters`,
  },
  '/tools/japanese-money': {
    title: 'Japanese Money Practice Tool (Receipt Style) | ConvoLab',
    description:
      'Practice Japanese yen readings with receipt-style visuals and furigana over Arabic numerals.',
    robots: 'index,follow',
    canonicalUrl: `${SITE_URL}/tools/japanese-money`,
  },
  '/tools/credits': {
    title: 'Credits | ConvoLab Tools',
    description: 'Review icon credits and source license information for ConvoLab tools.',
    robots: 'index,follow',
    canonicalUrl: `${SITE_URL}/tools/credits`,
  },
};

const NOINDEX_PREFIXES = [
  '/app',
  '/login',
  '/claim-invite',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
];

const normalizePathname = (pathname: string): string => {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.slice(0, -1);
  }
  return pathname;
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getSeoConfigForPath = (pathname: string): SeoConfig => {
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

const injectSeoMeta = (html: string, config: SeoConfig): string => {
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
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${escapeHtml(config.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(config.description)}" />`,
    config.canonicalUrl
      ? `<meta property="og:url" content="${escapeHtml(config.canonicalUrl)}" />`
      : null,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(config.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(config.description)}" />`,
  ]
    .filter(Boolean)
    .join('\n    ');

  return updatedHtml.replace('</head>', `    ${extraTags}\n  </head>`);
};

// Middleware
app.use(
  cors({
    origin:
      process.env.NODE_ENV === 'production'
        ? process.env.CLIENT_URL || true // Allow same-origin in production if CLIENT_URL not set
        : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'], // Allow both common dev ports
    credentials: true,
  })
);

// Stripe webhook needs raw body for signature verification
// Must be added BEFORE express.json()
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(passport.initialize());
app.use(requestLogger);

// Serve static files from public directory (for audio files)
app.use(express.static(path.join(__dirname, '../public')));

// Health check with Redis and Database connectivity
app.get('/health', async (_req, res) => {
  const checks = {
    redis: false,
    database: false,
  };

  let redisClient;

  try {
    // Check Redis connectivity
    redisClient = createRedisConnection();
    await redisClient.ping();
    checks.redis = true;
  } catch (error) {
    console.error('[HEALTH] Redis check failed:', error);
  } finally {
    if (redisClient) {
      redisClient.disconnect();
    }
  }

  try {
    // Check Database connectivity with a simple query
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch (error) {
    console.error('[HEALTH] Database check failed:', error);
  }

  const allHealthy = checks.redis && checks.database;
  const status = allHealthy ? 'ok' : 'degraded';
  const httpStatus = allHealthy ? 200 : 503;

  res.status(httpStatus).json({
    status,
    timestamp: new Date().toISOString(),
    checks,
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', verificationRoutes);
app.use('/api', billingRoutes);
app.use('/api/episodes', episodeRoutes);
app.use('/api/dialogue', dialogueRoutes);
app.use('/api/audio', audioRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/tools-audio', toolAudioRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/courses', adminCourseRoutes);
app.use('/api/admin/script-lab', adminScriptLabRoutes);
app.use('/api/feature-flags', featureFlagRoutes);
app.use('/api', toolAnalyticsRoutes);

// Serve client static files in production
if (process.env.NODE_ENV === 'production') {
  // In production, client files are at /app/public/client
  const clientPath = path.join('/app/public/client');
  const indexPath = path.join(clientPath, 'index.html');
  const readIndexHtml = () => fs.readFileSync(indexPath, 'utf-8');

  app.get('/tools/date', (_req, res) => {
    res.redirect(301, '/tools/japanese-date');
  });

  app.get('/tools/time', (_req, res) => {
    res.redirect(301, '/tools/japanese-time');
  });

  app.get('/tools/money', (_req, res) => {
    res.redirect(301, '/tools/japanese-money');
  });

  // Serve static files with proper cache headers
  app.use(
    express.static(clientPath, {
      setHeaders: (res, filepath) => {
        // Don't cache index.html, service worker, or manifest - always revalidate
        if (
          filepath.endsWith('index.html') ||
          filepath.includes('sw.js') ||
          filepath.includes('workbox') ||
          filepath.endsWith('manifest.webmanifest') ||
          filepath.endsWith('manifest.json')
        ) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
        // Cache hashed assets forever (they have content hashes in filenames)
        else if (
          filepath.match(/\.[a-f0-9]{8,}\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|ico|webp)$/i)
        ) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        // Cache other assets for 1 hour
        else {
          res.setHeader('Cache-Control', 'public, max-age=3600');
        }
      },
    })
  );

  // Handle client-side routing - return index.html for all non-API routes
  app.get('*', (req, res) => {
    // Always send fresh index.html with no-cache headers
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const seoConfig = getSeoConfigForPath(req.path);
    const html = injectSeoMeta(readIndexHtml(), seoConfig);
    res.type('html').send(html);
  });
}

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`🚀 LanguageFlow Studio server running on http://localhost:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  // eslint-disable-next-line no-console
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  // eslint-disable-next-line no-console
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});
