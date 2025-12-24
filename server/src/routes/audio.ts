import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { audioQueue } from '../jobs/audioQueue.js';
import { AppError } from '../middleware/errorHandler.js';
import { triggerWorkerJob } from '../services/workerTrigger.js';
import i18next from '../i18n/index.js';

const router = Router();

router.use(requireAuth);

// Generate audio for a dialogue
router.post('/generate', async (req: AuthRequest, res, next) => {
  try {
    const { episodeId, dialogueId, speed = 'normal', pauseMode = false } = req.body;

    if (!episodeId || !dialogueId) {
      throw new AppError(i18next.t('server:content.missingFields'), 400);
    }

    // Add job to queue
    const job = await audioQueue.add('generate-audio', {
      userId: req.userId,
      episodeId,
      dialogueId,
      speed,
      pauseMode,
    });

    // Trigger Cloud Run Job to process the queue
    triggerWorkerJob().catch(err =>
      console.error('Worker trigger failed:', err)
    );

    res.json({
      jobId: job.id,
      message: i18next.t('server:content.generationStarted', { type: 'Audio' }),
    });
  } catch (error) {
    next(error);
  }
});

// Generate audio at all speeds (0.7x, 0.85x, 1.0x)
router.post('/generate-all-speeds', async (req: AuthRequest, res, next) => {
  try {
    const { episodeId, dialogueId } = req.body;

    if (!episodeId || !dialogueId) {
      throw new AppError(i18next.t('server:content.missingFields'), 400);
    }

    // Check for existing active or waiting jobs to prevent duplicates
    const existingJobs = await audioQueue.getJobs(['active', 'waiting']);
    const duplicateJob = existingJobs.find(
      (job) =>
        job.name === 'generate-all-speeds' &&
        job.data.episodeId === episodeId &&
        job.data.dialogueId === dialogueId
    );

    if (duplicateJob) {
      console.log(`Duplicate job detected for episode ${episodeId}, returning existing job ${duplicateJob.id}`);
      return res.json({
        jobId: duplicateJob.id,
        message: i18next.t('server:content.generationInProgress', { type: 'Audio' }),
        existing: true,
      });
    }

    // Add job to queue
    const job = await audioQueue.add('generate-all-speeds', {
      episodeId,
      dialogueId,
    });

    // Trigger Cloud Run Job to process the queue
    triggerWorkerJob().catch(err =>
      console.error('Worker trigger failed:', err)
    );

    res.json({
      jobId: job.id,
      message: i18next.t('server:content.generationStarted', { type: 'Multi-speed audio' }),
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
