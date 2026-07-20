import { Router } from 'express';

import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  fetchLearningOsProxy,
  resolveLearningOsProxyContext,
} from '../services/learningOsProxy.js';

const router = Router();
const LEARNING_OS_FEATURE_FLAGS_TIMEOUT_MS = 10_000;
const ISO_MILLISECOND_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

interface ClientFeatureFlags {
  id: string;
  dialoguesEnabled: boolean;
  scriptsEnabled: boolean;
  audioCourseEnabled: boolean;
  flashcardsEnabled: boolean;
  updatedAt: string;
}

function adaptFeatureFlagsResponse(value: unknown): ClientFeatureFlags {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError('Learning OS Feature Flags API returned an invalid response.', 502);
  }

  const flags = value as Record<string, unknown>;
  if (
    typeof flags.id !== 'string' ||
    flags.id.trim().length < 1 ||
    flags.id.length > 255 ||
    /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(flags.id) ||
    typeof flags.dialoguesEnabled !== 'boolean' ||
    typeof flags.scriptsEnabled !== 'boolean' ||
    typeof flags.audioCourseEnabled !== 'boolean' ||
    typeof flags.flashcardsEnabled !== 'boolean' ||
    typeof flags.updatedAt !== 'string' ||
    !ISO_MILLISECOND_TIMESTAMP.test(flags.updatedAt) ||
    Number.isNaN(Date.parse(flags.updatedAt))
  ) {
    throw new AppError('Learning OS Feature Flags API returned an invalid response.', 502);
  }

  return {
    id: flags.id,
    dialoguesEnabled: flags.dialoguesEnabled,
    scriptsEnabled: flags.scriptsEnabled,
    audioCourseEnabled: flags.audioCourseEnabled,
    flashcardsEnabled: flags.flashcardsEnabled,
    updatedAt: flags.updatedAt,
  };
}

// Public endpoint - get feature flags (available to all authenticated users)
router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) {
      throw new AppError('Authentication required', 401);
    }

    const { config, user } = await resolveLearningOsProxyContext(
      req.userId,
      'Learning OS Feature Flags API'
    );
    const upstreamResponse = await fetchLearningOsProxy({
      upstreamUrl: new URL(`${config.apiUrl}/api/feature-flags`),
      apiToken: config.apiToken,
      user,
      method: 'GET',
      timeoutMs: LEARNING_OS_FEATURE_FLAGS_TIMEOUT_MS,
      timeoutMessage: 'Learning OS Feature Flags API request timed out.',
    });

    if (!upstreamResponse.ok) {
      const statusCode =
        upstreamResponse.status === 401 || upstreamResponse.status >= 500
          ? 502
          : upstreamResponse.status;
      throw new AppError('Learning OS Feature Flags API request failed.', statusCode);
    }

    let upstreamJson: unknown;
    try {
      upstreamJson = JSON.parse(await upstreamResponse.text());
    } catch {
      throw new AppError('Learning OS Feature Flags API returned invalid JSON.', 502);
    }

    res.json(adaptFeatureFlagsResponse(upstreamJson));
  } catch (error) {
    next(error);
  }
});

export default router;
