import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { imageQueue } from '../jobs/imageQueue.js';
import { AppError } from '../middleware/errorHandler.js';
import { triggerWorkerJob } from '../services/workerTrigger.js';

const router = Router();

router.use(requireAuth);

// Generate images for a dialogue
router.post('/generate', async (req: AuthRequest, res, next) => {
  try {
    const { episodeId, dialogueId, imageCount = 3 } = req.body;

    if (!episodeId || !dialogueId) {
      throw new AppError('Missing required fields', 400);
    }

    // Add job to queue
    const job = await imageQueue.add('generate-images', {
      userId: req.userId,
      episodeId,
      dialogueId,
      imageCount,
    });

    // Trigger Cloud Run Job to process the queue
    triggerWorkerJob().catch(err =>
      console.error('Worker trigger failed:', err)
    );

    res.json({
      jobId: job.id,
      message: 'Image generation started',
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
      throw new AppError('Job not found', 404);
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
