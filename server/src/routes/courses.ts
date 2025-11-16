import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';
import { courseQueue } from '../jobs/courseQueue.js';
import { DEFAULT_NARRATOR_VOICES } from '../../../shared/src/constants.js';
import { generateWithGemini } from '../services/geminiClient.js';

const router = Router();

// All course routes require authentication
router.use(requireAuth);

// Get all courses for current user
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const courses = await prisma.course.findMany({
      where: { userId: req.userId },
      include: {
        lessons: {
          orderBy: { order: 'asc' },
          include: {
            coreItems: true,
          },
        },
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
    });

    res.json(courses);
  } catch (error) {
    next(error);
  }
});

// Get single course with full details
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const course = await prisma.course.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
      include: {
        lessons: {
          orderBy: { order: 'asc' },
          include: {
            coreItems: true,
          },
        },
        courseEpisodes: {
          orderBy: { order: 'asc' },
          include: {
            episode: true,
          },
        },
      },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    res.json(course);
  } catch (error) {
    next(error);
  }
});

// Create new course from episode(s)
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const {
      title,
      description,
      episodeIds,
      nativeLanguage,
      targetLanguage,
      maxLessonDurationMinutes = 30,
      l1VoiceId,
      useDraftMode = false,
      jlptLevel,
      speaker1Gender = 'male',
      speaker2Gender = 'female',
    } = req.body;

    if (!title || !episodeIds || episodeIds.length === 0) {
      throw new AppError('Missing required fields: title, episodeIds', 400);
    }

    if (!nativeLanguage || !targetLanguage) {
      throw new AppError('Missing required fields: nativeLanguage, targetLanguage', 400);
    }

    // Verify all episodes exist and belong to user
    const episodes = await prisma.episode.findMany({
      where: {
        id: { in: episodeIds },
        userId: req.userId,
      },
      include: {
        dialogue: true,
      },
    });

    if (episodes.length !== episodeIds.length) {
      throw new AppError('One or more episodes not found', 404);
    }

    // Ensure all episodes have dialogues
    const missingDialogue = episodes.find(ep => !ep.dialogue);
    if (missingDialogue) {
      throw new AppError(
        `Episode "${missingDialogue.title}" has no dialogue. Generate dialogue first.`,
        400
      );
    }

    // Use default narrator voice if not provided
    const narratorVoice = l1VoiceId || DEFAULT_NARRATOR_VOICES[nativeLanguage as keyof typeof DEFAULT_NARRATOR_VOICES];

    if (!narratorVoice) {
      throw new AppError(`No default narrator voice found for language: ${nativeLanguage}`, 400);
    }

    // Auto-generate description if not provided
    let courseDescription = description;
    if (!courseDescription) {
      try {
        const episodeTitles = episodes.map(ep => ep.title).join(', ');
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
        userId: req.userId!,
        title,
        description: courseDescription || null,
        status: 'draft',
        nativeLanguage,
        targetLanguage,
        maxLessonDurationMinutes,
        l1VoiceId: narratorVoice,
        useDraftMode,
        jlptLevel: jlptLevel || null,
        speaker1Gender,
        speaker2Gender,
      },
    });

    // Link episodes to course
    await Promise.all(
      episodeIds.map((episodeId: string, index: number) =>
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

// Generate course content (lessons, scripts, audio)
router.post('/:id/generate', async (req: AuthRequest, res, next) => {
  try {
    // Use a transaction to atomically check and update course status
    const result = await prisma.$transaction(async (tx) => {
      // Lock the course row for this transaction
      const course = await tx.course.findFirst({
        where: {
          id: req.params.id,
          userId: req.userId,
        },
        include: {
          lessons: true,
        },
      });

      if (!course) {
        throw new AppError('Course not found', 404);
      }

      if (course.status === 'generating') {
        throw new AppError('Course is already being generated', 400);
      }

      // Check if there are already lessons being generated
      const generatingLessons = course.lessons?.filter(l => l.status === 'generating');
      if (generatingLessons && generatingLessons.length > 0) {
        throw new AppError('Lessons are already being generated for this course', 400);
      }

      // Check if there's already an active job for this course
      const activeJobs = await courseQueue.getJobs(['active', 'waiting', 'delayed']);
      const existingJob = activeJobs.find(j => j.data.courseId === course.id);
      if (existingJob) {
        throw new AppError('Course generation is already in progress', 400);
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

    res.json({
      message: 'Course generation started',
      jobId: job.id,
      courseId: result.id,
    });
  } catch (error) {
    next(error);
  }
});

// Get course generation status
router.get('/:id/status', async (req: AuthRequest, res, next) => {
  try {
    const course = await prisma.course.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
      include: {
        lessons: {
          select: {
            id: true,
            order: true,
            status: true,
          },
        },
      },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    // Get active job if generating
    let jobProgress = null;
    if (course.status === 'generating') {
      // Try to find active job for this course
      const jobs = await courseQueue.getJobs(['active', 'waiting']);
      const activeJob = jobs.find(j => j.data.courseId === course.id);

      if (activeJob) {
        jobProgress = activeJob.progress;
      }
    }

    res.json({
      status: course.status,
      progress: jobProgress,
      lessons: course.lessons,
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
      throw new AppError('Course not found', 404);
    }

    res.json({ message: 'Course updated' });
  } catch (error) {
    next(error);
  }
});

// Delete course
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const deleted = await prisma.course.deleteMany({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
    });

    if (deleted.count === 0) {
      throw new AppError('Course not found', 404);
    }

    res.json({ message: 'Course deleted' });
  } catch (error) {
    next(error);
  }
});

// Get single lesson details
router.get('/:courseId/lessons/:lessonId', async (req: AuthRequest, res, next) => {
  try {
    const { courseId, lessonId } = req.params;

    // Verify course belongs to user
    const course = await prisma.course.findFirst({
      where: {
        id: courseId,
        userId: req.userId,
      },
    });

    if (!course) {
      throw new AppError('Course not found', 404);
    }

    const lesson = await prisma.lesson.findFirst({
      where: {
        id: lessonId,
        courseId,
      },
      include: {
        coreItems: true,
      },
    });

    if (!lesson) {
      throw new AppError('Lesson not found', 404);
    }

    res.json(lesson);
  } catch (error) {
    next(error);
  }
});

export default router;
