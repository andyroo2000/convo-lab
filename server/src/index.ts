import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import passport from './config/passport.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { createRedisConnection } from './config/redis.js';
import { prisma } from './db/client.js';
import authRoutes from './routes/auth.js';
import verificationRoutes from './routes/verification.js';
import billingRoutes from './routes/billing.js';
import episodeRoutes from './routes/episodes.js';
import dialogueRoutes from './routes/dialogue.js';
import audioRoutes from './routes/audio.js';
import imageRoutes from './routes/images.js';
import courseRoutes from './routes/courses.js';
import narrowListeningRoutes from './routes/narrowListening.js';
import piRoutes from './routes/pi.js';
import chunkPackRoutes from './routes/chunkPacks.js';
import adminRoutes from './routes/admin.js';
import featureFlagRoutes from './routes/featureFlags.js';

// Workers now run in Cloud Run Job, not embedded in API service

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(
  cors({
    origin:
      process.env.NODE_ENV === 'production'
        ? process.env.CLIENT_URL || true // Allow same-origin in production if CLIENT_URL not set
        : 'http://localhost:5173',
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
app.get('/health', async (req, res) => {
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
app.use('/api/courses', courseRoutes);
app.use('/api/narrow-listening', narrowListeningRoutes);
app.use('/api/pi', piRoutes);
app.use('/api/chunk-packs', chunkPackRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/feature-flags', featureFlagRoutes);

// Serve client static files in production
if (process.env.NODE_ENV === 'production') {
  // In production, client files are at /app/public/client
  const clientPath = path.join('/app/public/client');
  app.use(express.static(clientPath));

  // Handle client-side routing - return index.html for all non-API routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 LanguageFlow Studio server running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});
