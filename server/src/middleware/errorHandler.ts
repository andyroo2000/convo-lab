import { Request, Response, NextFunction } from 'express';

import i18next from '../i18n/index.js';

type QuotaMetadata = {
  limit: number;
  remaining: number;
  resetsAt: Date;
};

type CooldownMetadata = {
  remainingSeconds: number;
};

const isQuotaMetadata = (value: unknown): value is QuotaMetadata => {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.limit === 'number' &&
    typeof record.remaining === 'number' &&
    record.resetsAt instanceof Date
  );
};

const isCooldownMetadata = (value: unknown): value is CooldownMetadata => {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.remainingSeconds === 'number';
};

export class AppError extends Error {
  statusCode: number;

  isOperational: boolean;

  metadata?: Record<string, unknown>;

  constructor(message: string, statusCode: number = 500, metadata?: Record<string, unknown>) {
    super(message);
    this.statusCode = statusCode;
    this.metadata = metadata;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    // Add rate limit headers for 429 errors
    if (err.statusCode === 429 && err.metadata) {
      const quota = err.metadata.quota;
      if (isQuotaMetadata(quota)) {
        res.set({
          'X-RateLimit-Limit': quota.limit.toString(),
          'X-RateLimit-Remaining': quota.remaining.toString(),
          'X-RateLimit-Reset': quota.resetsAt.toISOString(),
        });
      }
      const cooldown = err.metadata.cooldown;
      if (isCooldownMetadata(cooldown)) {
        res.set({
          'Retry-After': cooldown.remainingSeconds.toString(),
        });
      }
    }

    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        statusCode: err.statusCode,
        ...(err.metadata && err.metadata),
      },
    });
  }

  // Unhandled errors
  console.error('Unhandled error:', err);

  return res.status(500).json({
    error: {
      message:
        process.env.NODE_ENV === 'production' ? i18next.t('server:errors.internal') : err.message,
      statusCode: 500,
    },
  });
}
