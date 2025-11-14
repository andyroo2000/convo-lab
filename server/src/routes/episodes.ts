import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// All episode routes require authentication
router.use(requireAuth);

// Get all episodes for current user
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const episodes = await prisma.episode.findMany({
      where: { userId: req.userId },
      include: {
        dialogue: {
          include: {
            sentences: true,
            speakers: true,
          },
        },
        images: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json(episodes);
  } catch (error) {
    next(error);
  }
});

// Get single episode
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const episode = await prisma.episode.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
      include: {
        dialogue: {
          include: {
            sentences: {
              orderBy: { order: 'asc' },
            },
            speakers: true,
          },
        },
        images: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!episode) {
      throw new AppError('Episode not found', 404);
    }

    res.json(episode);
  } catch (error) {
    next(error);
  }
});

// Create new episode
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const { title, sourceText, targetLanguage, nativeLanguage } = req.body;

    if (!title || !sourceText || !targetLanguage || !nativeLanguage) {
      throw new AppError('Missing required fields', 400);
    }

    const episode = await prisma.episode.create({
      data: {
        userId: req.userId!,
        title,
        sourceText,
        targetLanguage,
        nativeLanguage,
        status: 'draft',
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
      throw new AppError('Episode not found', 404);
    }

    res.json({ message: 'Episode updated' });
  } catch (error) {
    next(error);
  }
});

// Delete episode
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const deleted = await prisma.episode.deleteMany({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
    });

    if (deleted.count === 0) {
      throw new AppError('Episode not found', 404);
    }

    res.json({ message: 'Episode deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
