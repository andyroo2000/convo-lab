import csurf from 'csurf';
import type { CookieOptions, NextFunction, Request, Response } from 'express';

import { AppError } from './errorHandler.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const DEVELOPMENT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
];
const CSRF_EXEMPT_PATHS = new Set(['/webhooks/stripe', '/tools/analytics']);

export const CSRF_SECRET_COOKIE_NAME = '_csrf';
export const CSRF_TOKEN_COOKIE_NAME = 'XSRF-TOKEN';
export const CSRF_TOKEN_HEADER_NAME = 'x-csrf-token';

type CsrfRequest = Request & {
  csrfToken: () => string;
};

let allowedOriginsCache: {
  cacheKey: string;
  origins: Set<string>;
} | null = null;
const warnedOriginCacheKeys = new Set<string>();

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

export function getAllowedApiOrigins(): Set<string> {
  const cacheKey = `${process.env.NODE_ENV ?? ''}:${process.env.CLIENT_URL ?? ''}`;
  if (allowedOriginsCache?.cacheKey === cacheKey) {
    return allowedOriginsCache.origins;
  }

  const origins = new Set<string>();
  const configuredClientOrigin = toOrigin(process.env.CLIENT_URL);

  if (configuredClientOrigin) {
    origins.add(configuredClientOrigin);
  }

  if (process.env.NODE_ENV !== 'production') {
    DEVELOPMENT_ALLOWED_ORIGINS.forEach((origin) => origins.add(origin));
  }

  if (!configuredClientOrigin && !warnedOriginCacheKeys.has(cacheKey)) {
    console.warn(
      '[CSRF] CLIENT_URL is missing or invalid; cookie-auth mutation checks are using only development origins.'
    );
    warnedOriginCacheKeys.add(cacheKey);
  }

  allowedOriginsCache = {
    cacheKey,
    origins,
  };
  return origins;
}

function getCookieSameSite(
  sameSite: CookieOptions['sameSite'] = process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
): CookieOptions['sameSite'] {
  return process.env.NODE_ENV === 'production' ? sameSite : 'lax';
}

function getReadableCsrfCookieOptions(
  sameSite: CookieOptions['sameSite'] = process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
): CookieOptions {
  return {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: getCookieSameSite(sameSite),
    path: '/',
  };
}

function getSecretCsrfCookieOptions(
  sameSite: CookieOptions['sameSite'] = process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
): CookieOptions & { key: string } {
  return {
    key: CSRF_SECRET_COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: getCookieSameSite(sameSite),
    path: '/',
  };
}

function getSecretCsrfClearCookieOptions(
  sameSite: CookieOptions['sameSite'] = process.env.NODE_ENV === 'production' ? 'strict' : 'lax'
): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: getCookieSameSite(sameSite),
    path: '/',
  };
}

const csrfProtection = csurf({
  cookie: getSecretCsrfCookieOptions(),
  value: (req) => req.get(CSRF_TOKEN_HEADER_NAME) ?? '',
});

function isCsrfExemptPath(pathname: string): boolean {
  return CSRF_EXEMPT_PATHS.has(pathname);
}

function validateMutationOrigin(req: Request): AppError | null {
  if (SAFE_METHODS.has(req.method.toUpperCase())) {
    return null;
  }

  const originHeader = req.get('origin');
  const sourceOrigin =
    typeof originHeader === 'string' && originHeader.trim().length > 0
      ? toOrigin(originHeader)
      : null;

  if (!sourceOrigin || !getAllowedApiOrigins().has(sourceOrigin)) {
    return new AppError('Invalid request origin.', 403);
  }

  return null;
}

export function requireApiCsrfProtection(req: Request, res: Response, next: NextFunction) {
  if (isCsrfExemptPath(req.path)) {
    next();
    return;
  }

  const originError = validateMutationOrigin(req);
  if (originError) {
    next(originError);
    return;
  }

  csrfProtection(req, res, (error?: unknown) => {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'EBADCSRFTOKEN'
    ) {
      next(new AppError('Invalid CSRF token.', 403));
      return;
    }

    next(error as Error | undefined);
  });
}

export function issueCsrfTokenCookie(
  req: Request,
  res: Response,
  sameSite?: CookieOptions['sameSite']
): string {
  const requestWithCsrf = req as Partial<CsrfRequest>;
  if (typeof requestWithCsrf.csrfToken !== 'function') {
    throw new AppError('CSRF middleware is not configured for this request.', 500);
  }

  const token = requestWithCsrf.csrfToken();
  res.cookie(CSRF_TOKEN_COOKIE_NAME, token, getReadableCsrfCookieOptions(sameSite));
  return token;
}

export function clearCsrfCookies(res: Response, sameSite?: CookieOptions['sameSite']) {
  res.clearCookie(CSRF_TOKEN_COOKIE_NAME, getReadableCsrfCookieOptions(sameSite));
  res.clearCookie(CSRF_SECRET_COOKIE_NAME, getSecretCsrfClearCookieOptions(sameSite));
}

export function resetAllowedApiOriginsCacheForTests() {
  allowedOriginsCache = null;
  warnedOriginCacheKeys.clear();
}
