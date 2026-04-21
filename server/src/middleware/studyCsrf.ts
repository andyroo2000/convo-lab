import type { NextFunction, Response } from 'express';

import type { AuthRequest } from './auth.js';
import { AppError } from './errorHandler.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const DEVELOPMENT_STUDY_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
];

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
  const origins = new Set<string>();
  const configuredClientOrigin = toOrigin(process.env.CLIENT_URL);

  if (configuredClientOrigin) {
    origins.add(configuredClientOrigin);
  }

  if (process.env.NODE_ENV !== 'production') {
    DEVELOPMENT_STUDY_ORIGINS.forEach((origin) => origins.add(origin));
  }

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
  const refererHeader = req.get('referer');
  // Some same-origin browser requests omit Origin entirely; only fall back to Referer
  // when Origin is absent/blank, not when a present Origin fails validation.
  const sourceOrigin =
    typeof originHeader === 'string' && originHeader.trim().length > 0
      ? toOrigin(originHeader)
      : toOrigin(refererHeader ?? undefined);

  if (!sourceOrigin || !getAllowedStudyOrigins().has(sourceOrigin)) {
    next(new AppError('Invalid request origin.', 403));
    return;
  }

  next();
}
