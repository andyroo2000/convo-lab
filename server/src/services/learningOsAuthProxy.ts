import { AppError } from '../middleware/errorHandler.js';

import {
  fetchLearningOsProxy,
  resolveLearningOsServiceProxyContext,
  resolveLearningOsUserProxyContext,
} from './learningOsProxy.js';

const API_LABEL = 'Learning OS Auth API';
const TIMEOUT_MS = 10_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_MILLISECOND_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export interface LearningOsLoginAccount {
  id: string;
  email: string;
  name: string;
  displayName: string | null;
  avatarColor: string | null;
  role: 'user' | 'moderator' | 'admin';
  preferredStudyLanguage: string;
  preferredNativeLanguage: string;
  proficiencyLevel: string;
  onboardingCompleted: boolean;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LearningOsCurrentAccount extends LearningOsLoginAccount {
  seenSampleContentGuide: boolean;
  seenCustomContentGuide: boolean;
}

export async function authenticateLearningOsAccount(
  email: string,
  password: string
): Promise<LearningOsLoginAccount> {
  const { config, user } = await resolveLearningOsServiceProxyContext(API_LABEL);
  const response = await fetchLearningOsProxy({
    upstreamUrl: new URL(`${config.apiUrl}/api/convolab/auth/login`),
    apiToken: config.apiToken,
    user,
    method: 'POST',
    body: { email, password },
    timeoutMs: TIMEOUT_MS,
    timeoutMessage: `${API_LABEL} request timed out.`,
    networkErrorMessage: `${API_LABEL} is unavailable.`,
  });

  const body = await parseJsonResponse(response);
  if (!response.ok) {
    if (response.status === 401 && isMessageResponse(body, 'Invalid credentials.')) {
      throw new AppError('Invalid credentials', 401);
    }
    if (response.status === 429) {
      throw rateLimitError(response);
    }
    throw upstreamFailure(response.status);
  }

  return adaptAccount(body, false);
}

export async function getLearningOsCurrentAccount(
  userId: string
): Promise<LearningOsCurrentAccount> {
  const { config, user } = await resolveLearningOsUserProxyContext(userId, API_LABEL);
  const response = await fetchLearningOsProxy({
    upstreamUrl: new URL(`${config.apiUrl}/api/convolab/auth/me`),
    apiToken: config.apiToken,
    user,
    method: 'GET',
    timeoutMs: TIMEOUT_MS,
    timeoutMessage: `${API_LABEL} request timed out.`,
    networkErrorMessage: `${API_LABEL} is unavailable.`,
  });

  const body = await parseJsonResponse(response);
  if (!response.ok) {
    if (response.status === 404) {
      throw new AppError('User not found', 404);
    }
    throw upstreamFailure(response.status);
  }

  return adaptAccount(body, true);
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  try {
    return JSON.parse(await response.text());
  } catch {
    throw new AppError(`${API_LABEL} returned invalid JSON.`, 502);
  }
}

function upstreamFailure(status: number): AppError {
  const statusCode = status === 401 || status === 403 || status >= 500 ? 502 : status;
  return new AppError(`${API_LABEL} request failed.`, statusCode);
}

function rateLimitError(response: Response): AppError {
  const retryAfter = Number.parseInt(response.headers.get('Retry-After') ?? '', 10);
  const metadata =
    Number.isInteger(retryAfter) && retryAfter > 0 && retryAfter <= 3600
      ? { cooldown: { remainingSeconds: retryAfter } }
      : undefined;
  return new AppError('Too many login attempts.', 429, metadata);
}

function isMessageResponse(value: unknown, message: string): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>).message === message
  );
}

function adaptAccount(value: unknown, includeGuideFlags: false): LearningOsLoginAccount;
function adaptAccount(value: unknown, includeGuideFlags: true): LearningOsCurrentAccount;
function adaptAccount(
  value: unknown,
  includeGuideFlags: boolean
): LearningOsLoginAccount | LearningOsCurrentAccount {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw invalidResponse();
  }

  const account = value as Record<string, unknown>;
  if (
    !isBoundedString(account.id, 36) ||
    !UUID_PATTERN.test(account.id) ||
    !isBoundedString(account.email, 320) ||
    !account.email.includes('@') ||
    !isBoundedString(account.name, 255) ||
    !isNullableStringWithin(account.displayName, 255) ||
    !isNullableStringWithin(account.avatarColor, 50) ||
    (account.role !== 'user' && account.role !== 'moderator' && account.role !== 'admin') ||
    !isStringWithin(account.preferredStudyLanguage, 20) ||
    !isStringWithin(account.preferredNativeLanguage, 20) ||
    !isStringWithin(account.proficiencyLevel, 50) ||
    typeof account.onboardingCompleted !== 'boolean' ||
    typeof account.emailVerified !== 'boolean' ||
    !isNullableTimestamp(account.emailVerifiedAt) ||
    !isTimestamp(account.createdAt) ||
    !isTimestamp(account.updatedAt) ||
    (includeGuideFlags &&
      (typeof account.seenSampleContentGuide !== 'boolean' ||
        typeof account.seenCustomContentGuide !== 'boolean'))
  ) {
    throw invalidResponse();
  }

  const result: LearningOsLoginAccount = {
    id: account.id,
    email: account.email,
    name: account.name,
    displayName: account.displayName,
    avatarColor: account.avatarColor,
    role: account.role,
    preferredStudyLanguage: account.preferredStudyLanguage,
    preferredNativeLanguage: account.preferredNativeLanguage,
    proficiencyLevel: account.proficiencyLevel,
    onboardingCompleted: account.onboardingCompleted,
    emailVerified: account.emailVerified,
    emailVerifiedAt: account.emailVerifiedAt,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };

  return includeGuideFlags
    ? {
        ...result,
        seenSampleContentGuide: account.seenSampleContentGuide as boolean,
        seenCustomContentGuide: account.seenCustomContentGuide as boolean,
      }
    : result;
}

function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

function isStringWithin(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length <= maxLength;
}

function isNullableStringWithin(value: unknown, maxLength: number): value is string | null {
  return value === null || isStringWithin(value, maxLength);
}

function isTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    ISO_MILLISECOND_TIMESTAMP.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function isNullableTimestamp(value: unknown): value is string | null {
  return value === null || isTimestamp(value);
}

function invalidResponse(): AppError {
  return new AppError(`${API_LABEL} returned an invalid response.`, 502);
}
