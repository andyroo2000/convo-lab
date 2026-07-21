import { NextFunction, Response, Router } from 'express';

import { isLearningOsCourseGenerationProxyEnabled } from '../config/courseGenerationRouting.js';
import { prisma } from '../db/client.js';
import i18next from '../i18n/index.js';
import { courseQueue } from '../jobs/courseQueue.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { blockDemoUser } from '../middleware/demoAuth.js';
import { requireEmailVerified } from '../middleware/emailVerification.js';
import { AppError } from '../middleware/errorHandler.js';
import { getEffectiveUserId } from '../middleware/impersonation.js';
import { rateLimitGeneration } from '../middleware/rateLimit.js';
import { logGeneration } from '../services/usageTracker.js';
import { triggerWorkerJob } from '../services/workerTrigger.js';

import {
  deleteLearningOsCourse,
  generateLearningOsCourse,
  listLearningOsCourses,
  resetLearningOsCourseGeneration,
  retryLearningOsCourseGeneration,
  showLearningOsCourse,
  showLearningOsCourseGenerationStatus,
  storeLearningOsCourse,
  updateLearningOsCourse,
} from './learningOs/courses.js';

const router = Router();

type CourseGenerationHandler = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

const routeCourseGeneration = (
  learningOsHandler: CourseGenerationHandler,
  expressHandler: CourseGenerationHandler
): CourseGenerationHandler => {
  const handler: CourseGenerationHandler = (req, res, next) =>
    (isLearningOsCourseGenerationProxyEnabled() ? learningOsHandler : expressHandler)(
      req,
      res,
      next
    );

  return handler;
};

// All course routes require authentication
router.use(requireAuth);

// Get all courses for current user (demo users see admin's content)
router.get('/', listLearningOsCourses);

// Get single course with full details (demo users can view admin's courses)
router.get('/:id', showLearningOsCourse);

// Create new course from episode(s) (blocked for demo users)
router.post('/', blockDemoUser, storeLearningOsCourse);

// Generate course content (lessons, scripts, audio) (blocked for demo users)
router.post(
  '/:id/generate',
  requireEmailVerified,
  rateLimitGeneration('course'),
  blockDemoUser,
  routeCourseGeneration(generateLearningOsCourse, async (req: AuthRequest, res, next) => {
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
  })
);

// Get course generation status (demo users can view admin's courses)
router.get(
  '/:id/status',
  routeCourseGeneration(showLearningOsCourseGenerationStatus, async (req, res, next) => {
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

      res.set('Cache-Control', 'private, no-store');
      res.json({
        status: course.status,
        progress: jobProgress,
        isStuck,
      });
    } catch (error) {
      next(error);
    }
  })
);

// Reset stuck course (when status is 'generating' but no active job exists)
router.post(
  '/:id/reset',
  routeCourseGeneration(resetLearningOsCourseGeneration, async (req, res, next) => {
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
  })
);

// Retry a failed course generation (re-queues from saved pipeline state)
router.post(
  '/:id/retry',
  blockDemoUser,
  routeCourseGeneration(retryLearningOsCourseGeneration, async (req, res, next) => {
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
  })
);

// Update course
router.patch('/:id', updateLearningOsCourse);

// Delete course (blocked for demo users)
router.delete('/:id', blockDemoUser, deleteLearningOsCourse);

export default router;
