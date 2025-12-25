import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { imageQueue } from '../jobs/imageQueue.js';
import { AppError } from '../middleware/errorHandler.js';
import { triggerWorkerJob } from '../services/workerTrigger.js';
import i18next from '../i18n/index.js';

const router = Router();

router.use(requireAuth);

// Generate images for a dialogue
router.post('/generate', async (req: AuthRequest, res, next) => {
  try {
    const { episodeId, dialogueId, imageCount = 3 } = req.body;

    if (!episodeId || !dialogueId) {
      throw new AppError(i18next.t('server:content.missingFields'), 400);
    }

    // Add job to queue
    const job = await imageQueue.add('generate-images', {
      userId: req.userId,
      episodeId,
      dialogueId,
      imageCount,
    });

    // Trigger Cloud Run Job to process the queue
    triggerWorkerJob().catch((err) => console.error('Worker trigger failed:', err));

    res.json({
      jobId: job.id,
      message: i18next.t('server:content.generationStarted', { type: 'Image' }),
    });
  } catch (error) {
    next(error);
  }
});

// Get job status
router.get('/job/:jobId', async (req: AuthRequest, res, next) => {
  try {
    const job = await imageQueue.getJob(req.params.jobId);

    if (!job) {
      throw new AppError(i18next.t('server:content.jobNotFound'), 404);
    }

    const state = await job.getState();

    res.json({
      id: job.id,
      state,
      progress: job.progress,
      result: state === 'completed' ? job.returnvalue : null,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
