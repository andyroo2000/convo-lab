import { Response, NextFunction } from 'express';

import { prisma } from '../db/client.js';

import { AuthRequest } from './auth.js';
import { AppError } from './errorHandler.js';

export type FeatureFlagKey =
  | 'dialoguesEnabled'
  | 'scriptsEnabled'
  | 'audioCourseEnabled'
  | 'flashcardsEnabled'
  | 'studyApiEnabled'
  | 'studyApiSettings'
  | 'studyApiOverview'
  | 'studyApiBrowser'
  | 'studyApiBrowserDetail'
  | 'studyApiNewQueue'
  | 'studyApiImports'
  | 'studyApiSettingsWrite'
  | 'studyApiNewQueueWrite'
  | 'studyApiReview';
export type FeatureFlagSnapshot = {
  dialoguesEnabled: boolean;
  scriptsEnabled: boolean;
  audioCourseEnabled: boolean;
  flashcardsEnabled: boolean;
  studyApiEnabled: boolean;
  studyApiSettings: boolean;
  studyApiOverview: boolean;
  studyApiBrowser: boolean;
  studyApiBrowserDetail: boolean;
  studyApiNewQueue: boolean;
  studyApiImports: boolean;
  studyApiSettingsWrite: boolean;
  studyApiNewQueueWrite: boolean;
  studyApiReview: boolean;
} | null;

const FEATURE_FLAG_CACHE_TTL_MS = 30 * 1000;

let cachedFeatureFlags: {
  value: FeatureFlagSnapshot;
  expiresAt: number;
} | null = null;

export async function getFeatureFlags(): Promise<FeatureFlagSnapshot> {
  const now = Date.now();
  if (cachedFeatureFlags && cachedFeatureFlags.expiresAt > now) {
    return cachedFeatureFlags.value;
  }

  const value = await prisma.featureFlag.findFirst({
    select: {
      dialoguesEnabled: true,
      scriptsEnabled: true,
      audioCourseEnabled: true,
      flashcardsEnabled: true,
      studyApiEnabled: true,
      studyApiSettings: true,
      studyApiOverview: true,
      studyApiBrowser: true,
      studyApiBrowserDetail: true,
      studyApiNewQueue: true,
      studyApiImports: true,
      studyApiSettingsWrite: true,
      studyApiNewQueueWrite: true,
      studyApiReview: true,
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
