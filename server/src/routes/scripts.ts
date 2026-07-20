import { getAudioScriptTtsVoices } from '@languageflow/shared/src/voiceSelection.js';
import { Router } from 'express';
import { rateLimit as createExpressRateLimit } from 'express-rate-limit';

import { audioScriptQueue } from '../jobs/audioScriptQueue.js';
import { imageQueue } from '../jobs/imageQueue.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { blockDemoUser } from '../middleware/demoAuth.js';
import { requireEmailVerified } from '../middleware/emailVerification.js';
import { AppError } from '../middleware/errorHandler.js';
import { rateLimitGeneration } from '../middleware/rateLimit.js';
import { rateLimitStudyRoute } from '../middleware/studyRateLimit.js';
import { getAudioScriptMediaAccess } from '../services/audioScriptMediaService.js';
import {
  annotateAudioScript,
  createAudioScript,
  getAudioScriptStatus,
  toAudioScriptResponse,
  updateAudioScriptSegments,
} from '../services/audioScriptService.js';
import { logGeneration } from '../services/usageTracker.js';
import { triggerWorkerJob } from '../services/workerTrigger.js';

import { sendPrivateMediaResponse } from './privateMediaResponse.js';

const router = Router();
const scriptIpRateLimit = createExpressRateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(
  scriptIpRateLimit,
  requireAuth,
  rateLimitStudyRoute({ key: 'script', max: 300, windowMs: 60 * 1000 })
);

type UpdateAudioScriptSegmentsParams = Parameters<typeof updateAudioScriptSegments>[0];

export function parseAudioScriptSegmentsPatchBody(body: unknown): {
  title?: string;
  voiceId?: string;
  segments: UpdateAudioScriptSegmentsParams['segments'];
} {
  const raw = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  if (!Array.isArray(raw.segments)) {
    throw new AppError('segments must be an array.', 400);
  }

  let title: string | undefined;
  if (typeof raw.title !== 'undefined') {
    if (typeof raw.title !== 'string' || raw.title.trim().length === 0) {
      throw new AppError('title must be a non-empty string when provided.', 400);
    }
    title = raw.title.trim();
  }

  let voiceId: string | undefined;
  if (typeof raw.voiceId !== 'undefined') {
    if (typeof raw.voiceId !== 'string') {
      throw new AppError('voiceId must be a string when provided.', 400);
    }
    const normalizedVoiceId = raw.voiceId.trim();
    const allowed = getAudioScriptTtsVoices('ja').some((voice) => voice.id === normalizedVoiceId);
    if (!allowed) {
      throw new AppError('voiceId must be a supported Google Neural2 Japanese voice.', 400);
    }
    voiceId = normalizedVoiceId;
  }

  return {
    title,
    voiceId,
    segments: raw.segments as UpdateAudioScriptSegmentsParams['segments'],
  };
}

interface AudioScriptJobData {
  episodeId?: unknown;
  userId?: unknown;
}

function getAudioScriptJobData(job: { data?: unknown }): AudioScriptJobData {
  return job.data && typeof job.data === 'object' ? (job.data as AudioScriptJobData) : {};
}

export async function assertAudioScriptJobBelongsToUser(job: { data?: unknown }, userId: string) {
  const data = getAudioScriptJobData(job);
  if (data.userId !== userId || typeof data.episodeId !== 'string') {
    throw new AppError('Script audio job not found.', 404);
  }

  await getAudioScriptStatus(data.episodeId, userId);
}

router.get(
  '/media/:mediaId',
  rateLimitStudyRoute({ key: 'script-media-read', max: 240, windowMs: 60 * 1000 }),
  async (req: AuthRequest, res, next) => {
    try {
      const mediaAccess = await getAudioScriptMediaAccess(req.userId!, req.params.mediaId);
      if (!mediaAccess) {
        throw new AppError('Script media not found.', 404);
      }

      sendPrivateMediaResponse(res, mediaAccess);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/',
  requireEmailVerified,
  rateLimitGeneration('script'),
  blockDemoUser,
  async (req: AuthRequest, res, next) => {
    try {
      const { sourceText, voiceId } = req.body;
      const episode = await createAudioScript({
        userId: req.userId!,
        sourceText,
        voiceId,
      });
      await logGeneration(req.userId!, 'script', episode.id);
      res.json(episode);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:episodeId/annotate',
  requireEmailVerified,
  blockDemoUser,
  async (req: AuthRequest, res, next) => {
    try {
      const script = await annotateAudioScript(req.params.episodeId, req.userId!);
      res.json(toAudioScriptResponse(script));
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  '/:episodeId/segments',
  requireEmailVerified,
  blockDemoUser,
  async (req: AuthRequest, res, next) => {
    try {
      const { title, voiceId, segments } = parseAudioScriptSegmentsPatchBody(req.body);

      const script = await updateAudioScriptSegments({
        episodeId: req.params.episodeId,
        userId: req.userId!,
        title,
        voiceId,
        segments,
      });
      res.json(toAudioScriptResponse(script));
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:episodeId/render',
  requireEmailVerified,
  blockDemoUser,
  async (req: AuthRequest, res, next) => {
    try {
      await getAudioScriptStatus(req.params.episodeId, req.userId!);
      const job = await audioScriptQueue.add('render-audio-script', {
        episodeId: req.params.episodeId,
        userId: req.userId!,
      });

      triggerWorkerJob().catch((err) => console.error('Worker trigger failed:', err));

      res.json({
        jobId: job.id,
        message: 'Script audio rendering started.',
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:episodeId/images',
  requireEmailVerified,
  blockDemoUser,
  async (req: AuthRequest, res, next) => {
    try {
      await getAudioScriptStatus(req.params.episodeId, req.userId!);
      const job = await imageQueue.add('generate-script-images', {
        episodeId: req.params.episodeId,
        userId: req.userId!,
        force: Boolean(req.body?.force),
      });

      triggerWorkerJob().catch((err) => console.error('Worker trigger failed:', err));

      res.json({
        jobId: job.id,
        message: 'Script image generation started.',
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/:episodeId/status', async (req: AuthRequest, res, next) => {
  try {
    const script = await getAudioScriptStatus(req.params.episodeId, req.userId!);
    res.json(toAudioScriptResponse(script));
  } catch (error) {
    next(error);
  }
});

router.get('/job/:jobId', async (req: AuthRequest, res, next) => {
  try {
    const job = await audioScriptQueue.getJob(req.params.jobId);
    if (!job) {
      throw new AppError('Script audio job not found.', 404);
    }
    await assertAudioScriptJobBelongsToUser(job, req.userId!);

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
