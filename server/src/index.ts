import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import authRoutes from './routes/auth.js';
import episodeRoutes from './routes/episodes.js';
import dialogueRoutes from './routes/dialogue.js';
import audioRoutes from './routes/audio.js';
import imageRoutes from './routes/images.js';
import { audioWorker } from './jobs/audioQueue.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.CLIENT_URL
    : 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(requestLogger);

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
