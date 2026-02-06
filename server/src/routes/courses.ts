import { DEFAULT_NARRATOR_VOICES } from '@languageflow/shared/src/constants-new.js';
import { Prisma } from '@prisma/client';
import { Router } from 'express';

import { prisma } from '../db/client.js';
import i18next from '../i18n/index.js';
import { courseQueue } from '../jobs/courseQueue.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { blockDemoUser } from '../middleware/demoAuth.js';
import { requireEmailVerified } from '../middleware/emailVerification.js';
import { AppError } from '../middleware/errorHandler.js';
import { getEffectiveUserId } from '../middleware/impersonation.js';
import { rateLimitGeneration } from '../middleware/rateLimit.js';
import { generateWithGemini } from '../services/geminiClient.js';
import { logGeneration } from '../services/usageTracker.js';
import { triggerWorkerJob } from '../services/workerTrigger.js';

const router = Router();

// All course routes require authentication
router.use(requireAuth);

// Get all courses for current user (demo users see admin's content)
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const isLibraryMode = req.query.library === 'true';
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    // Get the appropriate user ID (demo users see admin's content)
    const queryUserId = await getEffectiveUserId(req);

    // Library mode: Return minimal data for card display
    if (isLibraryMode) {
      const courses = await prisma.course.findMany({
        where: { userId: queryUserId },
        select: {
          id: true,
          title: true,
          description: true,
          targetLanguage: true,
          nativeLanguage: true,
          status: true,
          isSampleContent: true,
          jlptLevel: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              coreItems: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
      });

      res.json(courses);
      return;
    }

    // Full mode: Return complete data with coreItems and episodes
    const courses = await prisma.course.findMany({
      where: { userId: queryUserId },
      include: {
        coreItems: true,
        courseEpisodes: {
          orderBy: { order: 'asc' },
          include: {
            episode: {
              select: {
                id: true,
                title: true,
                targetLanguage: true,
                nativeLanguage: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
    });

    res.json(courses);
  } catch (error) {
    next(error);
  }
});

// Get single course with full details (demo users can view admin's courses)
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    // Get the appropriate user ID (demo users see admin's content)
    const queryUserId = await getEffectiveUserId(req);

    const course = await prisma.course.findFirst({
      where: {
        id: req.params.id,
        userId: queryUserId,
      },
      include: {
        coreItems: true,
        courseEpisodes: {
          orderBy: { order: 'asc' },
          include: {
            episode: true,
          },
        },
      },
    });

    if (!course) {
      throw new AppError(i18next.t('server:content.notFound', { type: 'Course' }), 404);
    }

    res.json(course);
  } catch (error) {
    next(error);
  }
});

// Create new course from episode(s) (blocked for demo users)
router.post('/', blockDemoUser, async (req: AuthRequest, res, next) => {
  try {
    const {
      title,
      description,
      episodeIds,
      sourceText,
      nativeLanguage,
      targetLanguage,
      maxLessonDurationMinutes = 30,
      l1VoiceId,
      jlptLevel,
      speaker1Gender = 'male',
      speaker2Gender = 'female',
      speaker1VoiceId,
      speaker2VoiceId,
    } = req.body;

    // Must provide either episodeIds or sourceText
    if (!title || (!episodeIds && !sourceText)) {
      throw new AppError(i18next.t('server:content.missingFields'), 400);
    }

    if (!nativeLanguage || !targetLanguage) {
      throw new AppError('Missing required fields: nativeLanguage, targetLanguage', 400);
    }

    // Get effective user ID (supports admin impersonation)
    const effectiveUserId = await getEffectiveUserId(req);

    // Get or create episode(s)
    let finalEpisodeIds: string[];
    let episodes: Prisma.EpisodeGetPayload<{
      include: { dialogue: true };
    }>[];

    if (sourceText) {
      // Create a new episode from sourceText
      const episode = await prisma.episode.create({
        data: {
          userId: effectiveUserId,
          title,
          sourceText,
          targetLanguage,
          nativeLanguage,
          status: 'draft',
        },
        include: {
          dialogue: true,
        },
      });
      finalEpisodeIds = [episode.id];
      episodes = [episode];
    } else {
      // Verify all episodes exist and belong to user
      episodes = await prisma.episode.findMany({
        where: {
          id: { in: episodeIds },
          userId: effectiveUserId,
        },
        include: {
          dialogue: true,
        },
      });

      if (episodes.length !== episodeIds.length) {
        throw new AppError('One or more episodes not found', 404);
      }

      finalEpisodeIds = episodeIds;
    }

    // Use default narrator voice if not provided
    // Also replace Journey voices with Neural2 equivalents (Journey doesn't support timepointing)
    let narratorVoice =
      l1VoiceId || DEFAULT_NARRATOR_VOICES[nativeLanguage as keyof typeof DEFAULT_NARRATOR_VOICES];

    // Journey voices don't support enableTimePointing - replace with Neural2 equivalents
    if (narratorVoice?.includes('Journey')) {
      const journeyToNeural2: Record<string, string> = {
        'en-US-Journey-D': 'en-US-Neural2-J',
        'en-US-Journey-F': 'en-US-Neural2-F',
      };
      narratorVoice =
        journeyToNeural2[narratorVoice] ||
        DEFAULT_NARRATOR_VOICES[nativeLanguage as keyof typeof DEFAULT_NARRATOR_VOICES];
      // eslint-disable-next-line no-console
      console.log(`[Course] Replaced Journey voice with Neural2: ${l1VoiceId} -> ${narratorVoice}`);
    }

    if (!narratorVoice) {
      throw new AppError(`No default narrator voice found for language: ${nativeLanguage}`, 400);
    }

    // Auto-generate description if not provided
    let courseDescription = description;
    if (!courseDescription) {
      try {
        const episodeTitles = episodes.map((ep) => ep.title).join(', ');
        const prompt = `Write a brief, engaging 1-2 sentence description for a Pimsleur-style audio language course based on these dialogue episodes: "${episodeTitles}".

The course teaches ${targetLanguage.toUpperCase()} to ${nativeLanguage.toUpperCase()} speakers through interactive audio lessons with spaced repetition.

Write only the description, no formatting or quotes.`;

        courseDescription = await generateWithGemini(prompt);
        courseDescription = courseDescription.trim();
      } catch (err) {
        console.error('Failed to generate course description:', err);
        // Fall back to simple description
        courseDescription = `Interactive ${targetLanguage.toUpperCase()} audio course with spaced repetition and anticipation drills.`;
      }
    }

    // Create course
    const course = await prisma.course.create({
      data: {
        userId: effectiveUserId,
        title,
        description: courseDescription || null,
        status: 'draft',
        nativeLanguage,
        targetLanguage,
        maxLessonDurationMinutes,
        l1VoiceId: narratorVoice,
        jlptLevel: jlptLevel || null,
        speaker1Gender,
        speaker2Gender,
        speaker1VoiceId: speaker1VoiceId || null,
        speaker2VoiceId: speaker2VoiceId || null,
      },
    });

    // Link episodes to course
    await Promise.all(
      finalEpisodeIds.map((episodeId: string, index: number) =>
        prisma.courseEpisode.create({
          data: {
            courseId: course.id,
            episodeId,
            order: index,
          },
        })
      )
    );

    res.json(course);
  } catch (error) {
    next(error);
  }
});

// Generate course content (lessons, scripts, audio) (blocked for demo users)
router.post(
  '/:id/generate',
  requireEmailVerified,
  rateLimitGeneration('course'),
  blockDemoUser,
  async (req: AuthRequest, res, next) => {
    try {
      // Get effective user ID (supports admin impersonation)
      const effectiveUserId = await getEffectiveUserId(req);

      // Use a transaction to atomically check and update course status
      const result = await prisma.$transaction(async (tx) => {
        // Lock the course row for this transaction
        const course = await tx.course.findFirst({
          where: {
            id: req.params.id,
            userId: effectiveUserId,
          },
        });

        if (!course) {
          throw new AppError(i18next.t('server:content.notFound', { type: 'Course' }), 404);
        }

        if (course.status === 'generating') {
          throw new AppError(
            i18next.t('server:content.alreadyGenerating', { type: 'Course' }),
            400
          );
        }

        // Check if there's already an active job for this course
        const activeJobs = await courseQueue.getJobs(['active', 'waiting', 'delayed']);
        const existingJob = activeJobs.find((j) => j.data.courseId === course.id);
        if (existingJob) {
          throw new AppError(
            i18next.t('server:content.generationInProgress', { type: 'Course' }),
            400
          );
        }

        // Update course status to 'generating' atomically
        await tx.course.update({
          where: { id: course.id },
          data: { status: 'generating' },
        });

        return course;
      });

      // Queue course generation job (outside transaction to avoid holding DB lock)
      const job = await courseQueue.add('generate-course', {
        courseId: result.id,
      });

      // Log the generation for quota tracking
      await logGeneration(req.userId!, 'course', result.id);

      // Trigger Cloud Run Job to process the queue
      triggerWorkerJob().catch((err) => console.error('Worker trigger failed:', err));

      res.json({
        message: i18next.t('server:content.generationStarted', { type: 'Course' }),
        jobId: job.id,
        courseId: result.id,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get course generation status (demo users can view admin's courses)
router.get('/:id/status', async (req: AuthRequest, res, next) => {
  try {
    // Get the appropriate user ID (demo users see admin's content)
    const queryUserId = await getEffectiveUserId(req);

    const course = await prisma.course.findFirst({
      where: {
        id: req.params.id,
        userId: queryUserId,
      },
    });

    if (!course) {
      throw new AppError(i18next.t('server:content.notFound', { type: 'Course' }), 404);
    }

    // Get active job if generating
    let jobProgress = null;
    let isStuck = false;
    if (course.status === 'generating') {
      // Try to find active job for this course
      const jobs = await courseQueue.getJobs(['active', 'waiting']);
      const activeJob = jobs.find((j) => j.data.courseId === course.id);

      if (activeJob) {
        jobProgress = activeJob.progress;
      } else {
        // No active job but status is 'generating' - course is stuck
        isStuck = true;
      }
    }

    res.json({
      status: course.status,
      progress: jobProgress,
      isStuck,
    });
  } catch (error) {
    next(error);
  }
});

// Reset stuck course (when status is 'generating' but no active job exists)
router.post('/:id/reset', async (req: AuthRequest, res, next) => {
  try {
    // Get effective user ID (supports admin impersonation)
    const effectiveUserId = await getEffectiveUserId(req);

    const course = await prisma.course.findFirst({
      where: {
        id: req.params.id,
        userId: effectiveUserId,
      },
    });

    if (!course) {
      throw new AppError(i18next.t('server:content.notFound', { type: 'Course' }), 404);
    }

    if (course.status !== 'generating') {
      throw new AppError(i18next.t('server:content.notGenerating', { type: 'Course' }), 400);
    }

    // Check if there's actually an active job
    const jobs = await courseQueue.getJobs(['active', 'waiting']);
    const activeJob = jobs.find((j) => j.data.courseId === course.id);

    if (activeJob) {
      throw new AppError(i18next.t('server:content.hasActiveJob', { type: 'Course' }), 400);
    }

    // Reset course status to draft
    await prisma.course.update({
      where: { id: course.id },
      data: { status: 'draft' },
    });

    // eslint-disable-next-line no-console
    console.log(`Reset stuck course ${course.id} from 'generating' to 'draft'`);

    res.json({
      message: 'Course reset successfully. You can now retry generation.',
      courseId: course.id,
    });
  } catch (error) {
    next(error);
  }
});

// Retry a failed course generation (re-queues from saved pipeline state)
router.post('/:id/retry', blockDemoUser, async (req: AuthRequest, res, next) => {
  try {
    const effectiveUserId = await getEffectiveUserId(req);

    const course = await prisma.course.findFirst({
      where: {
        id: req.params.id,
        userId: effectiveUserId,
      },
    });

    if (!course) {
      throw new AppError(i18next.t('server:content.notFound', { type: 'Course' }), 404);
    }

    if (course.status !== 'error') {
      throw new AppError('Only courses in error status can be retried', 400);
    }

    // Reset status and re-queue
    await prisma.course.update({
      where: { id: course.id },
      data: { status: 'draft' },
    });

    const job = await courseQueue.add('generate-course', {
      courseId: course.id,
    });

    await logGeneration(req.userId!, 'course', course.id);

    triggerWorkerJob().catch((err) => console.error('Worker trigger failed:', err));

    res.json({
      message: 'Course generation retried',
      jobId: job.id,
      courseId: course.id,
    });
  } catch (error) {
    next(error);
  }
});

// Update course
router.patch('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { title, description, maxLessonDurationMinutes } = req.body;

    const course = await prisma.course.updateMany({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(maxLessonDurationMinutes && { maxLessonDurationMinutes }),
        updatedAt: new Date(),
      },
    });

    if (course.count === 0) {
      throw new AppError(i18next.t('server:content.notFound', { type: 'Course' }), 404);
    }

    res.json({ message: i18next.t('server:content.updateSuccess', { type: 'Course' }) });
  } catch (error) {
    next(error);
  }
});

// Delete course (blocked for demo users)
router.delete('/:id', blockDemoUser, async (req: AuthRequest, res, next) => {
  try {
    // Get effective user ID (supports admin impersonation)
    const effectiveUserId = await getEffectiveUserId(req);

    const deleted = await prisma.course.deleteMany({
      where: {
        id: req.params.id,
        userId: effectiveUserId,
      },
    });

    if (deleted.count === 0) {
      throw new AppError(i18next.t('server:content.notFound', { type: 'Course' }), 404);
    }

    res.json({ message: i18next.t('server:content.deleteSuccess', { type: 'Course' }) });
  } catch (error) {
    next(error);
  }
});

export default router;
