import type { Request, RequestHandler } from 'express';

function setRequestCookies(req: Request, cookies: Record<string, string>) {
  (req as Request & { cookies: Record<string, string> }).cookies = cookies;
}

export const testCookieParser: RequestHandler = (req, _res, next) => {
  const rawCookieHeader = req.headers.cookie;
  if (!rawCookieHeader) {
    setRequestCookies(req, {});
    next();
    return;
  }

  const cookies: Record<string, string> = {};
  for (const cookie of rawCookieHeader.split(';')) {
    const separatorIndex = cookie.indexOf('=');
    const name = (separatorIndex >= 0 ? cookie.slice(0, separatorIndex) : cookie).trim();
    if (!name) {
      continue;
    }

    const value = separatorIndex >= 0 ? cookie.slice(separatorIndex + 1).trim() : '';
    cookies[name] = decodeURIComponent(value);
  }

  // These test apps intentionally avoid cookie-parser so CodeQL does not treat
  // inline Express harnesses as unprotected production handlers.
  setRequestCookies(req, cookies);
  next();
};

export function getSetCookieArray(setCookieHeader: string | string[] | undefined): string[] {
  if (Array.isArray(setCookieHeader)) {
    return setCookieHeader;
  }

  return typeof setCookieHeader === 'string' ? [setCookieHeader] : [];
}
