import { Response, NextFunction } from 'express';

import { prisma } from '../db/client.js';

import { AuthRequest } from './auth.js';
import { AppError } from './errorHandler.js';

type FeatureFlagKey = 'dialoguesEnabled' | 'audioCourseEnabled' | 'flashcardsEnabled';

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

      const flags = await prisma.featureFlag.findFirst({
        select: {
          dialoguesEnabled: true,
          audioCourseEnabled: true,
          flashcardsEnabled: true,
        },
      });

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
