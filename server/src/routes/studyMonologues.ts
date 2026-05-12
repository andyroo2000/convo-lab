import { Router } from 'express';

import type { AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { rateLimitStudyRoute } from '../middleware/studyRateLimit.js';
import {
  approveMonologueScript,
  createMonologueProject,
  generateMonologueFullAudioTake,
  generateMonologueSegmentAudioTake,
  getMonologueProject,
  listMonologueProjects,
  regenerateMonologueAudioTake,
  setMonologueDefaultAudioTake,
  updateMonologueDraft,
} from '../services/monologueService.js';

const router = Router();
const MONOLOGUE_CREATE_RATE_LIMIT_PER_MINUTE = 8;
const MONOLOGUE_AUDIO_RATE_LIMIT_PER_MINUTE = 30;

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
      const title = optionalString(body.title);
      const result = await createMonologueProject(requireUserId(req), {
        sourceText: sourceText ?? '',
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

router.put('/:projectId/draft', async (req: AuthRequest, res, next) => {
  try {
    const body = requireBodyObject(req.body);
    res.json(
      await updateMonologueDraft(requireUserId(req), req.params.projectId, {
        title: typeof body.title === 'string' ? body.title : undefined,
        fullText: typeof body.fullText === 'string' ? body.fullText : '',
        segments: Array.isArray(body.segments) ? body.segments : [],
      })
    );
  } catch (error) {
    next(error);
  }
});

router.post('/:projectId/approve', async (req: AuthRequest, res, next) => {
  try {
    res.json(await approveMonologueScript(requireUserId(req), req.params.projectId));
  } catch (error) {
    next(error);
  }
});

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
      if (typeof body.voiceId !== 'string') {
        throw new AppError('voiceId is required.', 400);
      }
      res.status(201).json(
        await generateMonologueSegmentAudioTake(
          requireUserId(req),
          req.params.projectId,
          req.params.segmentId,
          {
            voiceId: body.voiceId,
            displayName: optionalString(body.displayName),
            isDefault: typeof body.isDefault === 'boolean' ? body.isDefault : undefined,
            speed: typeof body.speed === 'number' ? body.speed : undefined,
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

router.post('/:projectId/audio-takes/:takeId/default', async (req: AuthRequest, res, next) => {
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
});

router.post(
  '/:projectId/full-audio',
  rateLimitStudyRoute({
    key: 'monologue-full-audio',
    max: MONOLOGUE_AUDIO_RATE_LIMIT_PER_MINUTE,
    windowMs: 60 * 1000,
  }),
  async (req: AuthRequest, res, next) => {
    try {
      res
        .status(201)
        .json(await generateMonologueFullAudioTake(requireUserId(req), req.params.projectId));
    } catch (error) {
      next(error);
    }
  }
);

export default router;
