import { doubleCsrf } from 'csrf-csrf';
import type {
  CookieOptions,
  ErrorRequestHandler,
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from 'express';

import {
  getAllowedBrowserOrigins,
  getCsrfSecret as getConfiguredCsrfSecret,
} from '../config/browserRuntime.js';

import { AppError } from './errorHandler.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_EXEMPT_PATHS = new Set(['/webhooks/stripe', '/tools/analytics']);

export const CSRF_TOKEN_COOKIE_NAME = 'XSRF-TOKEN';
export const CSRF_TOKEN_HEADER_NAME = 'x-csrf-token';

type CsrfRequest = Request & {
  csrfToken: () => string;
};

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
  return new Set(getAllowedBrowserOrigins());
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

const { doubleCsrfProtection, generateCsrfToken } = doubleCsrf({
  getSecret: () => getConfiguredCsrfSecret(),
  getSessionIdentifier: (req) =>
    typeof req.cookies?.token === 'string' && req.cookies.token.length > 0
      ? req.cookies.token
      : 'anonymous',
  cookieName: CSRF_TOKEN_COOKIE_NAME,
  cookieOptions: getReadableCsrfCookieOptions(),
  getCsrfTokenFromRequest: (req) => req.get(CSRF_TOKEN_HEADER_NAME) ?? '',
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  errorConfig: {
    code: 'EBADCSRFTOKEN',
    message: 'invalid csrf token',
    statusCode: 403,
  },
});

export const apiCsrfProtection: RequestHandler = doubleCsrfProtection;

export function isCsrfExemptPath(pathname: string): boolean {
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

export function requireAllowedApiMutationOrigin(req: Request, _res: Response, next: NextFunction) {
  const originError = validateMutationOrigin(req);
  if (originError) {
    next(originError);
    return;
  }

  next();
}

function forwardCsrfError(error: unknown, next: NextFunction) {
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
}

export const apiCsrfErrorHandler: ErrorRequestHandler = (error, _req, _res, next) => {
  forwardCsrfError(error, next);
};

export function requireApiCsrfProtection(req: Request, res: Response, next: NextFunction) {
  if (isCsrfExemptPath(req.path)) {
    next();
    return;
  }

  requireAllowedApiMutationOrigin(req, res, (originError?: unknown) => {
    if (originError) {
      next(originError as Error);
      return;
    }

    apiCsrfProtection(req, res, (error?: unknown) => {
      forwardCsrfError(error, next);
    });
  });
}

export function issueCsrfTokenCookie(
  req: Request,
  res: Response,
  sameSite?: CookieOptions['sameSite']
): string {
  const requestWithCsrf = req as Partial<CsrfRequest>;
  if (typeof requestWithCsrf.csrfToken === 'function') {
    return requestWithCsrf.csrfToken({
      cookieOptions: getReadableCsrfCookieOptions(sameSite),
      overwrite: true,
    });
  }

  return generateCsrfToken(req, res, {
    cookieOptions: getReadableCsrfCookieOptions(sameSite),
    overwrite: true,
  });
}

export function clearCsrfCookies(res: Response, sameSite?: CookieOptions['sameSite']) {
  res.clearCookie(CSRF_TOKEN_COOKIE_NAME, getReadableCsrfCookieOptions(sameSite));
}
