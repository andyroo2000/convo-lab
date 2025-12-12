import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { blockDemoUser, getLibraryUserId } from '../middleware/demoAuth.js';
import { prisma } from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { narrowListeningQueue } from '../jobs/narrowListeningQueue.js';
import { triggerWorkerJob } from '../services/workerTrigger.js';

const router = Router();

// All narrow listening routes require authentication
router.use(requireAuth);

// Get all packs for current user (demo users see admin's content)
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const isLibraryMode = req.query.library === 'true';
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    // Get the appropriate user ID (demo users see admin's content)
    const queryUserId = await getLibraryUserId(req.userId!);

    // Library mode: Return minimal data for card display
    if (isLibraryMode) {
      const packs = await prisma.narrowListeningPack.findMany({
        where: { userId: queryUserId },
        select: {
          id: true,
          title: true,
          topic: true,
          targetLanguage: true,
          jlptLevel: true,
          hskLevel: true,
          cefrLevel: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              versions: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
      });

      res.json(packs);
      return;
    }

    // Full mode: Return complete data with versions and segments
    const packs = await prisma.narrowListeningPack.findMany({
      where: { userId: queryUserId },
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
      take: limit,
      skip: offset,
    });

    res.json(packs);
  } catch (error) {
    next(error);
  }
});

// Get single pack with full details (demo users can view admin's packs)
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    // Get the appropriate user ID (demo users see admin's content)
    const queryUserId = await getLibraryUserId(req.userId!);

    const pack = await prisma.narrowListeningPack.findFirst({
      where: {
        id: req.params.id,
        userId: queryUserId,
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

// Create and generate new narrow listening pack (blocked for demo users)
router.post('/generate', blockDemoUser, async (req: AuthRequest, res, next) => {
  try {
    const {
      topic,
      targetLanguage = 'ja',
      jlptLevel,
      hskLevel,
      cefrLevel,
      versionCount = 4,
      grammarFocus,
    } = req.body;

    // Validate topic
    if (!topic) {
      throw new AppError('Topic is required', 400);
    }

    // Validate target language
    const validLanguages = ['ja', 'zh', 'es', 'fr'];
    if (!validLanguages.includes(targetLanguage)) {
      throw new AppError('Invalid target language. Must be ja (Japanese), zh (Chinese), es (Spanish), or fr (French)', 400);
    }

    // Validate proficiency level based on language
    let proficiencyLevel: string;
    if (targetLanguage === 'ja') {
      if (!jlptLevel) {
        throw new AppError('JLPT level is required for Japanese', 400);
      }
      const validJlptLevels = ['N5', 'N4', 'N3', 'N2', 'N1'];
      if (!validJlptLevels.includes(jlptLevel)) {
        throw new AppError('Invalid JLPT level. Must be N5, N4, N3, N2, or N1', 400);
      }
      proficiencyLevel = jlptLevel;
    } else if (targetLanguage === 'zh') {
      if (!hskLevel) {
        throw new AppError('HSK level is required for Chinese', 400);
      }
      const validHskLevels = ['HSK1', 'HSK2', 'HSK3', 'HSK4', 'HSK5', 'HSK6'];
      if (!validHskLevels.includes(hskLevel)) {
        throw new AppError('Invalid HSK level. Must be HSK1, HSK2, HSK3, HSK4, HSK5, or HSK6', 400);
      }
      proficiencyLevel = hskLevel;
    } else if (targetLanguage === 'es') {
      if (!cefrLevel) {
        throw new AppError('CEFR level is required for Spanish', 400);
      }
      const validCefrLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
      if (!validCefrLevels.includes(cefrLevel)) {
        throw new AppError('Invalid CEFR level. Must be A1, A2, B1, B2, C1, or C2', 400);
      }
      proficiencyLevel = cefrLevel;
    } else if (targetLanguage === 'fr') {
      if (!cefrLevel) {
        throw new AppError('CEFR level is required for French', 400);
      }
      const validCefrLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
      if (!validCefrLevels.includes(cefrLevel)) {
        throw new AppError('Invalid CEFR level. Must be A1, A2, B1, B2, C1, or C2', 400);
      }
      proficiencyLevel = cefrLevel;
    } else {
      throw new AppError('Invalid target language', 400);
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
        targetLanguage,
        jlptLevel: targetLanguage === 'ja' ? jlptLevel : null,
        hskLevel: targetLanguage === 'zh' ? hskLevel : null,
        cefrLevel: targetLanguage === 'es' ? cefrLevel : null,
        grammarFocus: grammarFocus || null,
        status: 'generating',
      },
    });

    // Queue generation job
    console.log(`Adding narrow listening job to queue for pack ${pack.id}`);
    const job = await narrowListeningQueue.add('generate-narrow-listening', {
      packId: pack.id,
      topic,
      targetLanguage,
      proficiencyLevel,
      versionCount,
      grammarFocus: grammarFocus || '',
    });
    console.log(`Job ${job.id} added to queue successfully`);

    // Trigger Cloud Run Job to process the queue
    triggerWorkerJob().catch(err =>
      console.error('Worker trigger failed:', err)
    );

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
      failedReason: job.failedReason,
      stacktrace: job.stacktrace,
    });
  } catch (error) {
    next(error);
  }
});

// Generate audio at specific speed for a pack (on-demand) (blocked for demo users)
router.post('/:id/generate-speed', blockDemoUser, async (req: AuthRequest, res, next) => {
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

    // Trigger Cloud Run Job to process the queue
    triggerWorkerJob().catch(err =>
      console.error('Worker trigger failed:', err)
    );

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

// Delete pack (blocked for demo users)
router.delete('/:id', blockDemoUser, async (req: AuthRequest, res, next) => {
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
