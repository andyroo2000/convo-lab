import { getClientAppUrl, getClientOrigin } from '../config/browserRuntime.js';
import { AppError } from '../middleware/errorHandler.js';

import {
  parseLearningOsCurrentAccountResponse,
  parseLearningOsLoginResponse,
  parseLearningOsSignupResponse,
  type LearningOsCurrentAccount,
  type LearningOsLoginAccount,
  type LearningOsSignupInput,
} from './learningOsAuthProxy.js';
import {
  fetchLearningOsFirstParty,
  getLearningOsApiUrl,
  type LearningOsFirstPartyRequest,
} from './learningOsProxy.js';

const API_LABEL = 'Learning OS Browser Session API';
const TIMEOUT_MS = 10_000;
const DEFAULT_SESSION_COOKIE_NAME = 'learning_os_session';
const CSRF_COOKIE_NAME = 'XSRF-TOKEN';
const COOKIE_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/u;

export interface LearningOsStartedBrowserSession {
  account: LearningOsLoginAccount;
  sessionCookieValue: string;
}

export function isLearningOsBrowserSessionEnabled(): boolean {
  return process.env.LEARNING_OS_BROWSER_SESSION_ENABLED?.trim().toLowerCase() === 'true';
}

export function getLearningOsBrowserSessionCookieName(): string {
  const name = process.env.LEARNING_OS_SESSION_COOKIE?.trim() || DEFAULT_SESSION_COOKIE_NAME;
  if (!COOKIE_NAME_PATTERN.test(name)) {
    throw new AppError(`${API_LABEL} is enabled but not configured.`, 503);
  }

  return name;
}

export async function authenticateLearningOsBrowserSession(
  email: string,
  password: string
): Promise<LearningOsStartedBrowserSession> {
  return startBrowserSession(
    '/api/convolab/browser/auth/login',
    { email, password },
    parseLearningOsLoginResponse
  );
}

export async function registerLearningOsBrowserSession(
  input: LearningOsSignupInput
): Promise<LearningOsStartedBrowserSession> {
  return startBrowserSession(
    '/api/convolab/browser/auth/signup',
    input,
    parseLearningOsSignupResponse
  );
}

export async function getLearningOsBrowserCurrentAccount(
  sessionCookie: string
): Promise<LearningOsCurrentAccount> {
  const response = await fetchBrowserSession({
    path: '/api/convolab/browser/auth/me',
    method: 'GET',
    sessionCookie: normalizeSessionCookie(sessionCookie),
  });

  if (response.status === 401) {
    throw new AppError('Authentication required', 401);
  }

  return parseLearningOsCurrentAccountResponse(response);
}

export async function destroyLearningOsBrowserSession(sessionCookie: string): Promise<void> {
  const normalizedSession = normalizeSessionCookie(sessionCookie);
  const csrf = await bootstrapCsrf(normalizedSession);
  const response = await fetchBrowserSession({
    path: '/api/convolab/browser/auth/logout',
    method: 'POST',
    sessionCookie: csrf.sessionCookie,
    csrfCookie: csrf.csrfCookie,
    csrfToken: csrf.csrfToken,
  });

  if (response.status === 401) {
    return;
  }
  if (response.status !== 204 || (await response.text()) !== '') {
    throw browserSessionFailure(response.status);
  }
}

async function startBrowserSession(
  path: string,
  body: unknown,
  parseAccount: (response: Response) => Promise<LearningOsLoginAccount>
): Promise<LearningOsStartedBrowserSession> {
  const sessionCookieName = getLearningOsBrowserSessionCookieName();
  const csrf = await bootstrapCsrf();
  const response = await fetchBrowserSession({
    path,
    method: 'POST',
    body,
    sessionCookie: csrf.sessionCookie,
    csrfCookie: csrf.csrfCookie,
    csrfToken: csrf.csrfToken,
  });
  const account = await parseAccount(response);
  const sessionCookieValue = decodedCookieValue(
    requireSetCookie(response, sessionCookieName),
    sessionCookieName
  );

  return { account, sessionCookieValue };
}

async function bootstrapCsrf(existingSessionCookie?: string): Promise<{
  sessionCookie: string;
  csrfCookie: string;
  csrfToken: string;
}> {
  const sessionCookieName = getLearningOsBrowserSessionCookieName();
  const response = await fetchBrowserSession({
    path: '/sanctum/csrf-cookie',
    method: 'GET',
    sessionCookie: existingSessionCookie,
  });
  if (response.status !== 204 || (await response.text()) !== '') {
    throw browserSessionFailure(response.status);
  }

  const sessionCookie = cookiePair(
    requireSetCookie(response, sessionCookieName),
    sessionCookieName
  );
  const csrfCookie = cookiePair(requireSetCookie(response, CSRF_COOKIE_NAME), CSRF_COOKIE_NAME);
  let csrfToken: string;
  try {
    csrfToken = decodeURIComponent(csrfCookie.slice(`${CSRF_COOKIE_NAME}=`.length));
  } catch {
    throw browserSessionFailure(502);
  }

  return { sessionCookie, csrfCookie, csrfToken };
}

function fetchBrowserSession({
  path,
  method,
  body,
  sessionCookie,
  csrfCookie,
  csrfToken,
}: {
  path: string;
  method: string;
  body?: unknown;
  sessionCookie?: string;
  csrfCookie?: string;
  csrfToken?: string;
}): Promise<Response> {
  const apiUrl = getLearningOsApiUrl(API_LABEL);
  const origin = getClientOrigin();
  const headers: Record<string, string> = {
    Origin: origin,
    Referer: `${getClientAppUrl()}/`,
  };
  const cookies = [sessionCookie, csrfCookie].filter(
    (cookie): cookie is string => typeof cookie === 'string'
  );
  if (cookies.length > 0) {
    headers.Cookie = cookies.join('; ');
  }
  if (csrfToken) {
    headers['X-XSRF-TOKEN'] = csrfToken;
  }

  const request: LearningOsFirstPartyRequest = {
    upstreamUrl: new URL(path, `${apiUrl}/`),
    method,
    body,
    additionalHeaders: headers,
    timeoutMs: TIMEOUT_MS,
    timeoutMessage: `${API_LABEL} request timed out.`,
    networkErrorMessage: `${API_LABEL} is unavailable.`,
  };

  return fetchLearningOsFirstParty(request);
}

function normalizeSessionCookie(value: string): string {
  if (!isValidSessionCookieValue(value)) {
    throw new AppError('Authentication required', 401);
  }

  return `${getLearningOsBrowserSessionCookieName()}=${encodeURIComponent(value)}`;
}

function requireSetCookie(response: Response, name: string): string {
  const cookie = response.headers
    .getSetCookie()
    .find((candidate) => candidate.startsWith(`${name}=`));
  if (!cookie) {
    throw browserSessionFailure(502);
  }

  return cookie;
}

function cookiePair(setCookie: string, name: string): string {
  const pair = setCookie.split(';', 1)[0];
  if (!pair.startsWith(`${name}=`) || pair.length === name.length + 1) {
    throw browserSessionFailure(502);
  }

  return pair;
}

function decodedCookieValue(setCookie: string, name: string): string {
  const pair = cookiePair(setCookie, name);
  let value: string;
  try {
    value = decodeURIComponent(pair.slice(name.length + 1));
  } catch {
    throw browserSessionFailure(502);
  }
  if (!isValidSessionCookieValue(value)) {
    throw browserSessionFailure(502);
  }

  return value;
}

function isValidSessionCookieValue(value: string): boolean {
  if (value.length === 0 || value.length > 4096) {
    return false;
  }

  return !Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0)!;
    return character === ';' || /\s/u.test(character) || codePoint <= 31 || codePoint === 127;
  });
}

function browserSessionFailure(status: number): AppError {
  const statusCode = status === 429 ? 429 : 502;
  return new AppError(`${API_LABEL} request failed.`, statusCode);
}
