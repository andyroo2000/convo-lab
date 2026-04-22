import type { NextFunction, Response } from 'express';

import type { AuthRequest } from './auth.js';
import { AppError } from './errorHandler.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const DEVELOPMENT_STUDY_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
];
let allowedStudyOriginsCache: Set<string> | null = null;

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
  if (allowedStudyOriginsCache) {
    return allowedStudyOriginsCache;
  }

  const origins = new Set<string>();
  const configuredClientOrigin = toOrigin(process.env.CLIENT_URL);

  if (configuredClientOrigin) {
    origins.add(configuredClientOrigin);
  }

  if (process.env.NODE_ENV !== 'production') {
    DEVELOPMENT_STUDY_ORIGINS.forEach((origin) => origins.add(origin));
  }

  allowedStudyOriginsCache = origins;
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
