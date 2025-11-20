import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import authRoutes from './routes/auth.js';
import episodeRoutes from './routes/episodes.js';
import dialogueRoutes from './routes/dialogue.js';
import audioRoutes from './routes/audio.js';
import imageRoutes from './routes/images.js';
import courseRoutes from './routes/courses.js';
import narrowListeningRoutes from './routes/narrowListening.js';
import piRoutes from './routes/pi.js';
import chunkPackRoutes from './routes/chunkPacks.js';
import { audioWorker } from './jobs/audioQueue.js';
import { courseWorker } from './jobs/courseQueue.js';
import { narrowListeningWorker } from './jobs/narrowListeningQueue.js';
import { chunkPackWorker } from './jobs/chunkPackQueue.js';

// Initialize workers (reference them so they're not tree-shaken)
console.log('Workers initialized:', { audioWorker, courseWorker, narrowListeningWorker, chunkPackWorker });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.CLIENT_URL || true  // Allow same-origin in production if CLIENT_URL not set
    : 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(requestLogger);

// Serve static files from public directory (for audio files)
app.use(express.static(path.join(__dirname, '../public')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/episodes', episodeRoutes);
app.use('/api/dialogue', dialogueRoutes);
app.use('/api/audio', audioRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/narrow-listening', narrowListeningRoutes);
app.use('/api/pi', piRoutes);
app.use('/api/chunk-packs', chunkPackRoutes);

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
