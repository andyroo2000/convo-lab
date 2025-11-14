import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { audioQueue } from '../jobs/audioQueue.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

router.use(requireAuth);

// Generate audio for a dialogue
router.post('/generate', async (req: AuthRequest, res, next) => {
  try {
    const { episodeId, dialogueId, speed = 'normal', pauseMode = false } = req.body;

    if (!episodeId || !dialogueId) {
      throw new AppError('Missing required fields', 400);
    }

    // Add job to queue
    const job = await audioQueue.add('generate-audio', {
      userId: req.userId,
      episodeId,
      dialogueId,
      speed,
      pauseMode,
    });

    res.json({
      jobId: job.id,
      message: 'Audio generation started',
    });
  } catch (error) {
    next(error);
  }
});

// Get job status
router.get('/job/:jobId', async (req: AuthRequest, res, next) => {
  try {
    const job = await audioQueue.getJob(req.params.jobId);

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
