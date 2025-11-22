import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { chunkPackQueue } from '../jobs/chunkPackQueue.js';
import { JLPTLevel, ChunkPackTheme, CHUNK_THEMES } from '../config/chunkThemes.js';

const router = Router();

// All chunk pack routes require authentication
router.use(requireAuth);

/**
 * GET /api/chunk-packs
 * Get all chunk packs for current user
 */
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const isLibraryMode = req.query.library === 'true';
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    // Library mode: Return minimal data for card display
    if (isLibraryMode) {
      const packs = await prisma.chunkPack.findMany({
        where: { userId: req.userId },
        select: {
          id: true,
          title: true,
          theme: true,
          jlptLevel: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              examples: true,
              stories: true,
              exercises: true,
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

    // Full mode: Return complete data with chunks
    const packs = await prisma.chunkPack.findMany({
      where: { userId: req.userId },
      include: {
        chunks: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: {
            examples: true,
            stories: true,
            exercises: true,
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

/**
 * GET /api/chunk-packs/:id
 * Get single chunk pack with full details
 */
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const pack = await prisma.chunkPack.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
      include: {
        chunks: {
          orderBy: { order: 'asc' },
          include: {
            examples: {
              orderBy: { order: 'asc' },
            },
          },
        },
        examples: {
          orderBy: { order: 'asc' },
        },
        stories: {
          include: {
            segments: {
              orderBy: { order: 'asc' },
            },
          },
        },
        exercises: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!pack) {
      throw new AppError('Chunk pack not found', 404);
    }

    res.json(pack);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/chunk-packs/generate
 * Create and generate new chunk pack
 */
router.post('/generate', async (req: AuthRequest, res, next) => {
  try {
    const { jlptLevel, theme } = req.body;

    // Validate inputs
    if (!jlptLevel || !theme) {
      throw new AppError('JLPT level and theme are required', 400);
    }

    const validJlptLevels: JLPTLevel[] = ['N5', 'N4', 'N3'];
    if (!validJlptLevels.includes(jlptLevel)) {
      throw new AppError('Invalid JLPT level. Must be N5, N4, or N3', 400);
    }

    // Validate theme exists and matches level
    const themeMetadata = CHUNK_THEMES[theme as ChunkPackTheme];
    if (!themeMetadata) {
      throw new AppError('Invalid theme', 400);
    }

    if (themeMetadata.level !== jlptLevel) {
      throw new AppError(
        `Theme "${themeMetadata.name}" is for ${themeMetadata.level} level, but you selected ${jlptLevel}`,
        400
      );
    }

    // Add job to queue
    const job = await chunkPackQueue.add('generate', {
      userId: req.userId!,
      jlptLevel,
      theme,
    });

    res.json({
      jobId: job.id,
      message: 'Chunk pack generation started',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/chunk-packs/job/:jobId
 * Get job status and progress
 */
router.get('/job/:jobId', async (req: AuthRequest, res, next) => {
  try {
    const { jobId } = req.params;
    const job = await chunkPackQueue.getJob(jobId);

    if (!job) {
      throw new AppError('Job not found', 404);
    }

    const state = await job.getState();
    const progress = job.progress;
    const result = job.returnvalue;

    res.json({
      jobId: job.id,
      state,
      progress,
      result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/chunk-packs/:id/create-nl-session
 * Create a Narrow Listening session from a chunk pack story
 */
router.post('/:id/create-nl-session', async (req: AuthRequest, res, next) => {
  try {
    const pack = await prisma.chunkPack.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
      include: {
        chunks: true,
        stories: {
          include: {
            segments: true,
          },
        },
      },
    });

    if (!pack) {
      throw new AppError('Chunk pack not found', 404);
    }

    if (pack.status !== 'ready') {
      throw new AppError('Chunk pack is not ready yet', 400);
    }

    if (pack.stories.length === 0) {
      throw new AppError('Chunk pack has no story', 400);
    }

    // Use the first story for NL session
    const story = pack.stories[0];

    // Create topic description from chunks
    const chunkForms = pack.chunks.map(c => c.form).join(', ');
    const topic = `Story from chunk pack: ${pack.title}. Target chunks: ${chunkForms}`;

    // Import narrowListeningQueue
    const { narrowListeningQueue } = await import('../jobs/narrowListeningQueue.js');

    // Create NL pack in database
    const nlPack = await prisma.narrowListeningPack.create({
      data: {
        userId: req.userId!,
        title: `${pack.title} - Narrow Listening`,
        topic,
        jlptLevel: pack.jlptLevel,
        grammarFocus: chunkForms,
        status: 'generating',
      },
    });

    // Add job to queue
    const job = await narrowListeningQueue.add('generate', {
      packId: nlPack.id,
      topic,
      jlptLevel: pack.jlptLevel,
      versionCount: 4,
      grammarFocus: chunkForms,
    });

    res.json({
      nlPackId: nlPack.id,
      jobId: job.id,
      message: 'Narrow Listening session creation started',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/chunk-packs/:id
 * Delete a chunk pack
 */
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const pack = await prisma.chunkPack.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
    });

    if (!pack) {
      throw new AppError('Chunk pack not found', 404);
    }

    await prisma.chunkPack.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Chunk pack deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
