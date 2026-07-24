/* eslint-disable import/no-named-as-default-member */
import './env.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import cors from 'cors';
import express from 'express';

import { LEGACY_REDIRECTS, getSeoConfigForPath, injectSeoMeta } from '../../shared/seo.mjs';

import {
  getAllowedBrowserOrigins,
  validateProductionBrowserRuntimeConfig,
} from './config/browserRuntime.js';
import { createRedisConnection } from './config/redis.js';
import { prisma } from './db/client.js';
import { errorHandler } from './middleware/errorHandler.js';
import { enforceDefaultRequestBodyTimeout } from './middleware/requestBodyTimeout.js';
import { requestLogger } from './middleware/requestLogger.js';
import { warmKanjiumAccentIndex } from './services/pitchAccent/kanjiumData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

validateProductionBrowserRuntimeConfig();

const app = express();
const PORT = process.env.PORT || 3001;
const IMPORT_UPLOAD_REQUEST_TIMEOUT_MS = 31 * 60 * 1000;

// Middleware
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      callback(null, getAllowedBrowserOrigins().includes(origin));
    },
    credentials: true,
  })
);

app.use(enforceDefaultRequestBodyTimeout());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

app.use((req, res, next) => {
  if (req.path === '/study-media' || req.path.startsWith('/study-media/')) {
    res.status(404).end();
    return;
  }

  next();
});

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

app.use('/api', (_req, res) => {
  res.status(404).json({ error: { message: 'Not found' } });
});

// Serve client static files in production
if (process.env.NODE_ENV === 'production') {
  // In production, client files are at /app/public/client
  const clientPath = path.join('/app/public/client');
  const indexPath = path.join(clientPath, 'index.html');
  const readIndexHtml = () => fs.readFileSync(indexPath, 'utf-8');

  for (const [source, target] of Object.entries(LEGACY_REDIRECTS)) {
    app.get(source, (_req, res) => {
      res.redirect(301, target);
    });
  }

  app.get('/index.html', (_req, res) => {
    res.redirect(308, '/');
  });

  // Serve static files with proper cache headers
  app.use(
    express.static(clientPath, {
      // Route every HTML document through the SPA fallback so SEO metadata is injected
      // consistently, including when the browser first loads "/".
      index: false,
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

const server = app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`🚀 LanguageFlow Studio server running on http://localhost:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  void warmKanjiumAccentIndex().catch((error) => {
    // eslint-disable-next-line no-console
    console.warn('[Pitch accent] Kanjium accent index warm-up failed:', error);
  });
});

// Node's requestTimeout cannot be scoped per route, so middleware restores the 5-minute
// body deadline everywhere except the import upload path.
server.requestTimeout = IMPORT_UPLOAD_REQUEST_TIMEOUT_MS;

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
