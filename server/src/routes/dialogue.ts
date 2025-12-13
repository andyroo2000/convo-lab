import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { blockDemoUser } from '../middleware/demoAuth.js';
import { rateLimitGeneration } from '../middleware/rateLimit.js';
import { logGeneration } from '../services/usageTracker.js';
import { dialogueQueue } from '../jobs/dialogueQueue.js';
import { AppError } from '../middleware/errorHandler.js';
import { triggerWorkerJob } from '../services/workerTrigger.js';

const router = Router();

router.use(requireAuth);

// Generate dialogue for an episode (rate limited and blocked for demo users)
router.post('/generate', rateLimitGeneration, blockDemoUser, async (req: AuthRequest, res, next) => {
  try {
    const { episodeId, speakers, variationCount = 3, dialogueLength = 6 } = req.body;

    if (!episodeId || !speakers || !Array.isArray(speakers)) {
      throw new AppError('Missing required fields', 400);
    }

    // Add job to queue
    const job = await dialogueQueue.add('generate-dialogue', {
      userId: req.userId,
      episodeId,
      speakers,
      variationCount,
      dialogueLength,
    });

    // Log the generation for quota tracking
    await logGeneration(req.userId!, 'dialogue', episodeId);

    // Trigger Cloud Run Job to process the queue
    triggerWorkerJob().catch(err =>
      console.error('Worker trigger failed:', err)
    );

    res.json({
      jobId: job.id,
      message: 'Dialogue generation started',
    });
  } catch (error) {
    next(error);
  }
});

// Get job status
router.get('/job/:jobId', async (req: AuthRequest, res, next) => {
  try {
    const job = await dialogueQueue.getJob(req.params.jobId);

    if (!job) {
      throw new AppError('Job not found', 404);
    }

    const state = await job.getState();
    const progress = job.progress;

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
