import { Router } from 'express';

import { prisma } from '../db/client.js';
import i18next from '../i18n/index.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { blockDemoUser } from '../middleware/demoAuth.js';
import { AppError } from '../middleware/errorHandler.js';

import { listLearningOsEpisodes, showLearningOsEpisode } from './learningOs/episodes.js';

const router = Router();

// All episode routes require authentication
router.use(requireAuth);

// Get all episodes for current user (demo users see admin's content)
router.get('/', listLearningOsEpisodes);

// Get single episode (demo users can view admin's episodes)
router.get('/:id', showLearningOsEpisode);

// Create new episode (blocked for demo users)
router.post('/', blockDemoUser, async (req: AuthRequest, res, next) => {
  try {
    const {
      title,
      sourceText,
      targetLanguage,
      nativeLanguage,
      audioSpeed = 'medium',
      jlptLevel,
      autoGenerateAudio,
    } = req.body;

    if (!title || !sourceText || !targetLanguage || !nativeLanguage) {
      throw new AppError(i18next.t('server:content.missingFields'), 400);
    }

    if (targetLanguage !== 'ja') {
      throw new AppError(i18next.t('server:validation.invalidTargetLanguage'), 400);
    }

    if (nativeLanguage !== 'en') {
      throw new AppError(i18next.t('server:validation.invalidNativeLanguage'), 400);
    }

    if (jlptLevel) {
      const validLevels = new Set(['N5', 'N4', 'N3', 'N2', 'N1']);
      if (!validLevels.has(jlptLevel)) {
        throw new AppError(i18next.t('server:validation.invalidJlptLevel'), 400);
      }
    }

    const episode = await prisma.episode.create({
      data: {
        userId: req.userId!,
        title,
        sourceText,
        targetLanguage,
        nativeLanguage,
        audioSpeed,
        status: 'draft',
        jlptLevel: jlptLevel || null,
        autoGenerateAudio: typeof autoGenerateAudio === 'boolean' ? autoGenerateAudio : true,
      },
    });

    res.json(episode);
  } catch (error) {
    next(error);
  }
});

// Update episode
router.patch('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { title, status } = req.body;

    const episode = await prisma.episode.updateMany({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
      data: {
        ...(title && { title }),
        ...(status && { status }),
        updatedAt: new Date(),
      },
    });

    if (episode.count === 0) {
      throw new AppError(i18next.t('server:content.notFound', { type: 'Episode' }), 404);
    }

    res.json({ message: i18next.t('server:content.updateSuccess', { type: 'Episode' }) });
  } catch (error) {
    next(error);
  }
});

// Delete episode (blocked for demo users)
router.delete('/:id', blockDemoUser, async (req: AuthRequest, res, next) => {
  try {
    const deleted = await prisma.episode.deleteMany({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
    });

    if (deleted.count === 0) {
      throw new AppError(i18next.t('server:content.notFound', { type: 'Episode' }), 404);
    }

    res.json({ message: i18next.t('server:content.deleteSuccess', { type: 'Episode' }) });
  } catch (error) {
    next(error);
  }
});

export default router;
