import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { narrowListeningQueue } from '../jobs/narrowListeningQueue.js';

const router = Router();

// All narrow listening routes require authentication
router.use(requireAuth);

// Get all packs for current user
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const packs = await prisma.narrowListeningPack.findMany({
      where: { userId: req.userId },
      include: {
        versions: {
          orderBy: { order: 'asc' },
          include: {
            segments: {
              orderBy: { order: 'asc' },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json(packs);
  } catch (error) {
    next(error);
  }
});

// Get single pack with full details
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const pack = await prisma.narrowListeningPack.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
      include: {
        versions: {
          orderBy: { order: 'asc' },
          include: {
            segments: {
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    if (!pack) {
      throw new AppError('Narrow listening pack not found', 404);
    }

    res.json(pack);
  } catch (error) {
    next(error);
  }
});

// Create and generate new narrow listening pack
router.post('/generate', async (req: AuthRequest, res, next) => {
  try {
    const {
      topic,
      jlptLevel,
      versionCount = 4,
      grammarFocus,
    } = req.body;

    // Validate inputs
    if (!topic || !jlptLevel) {
      throw new AppError('Topic and JLPT level are required', 400);
    }

    const validJlptLevels = ['N5', 'N4', 'N3', 'N2', 'N1'];
    if (!validJlptLevels.includes(jlptLevel)) {
      throw new AppError('Invalid JLPT level. Must be N5, N4, N3, N2, or N1', 400);
    }

    if (versionCount < 3 || versionCount > 5) {
      throw new AppError('Version count must be between 3 and 5', 400);
    }

    // Create pack in draft status
    const pack = await prisma.narrowListeningPack.create({
      data: {
        userId: req.userId!,
        title: 'Generating...', // Will be updated by the job
        topic,
        jlptLevel,
        grammarFocus: grammarFocus || null,
        status: 'generating',
      },
    });

    // Queue generation job
    console.log(`Adding narrow listening job to queue for pack ${pack.id}`);
    const job = await narrowListeningQueue.add('generate-narrow-listening', {
      packId: pack.id,
      topic,
      jlptLevel,
      versionCount,
      grammarFocus: grammarFocus || '',
    });
    console.log(`Job ${job.id} added to queue successfully`);

    res.json({
      message: 'Narrow listening pack generation started',
      jobId: job.id,
      packId: pack.id,
    });
  } catch (error) {
    next(error);
  }
});

// Get job status
router.get('/job/:jobId', async (req: AuthRequest, res, next) => {
  try {
    const { jobId } = req.params;
    const job = await narrowListeningQueue.getJob(jobId);

    if (!job) {
      throw new AppError('Job not found', 404);
    }

    const state = await job.getState();
    const progress = job.progress;
    const returnvalue = job.returnvalue;

    res.json({
      state,
      progress,
      result: returnvalue,
    });
  } catch (error) {
    next(error);
  }
});

// Generate audio at specific speed for a pack (on-demand)
router.post('/:id/generate-speed', async (req: AuthRequest, res, next) => {
  try {
    const { speed } = req.body;

    // Validate speed
    if (!speed || (speed !== 0.7 && speed !== 0.85 && speed !== 1.0)) {
      throw new AppError('Invalid speed. Must be 0.7, 0.85, or 1.0', 400);
    }

    const pack = await prisma.narrowListeningPack.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
      include: {
        versions: {
          include: {
            segments: {
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    if (!pack) {
      throw new AppError('Narrow listening pack not found', 404);
    }

    // Check if audio already exists for all versions at this speed
    const audioUrlField = speed === 0.7 ? 'audioUrl_0_7' : speed === 0.85 ? 'audioUrl_0_85' : 'audioUrl_1_0';
    const allVersionsHaveSpeed = pack.versions.every(v => v[audioUrlField]);
    const speedLabel = speed === 0.7 ? '0.7x' : speed === 0.85 ? '0.85x' : '1.0x';

    if (allVersionsHaveSpeed) {
      return res.json({
        message: `${speedLabel} speed audio already exists`,
        pack,
      });
    }

    // Queue a job to generate audio at specified speed
    const job = await narrowListeningQueue.add('generate-speed', {
      packId: pack.id,
      speed,
    });

    res.json({
      message: `${speedLabel} speed audio generation started`,
      jobId: job.id,
      packId: pack.id,
      speed: speedLabel,
    });
  } catch (error) {
    next(error);
  }
});

// Delete pack
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const result = await prisma.narrowListeningPack.deleteMany({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
    });

    if (result.count === 0) {
      throw new AppError('Narrow listening pack not found', 404);
    }

    res.json({ message: 'Pack deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
