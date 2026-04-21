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

function getRequestOrigin(req: AuthRequest): string | null {
  const forwardedProto = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = req.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || req.get('host');

  if (!host) {
    return null;
  }

  const protocol = forwardedProto || req.protocol || 'http';
  return `${protocol}://${host}`;
}

function getAllowedStudyOrigins(req: AuthRequest): Set<string> {
  const origins = new Set<string>();
  const configuredClientOrigin = toOrigin(process.env.CLIENT_URL);

  if (configuredClientOrigin) {
    origins.add(configuredClientOrigin);
  }

  if (process.env.NODE_ENV !== 'production') {
    DEVELOPMENT_STUDY_ORIGINS.forEach((origin) => origins.add(origin));
  }

  const requestOrigin = getRequestOrigin(req);
  if (requestOrigin) {
    origins.add(requestOrigin);
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

  const sourceOrigin = toOrigin(req.get('origin') ?? req.get('referer'));
  const allowedOrigins = getAllowedStudyOrigins(req);

  if (!sourceOrigin || !allowedOrigins.has(sourceOrigin)) {
    next(new AppError('Invalid request origin.', 403));
    return;
  }

  next();
}
