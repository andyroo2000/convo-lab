import type { MonologueSegmentUpdateInput } from '@languageflow/shared/src/types.js';
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
const MONOLOGUE_DRAFT_RATE_LIMIT_PER_MINUTE = 20;
const MONOLOGUE_AUDIO_RATE_LIMIT_PER_MINUTE = 30;
const MONOLOGUE_ALLOWED_SPEEDS = new Set([0.75, 0.85, 1]);

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
  if (typeof value === 'undefined') return undefined;
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !MONOLOGUE_ALLOWED_SPEEDS.has(value)
  ) {
    throw new AppError('speed must be 0.75, 0.85, or 1.', 400);
  }
  return value;
}

function draftSegmentFromUnknown(
  value: unknown,
  fallbackOrdinal: number
): MonologueSegmentUpdateInput {
  const segment = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    id: typeof segment.id === 'string' ? segment.id : undefined,
    ordinal: typeof segment.ordinal === 'number' ? segment.ordinal : fallbackOrdinal,
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
            ? body.segments.map((segment, index) => draftSegmentFromUnknown(segment, index))
            : [],
        })
      );
    } catch (error) {
      next(error);
    }
  }
);

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
      res.json(await generateMonologueFullAudioTake(requireUserId(req), req.params.projectId));
    } catch (error) {
      next(error);
    }
  }
);

export default router;
