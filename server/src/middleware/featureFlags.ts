import { Response, NextFunction } from 'express';

import { prisma } from '../db/client.js';

import { AuthRequest } from './auth.js';
import { AppError } from './errorHandler.js';

type FeatureFlagKey = 'dialoguesEnabled' | 'audioCourseEnabled' | 'flashcardsEnabled';
type FeatureFlagSnapshot = {
  dialoguesEnabled: boolean;
  audioCourseEnabled: boolean;
  flashcardsEnabled: boolean;
} | null;

const FEATURE_FLAG_CACHE_TTL_MS = 30 * 1000;

let cachedFeatureFlags: {
  value: FeatureFlagSnapshot;
  expiresAt: number;
} | null = null;

async function getFeatureFlags(): Promise<FeatureFlagSnapshot> {
  const now = Date.now();
  if (cachedFeatureFlags && cachedFeatureFlags.expiresAt > now) {
    return cachedFeatureFlags.value;
  }

  const value = await prisma.featureFlag.findFirst({
    select: {
      dialoguesEnabled: true,
      audioCourseEnabled: true,
      flashcardsEnabled: true,
    },
  });

  cachedFeatureFlags = {
    value,
    expiresAt: now + FEATURE_FLAG_CACHE_TTL_MS,
  };

  return value;
}

export function resetFeatureFlagCacheForTests() {
  cachedFeatureFlags = null;
}

export function requireFeatureFlag(feature: FeatureFlagKey) {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        throw new AppError('Authentication required', 401);
      }

      if (req.role === 'admin') {
        next();
        return;
      }

      const flags = await getFeatureFlags();

      if (flags?.[feature] === true) {
        next();
        return;
      }

      throw new AppError('This feature is not enabled for your account.', 403);
    } catch (error) {
      next(error);
    }
  };
}
