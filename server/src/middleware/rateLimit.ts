/**
 * Rate limiting middleware for content generation endpoints
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
import { AppError } from './errorHandler.js';
import { prisma } from '../db/client.js';
import {
  checkGenerationLimit,
  checkCooldown,
  setCooldown,
  ContentType,
} from '../services/usageTracker.js';
import i18next from '../i18n/index.js';

/**
 * Factory function to create rate limiting middleware for a specific content type.
 * Checks both quota (free: lifetime per-type, paid: monthly combined) and cooldown.
 * Admins are exempt from all limits.
 *
 * @param contentType - The type of content being generated
 * @returns Express middleware function
 */
export function rateLimitGeneration(contentType: ContentType) {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        throw new AppError(i18next.t('server:errors.authRequired'), 401);
      }

      // Get user role
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { role: true },
      });

      if (!user) {
        throw new AppError(i18next.t('server:auth.userNotFound'), 404);
      }

      // Admins bypass all rate limits
      if (user.role === 'admin') {
        return next();
      }

      // Check cooldown first (fail fast)
      const cooldown = await checkCooldown(req.userId);
      if (cooldown.active) {
        throw new AppError(
          i18next.t('server:rateLimit.cooldown', { seconds: cooldown.remainingSeconds }),
          429,
          {
            cooldown: {
              remainingSeconds: cooldown.remainingSeconds,
              retryAfter: new Date(Date.now() + cooldown.remainingSeconds * 1000),
            },
          }
        );
      }

      // Check quota (content-type-specific for free tier, monthly combined for paid tier)
      const quotaStatus = await checkGenerationLimit(req.userId, contentType);
      if (!quotaStatus.allowed) {
        throw new AppError(
          i18next.t('server:rateLimit.quotaExceeded', {
            used: quotaStatus.used,
            limit: quotaStatus.limit,
          }),
          429,
          {
            quota: {
              limit: quotaStatus.limit,
              used: quotaStatus.used,
              remaining: 0,
              resetsAt: quotaStatus.resetsAt,
            },
          }
        );
      }

      // Set cooldown for next request
      await setCooldown(req.userId);

      // Allow request to proceed
      next();
    } catch (error) {
      next(error);
    }
  };
}
