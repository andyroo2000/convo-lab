import { Response, NextFunction } from 'express';

import { createRedisConnection } from '../config/redis.js';

import { AuthRequest } from './auth.js';
import { AppError } from './errorHandler.js';

interface StudyRateLimitOptions {
  key: string;
  max: number;
  windowMs: number;
}

let sharedRedisClient: ReturnType<typeof createRedisConnection> | null = null;

function getSharedRedisClient() {
  if (!sharedRedisClient) {
    sharedRedisClient = createRedisConnection();
  }

  return sharedRedisClient;
}

async function incrementWindowCount(rateKey: string, windowSeconds: number): Promise<number> {
  const redis = getSharedRedisClient();
  const nextCount = await redis.incr(rateKey);
  if (nextCount === 1) {
    await redis.expire(rateKey, windowSeconds);
  }

  return nextCount;
}

export function rateLimitStudyRoute(options: StudyRateLimitOptions) {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        throw new AppError('Authentication required', 401);
      }

      if (req.role === 'admin') {
        next();
        return;
      }

      const windowSeconds = Math.max(1, Math.ceil(options.windowMs / 1000));
      const windowStart = Math.floor(Date.now() / options.windowMs);
      const key = `rate-limit:study:${options.key}:${req.userId}:${windowStart}`;
      const count = await incrementWindowCount(key, windowSeconds);

      if (count > options.max) {
        throw new AppError('Too many study requests. Please try again shortly.', 429, {
          quota: {
            limit: options.max,
            remaining: 0,
            resetsAt: new Date((windowStart + 1) * options.windowMs),
          },
        });
      }

      next();
    } catch (error) {
      if (error instanceof AppError) {
        next(error);
        return;
      }

      console.warn('[Study] Rate limit unavailable; allowing request:', error);
      next();
    }
  };
}
