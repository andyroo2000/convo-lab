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
  setCooldown
} from '../services/usageTracker.js';

/**
 * Middleware to enforce rate limiting on content generation.
 * Checks both weekly quota and cooldown period.
 * Admins are exempt from all limits.
 */
export async function rateLimitGeneration(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) {
  try {
    if (!req.userId) {
      throw new AppError('Authentication required', 401);
    }

    // Get user role
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { role: true }
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Admins bypass all rate limits
    if (user.role === 'admin') {
      return next();
    }

    // Check cooldown first (fail fast)
    const cooldown = await checkCooldown(req.userId);
    if (cooldown.active) {
      throw new AppError(
        `Please wait ${cooldown.remainingSeconds} seconds before generating more content.`,
        429,
        {
          cooldown: {
            remainingSeconds: cooldown.remainingSeconds,
            retryAfter: new Date(Date.now() + cooldown.remainingSeconds * 1000)
          }
        }
      );
    }

    // Check weekly quota
    const quotaStatus = await checkGenerationLimit(req.userId);
    if (!quotaStatus.allowed) {
      throw new AppError(
        `Weekly quota exceeded. You've used ${quotaStatus.used} of ${quotaStatus.limit} content generations this week.`,
        429,
        {
          quota: {
            limit: quotaStatus.limit,
            used: quotaStatus.used,
            remaining: 0,
            resetsAt: quotaStatus.resetsAt
          }
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
