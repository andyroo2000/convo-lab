/**
 * Rate limiting middleware for content generation endpoints
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
import { AppError } from './errorHandler.js';
import { prisma } from '../db/client.js';
import { checkGenerationLimit, checkCooldown, setCooldown } from '../services/usageTracker.js';
import i18next from '../i18n/index.js';

/**
 * Middleware to enforce rate limiting on content generation.
 * Checks both weekly quota and cooldown period.
 * Admins are exempt from all limits.
 */
export async function rateLimitGeneration(req: AuthRequest, _res: Response, next: NextFunction) {
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

    // Check weekly quota
    const quotaStatus = await checkGenerationLimit(req.userId);
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
}
