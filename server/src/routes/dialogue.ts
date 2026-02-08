import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { blockDemoUser } from '../middleware/demoAuth.js';
import { requireEmailVerified } from '../middleware/emailVerification.js';
import { rateLimitGeneration } from '../middleware/rateLimit.js';
import { logGeneration } from '../services/usageTracker.js';
import { dialogueQueue } from '../jobs/dialogueQueue.js';
import { AppError } from '../middleware/errorHandler.js';
import { triggerWorkerJob } from '../services/workerTrigger.js';
import i18next from '../i18n/index.js';

const router = Router();

router.use(requireAuth);

// Generate dialogue for an episode (rate limited and blocked for demo users)
router.post(
  '/generate',
  requireEmailVerified,
  rateLimitGeneration('dialogue'),
  blockDemoUser,
  async (req: AuthRequest, res, next) => {
    try {
      const {
        episodeId,
        speakers,
        variationCount = 3,
        dialogueLength = 6,
        jlptLevel,
        vocabSeedOverride,
        grammarSeedOverride,
      } = req.body;

      if (!episodeId || !speakers || !Array.isArray(speakers)) {
        throw new AppError(i18next.t('server:content.missingFields'), 400);
      }

      // Add job to queue
      const job = await dialogueQueue.add('generate-dialogue', {
        userId: req.userId,
        episodeId,
        speakers,
        variationCount,
        dialogueLength,
        jlptLevel,
        vocabSeedOverride,
        grammarSeedOverride,
      });

      // Log the generation for quota tracking
      await logGeneration(req.userId!, 'dialogue', episodeId);

      // Trigger Cloud Run Job to process the queue
      triggerWorkerJob().catch((err) => console.error('Worker trigger failed:', err));

      res.json({
        jobId: job.id,
        message: i18next.t('server:content.generationStarted', { type: 'Dialogue' }),
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get job status
router.get('/job/:jobId', async (req: AuthRequest, res, next) => {
  try {
    const job = await dialogueQueue.getJob(req.params.jobId);

    if (!job) {
      throw new AppError(i18next.t('server:content.jobNotFound'), 404);
    }

    const state = await job.getState();
    const { progress } = job;

    res.json({
      id: job.id,
      state,
      progress,
      result: state === 'completed' ? job.returnvalue : null,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
