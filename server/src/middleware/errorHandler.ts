import { Request, Response, NextFunction } from 'express';
import i18next from '../i18n/index.js';

export class AppError extends Error {
  statusCode: number;

  isOperational: boolean;

  metadata?: any;

  constructor(message: string, statusCode: number = 500, metadata?: any) {
    super(message);
    this.statusCode = statusCode;
    this.metadata = metadata;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof AppError) {
    // Add rate limit headers for 429 errors
    if (err.statusCode === 429 && err.metadata) {
      if (err.metadata.quota) {
        res.set({
          'X-RateLimit-Limit': err.metadata.quota.limit.toString(),
          'X-RateLimit-Remaining': err.metadata.quota.remaining.toString(),
          'X-RateLimit-Reset': err.metadata.quota.resetsAt.toISOString()
        });
      }
      if (err.metadata.cooldown) {
        res.set({
          'Retry-After': err.metadata.cooldown.remainingSeconds.toString()
        });
      }
    }

    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        statusCode: err.statusCode,
        ...(err.metadata && err.metadata)
      },
    });
  }

  // Unhandled errors
  console.error('Unhandled error:', err);

  return res.status(500).json({
    error: {
      message: process.env.NODE_ENV === 'production'
        ? i18next.t('server:errors.internal')
        : err.message,
      statusCode: 500,
    },
  });
}
