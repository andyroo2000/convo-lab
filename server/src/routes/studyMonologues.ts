import type { MonologueSegmentUpdateInput } from '@languageflow/shared/src/types.js';
import { getMonologueTtsVoices } from '@languageflow/shared/src/voiceSelection.js';
import { Router } from 'express';

import { enqueueMonologueFullAudioRenderJob } from '../jobs/monologueAudioQueue.js';
import type { AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { rateLimitStudyRoute } from '../middleware/studyRateLimit.js';
import { logger } from '../services/logger.js';
import {
  approveMonologueScript,
  createMonologueProject,
  generateMonologueSegmentAudioTake,
  getMonologueProject,
  listMonologueProjects,
  markMonologueFullAudioRenderFailed,
  prepareMonologueFullAudioRender,
  regenerateMonologueAudioTake,
  setMonologueDefaultAudioTake,
  updateMonologueDraft,
} from '../services/monologueService.js';
import { triggerWorkerJob } from '../services/workerTrigger.js';

const router = Router();
const MONOLOGUE_CREATE_RATE_LIMIT_PER_MINUTE = 8;
const MONOLOGUE_DRAFT_RATE_LIMIT_PER_MINUTE = 20;
const MONOLOGUE_AUDIO_RATE_LIMIT_PER_MINUTE = 30;
const MONOLOGUE_SET_DEFAULT_RATE_LIMIT_PER_MINUTE = 60;
const MONOLOGUE_ALLOWED_SPEEDS = new Set([0.75, 0.85, 1]);
// TODO: derive from the project target language once monologues support languages beyond Japanese.
const MONOLOGUE_ALLOWED_VOICE_IDS = new Set(getMonologueTtsVoices('ja').map((voice) => voice.id));

function requireUserId(req: AuthRequest): string {
  if (!req.userId) {
    throw new AppError('Authenticated user is required.', 401);
  }
  return req.userId;
}

function requireBodyObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError('Request body must be an object.', 400);
  }
  return value as Record<string, unknown>;
}

function optionalString(value: unknown): string | null | undefined {
  if (typeof value === 'undefined') return undefined;
  if (value === null) return null;
  if (typeof value === 'string') return value;
  throw new AppError('Expected a string or null.', 400);
}

function optionalMonologueSpeed(value: unknown): number | undefined {
  if (typeof value === 'undefined' || value === null) return undefined;
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !MONOLOGUE_ALLOWED_SPEEDS.has(value)
  ) {
    throw new AppError('speed must be 0.75, 0.85, or 1.', 400);
  }
  return value;
}

function requireMonologueVoiceId(value: unknown): string {
  if (typeof value !== 'string') {
    throw new AppError('voiceId is required.', 400);
  }
  if (!MONOLOGUE_ALLOWED_VOICE_IDS.has(value)) {
    throw new AppError('voiceId is not available for monologues.', 400);
  }
  return value;
}

function draftSegmentFromUnknown(value: unknown): MonologueSegmentUpdateInput {
  const segment = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    id: typeof segment.id === 'string' ? segment.id : undefined,
    sourceText: typeof segment.sourceText === 'string' ? segment.sourceText : '',
    japaneseText: typeof segment.japaneseText === 'string' ? segment.japaneseText : '',
    reading: typeof segment.reading === 'string' ? segment.reading : null,
    beatLabel: typeof segment.beatLabel === 'string' ? segment.beatLabel : null,
  };
}

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    res.json({ projects: await listMonologueProjects(requireUserId(req)) });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/',
  rateLimitStudyRoute({
    key: 'monologue-create',
    max: MONOLOGUE_CREATE_RATE_LIMIT_PER_MINUTE,
    windowMs: 60 * 1000,
  }),
  async (req: AuthRequest, res, next) => {
    try {
      const body = requireBodyObject(req.body);
      const sourceText = optionalString(body.sourceText);
      if (!sourceText?.trim()) {
        throw new AppError('sourceText is required.', 400);
      }
      const title = optionalString(body.title);
      const result = await createMonologueProject(requireUserId(req), {
        sourceText,
        title,
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.get('/:projectId', async (req: AuthRequest, res, next) => {
  try {
    res.json(await getMonologueProject(requireUserId(req), req.params.projectId));
  } catch (error) {
    next(error);
  }
});

router.put(
  '/:projectId/draft',
  rateLimitStudyRoute({
    key: 'monologue-draft-update',
    max: MONOLOGUE_DRAFT_RATE_LIMIT_PER_MINUTE,
    windowMs: 60 * 1000,
  }),
  async (req: AuthRequest, res, next) => {
    try {
      const body = requireBodyObject(req.body);
      // Segment shape and cross-field validation live in the service with draft-version rules.
      res.json(
        await updateMonologueDraft(requireUserId(req), req.params.projectId, {
          title: typeof body.title === 'string' ? body.title : undefined,
          fullText: typeof body.fullText === 'string' ? body.fullText : '',
          segments: Array.isArray(body.segments)
            ? body.segments.map((segment) => draftSegmentFromUnknown(segment))
            : [],
        })
      );
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:projectId/approve',
  rateLimitStudyRoute({
    key: 'monologue-approve-script',
    max: MONOLOGUE_DRAFT_RATE_LIMIT_PER_MINUTE,
    windowMs: 60 * 1000,
  }),
  async (req: AuthRequest, res, next) => {
    try {
      res.json(await approveMonologueScript(requireUserId(req), req.params.projectId));
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:projectId/segments/:segmentId/audio-takes',
  rateLimitStudyRoute({
    key: 'monologue-segment-audio',
    max: MONOLOGUE_AUDIO_RATE_LIMIT_PER_MINUTE,
    windowMs: 60 * 1000,
  }),
  async (req: AuthRequest, res, next) => {
    try {
      const body = requireBodyObject(req.body);
      const voiceId = requireMonologueVoiceId(body.voiceId);
      res.status(201).json(
        await generateMonologueSegmentAudioTake(
          requireUserId(req),
          req.params.projectId,
          req.params.segmentId,
          {
            voiceId,
            displayName: optionalString(body.displayName),
            isDefault: typeof body.isDefault === 'boolean' ? body.isDefault : undefined,
            speed: optionalMonologueSpeed(body.speed),
          }
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:projectId/audio-takes/:takeId/regenerate',
  rateLimitStudyRoute({
    key: 'monologue-regenerate-audio',
    max: MONOLOGUE_AUDIO_RATE_LIMIT_PER_MINUTE,
    windowMs: 60 * 1000,
  }),
  async (req: AuthRequest, res, next) => {
    try {
      res.json(
        await regenerateMonologueAudioTake(
          requireUserId(req),
          req.params.projectId,
          req.params.takeId
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:projectId/audio-takes/:takeId/default',
  rateLimitStudyRoute({
    key: 'monologue-default-audio',
    max: MONOLOGUE_SET_DEFAULT_RATE_LIMIT_PER_MINUTE,
    windowMs: 60 * 1000,
  }),
  async (req: AuthRequest, res, next) => {
    try {
      res.json(
        await setMonologueDefaultAudioTake(
          requireUserId(req),
          req.params.projectId,
          req.params.takeId
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:projectId/full-audio',
  rateLimitStudyRoute({
    key: 'monologue-full-audio',
    max: MONOLOGUE_AUDIO_RATE_LIMIT_PER_MINUTE,
    windowMs: 60 * 1000,
  }),
  async (req: AuthRequest, res, next) => {
    try {
      const userId = requireUserId(req);
      const project = await prepareMonologueFullAudioRender(userId, req.params.projectId);
      if (!project.activeVersionId) {
        throw new AppError('Monologue project has no active script version.', 500);
      }
      try {
        await enqueueMonologueFullAudioRenderJob({
          userId,
          projectId: req.params.projectId,
          scriptVersionId: project.activeVersionId,
        });
      } catch (error) {
        await markMonologueFullAudioRenderFailed(
          userId,
          req.params.projectId,
          project.activeVersionId
        );
        throw error;
      }
      triggerWorkerJob().catch((error: unknown) => {
        logger.warn('Failed to trigger monologue full-audio worker.', { error });
      });
      res.status(202).json(project);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
