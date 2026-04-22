import { Response, NextFunction } from 'express';

import { createRedisConnection } from '../config/redis.js';

import { AuthRequest } from './auth.js';
import { AppError } from './errorHandler.js';

interface StudyRateLimitOptions {
  key: string;
  max: number;
  windowMs: number;
  onBackendError?: 'fail-open' | 'fail-closed';
}

let sharedRedisClient: ReturnType<typeof createRedisConnection> | null = null;

function getSharedRedisClient() {
  if (!sharedRedisClient) {
    sharedRedisClient = createRedisConnection();
  }

  return sharedRedisClient;
}

async function incrementWindowCount(
  rateKey: string,
  windowResetAtSeconds: number
): Promise<number> {
  const redis = getSharedRedisClient();
  const pipeline = redis.multi();
  pipeline.incr(rateKey);
  pipeline.expireat(rateKey, windowResetAtSeconds, 'NX');

  const results = await pipeline.exec();
  if (!results || results.length === 0) {
    throw new Error('Study rate limit pipeline returned no results.');
  }

  const [incrError, incrResult] = results[0] ?? [];
  if (incrError) {
    throw incrError;
  }

  if (typeof incrResult !== 'number') {
    throw new Error('Study rate limit pipeline returned an invalid count.');
  }

  return incrResult;
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

      const windowStart = Math.floor(Date.now() / options.windowMs);
      const windowResetAtSeconds = Math.max(
        1,
        Math.ceil(((windowStart + 1) * options.windowMs) / 1000)
      );
      const key = `rate-limit:study:${options.key}:${req.userId}:${windowStart}`;
      const count = await incrementWindowCount(key, windowResetAtSeconds);

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

      if (options.onBackendError === 'fail-closed') {
        console.error('[Study] Rate limit unavailable; rejecting request:', error);
        next(
          new AppError('Study rate limiting is temporarily unavailable. Please try again.', 503)
        );
        return;
      }

      console.warn('[Study] Rate limit unavailable; allowing request:', error);
      next();
    }
  };
}
