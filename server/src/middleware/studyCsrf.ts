import type { NextFunction, Response } from 'express';

import type { AuthRequest } from './auth.js';
import { AppError } from './errorHandler.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const DEVELOPMENT_STUDY_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
];
let allowedStudyOriginsCache: {
  cacheKey: string;
  origins: Set<string>;
} | null = null;
const warnedStudyOriginCacheKeys = new Set<string>();

function toOrigin(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function getAllowedStudyOrigins(): Set<string> {
  const cacheKey = `${process.env.NODE_ENV ?? ''}:${process.env.CLIENT_URL ?? ''}`;
  if (allowedStudyOriginsCache?.cacheKey === cacheKey) {
    return allowedStudyOriginsCache.origins;
  }

  const origins = new Set<string>();
  const configuredClientOrigin = toOrigin(process.env.CLIENT_URL);

  if (configuredClientOrigin) {
    origins.add(configuredClientOrigin);
  }

  if (process.env.NODE_ENV !== 'production') {
    DEVELOPMENT_STUDY_ORIGINS.forEach((origin) => origins.add(origin));
  }

  if (!configuredClientOrigin && !warnedStudyOriginCacheKeys.has(cacheKey)) {
    console.warn(
      '[Study] CLIENT_URL is missing or invalid; study mutation CSRF checks are using only development origins.'
    );
    warnedStudyOriginCacheKeys.add(cacheKey);
  }

  allowedStudyOriginsCache = {
    cacheKey,
    origins,
  };
  return origins;
}

export function requireSameOriginStudyMutation(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) {
  if (SAFE_METHODS.has(req.method.toUpperCase())) {
    next();
    return;
  }

  const originHeader = req.get('origin');
  const sourceOrigin =
    typeof originHeader === 'string' && originHeader.trim().length > 0
      ? toOrigin(originHeader)
      : null;

  if (!sourceOrigin || !getAllowedStudyOrigins().has(sourceOrigin)) {
    next(new AppError('Invalid request origin.', 403));
    return;
  }

  next();
}
