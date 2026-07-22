import { AppError } from '../middleware/errorHandler.js';

import {
  CONVO_LAB_USER_ID_PATTERN,
  fetchLearningOsProxy,
  resolveLearningOsServiceProxyContext,
  resolveLearningOsUserProxyContext,
  type LearningOsSessionIdentity,
} from './learningOsProxy.js';

const API_LABEL = 'Learning OS Auth API';
const TIMEOUT_MS = 10_000;
const ISO_MILLISECOND_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const VERIFICATION_TOKEN_PATTERN = /^[0-9a-f]{64}$/;
const PASSWORD_RESET_TOKEN_MAX_LENGTH = 512;

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

export interface LearningOsSignupInput {
  email: string;
  password: string;
  name: string;
  inviteCode: string;
}

export interface LearningOsProfileUpdateInput {
  displayName?: string | null;
  avatarColor?: string;
  avatarUrl?: string | null;
  preferredStudyLanguage?: 'ja';
  preferredNativeLanguage?: 'en';
  proficiencyLevel?: 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
  onboardingCompleted?: boolean;
  seenSampleContentGuide?: boolean;
  seenCustomContentGuide?: boolean;
}

export interface LearningOsPasswordResetInput {
  email: string;
  token: string;
  newPassword: string;
}

export interface LearningOsPasswordChangeInput {
  currentPassword: string;
  newPassword: string;
}

export interface LearningOsAccountDeletionInput {
  currentPassword: string;
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
    // This exact compatibility contract distinguishes rejected user credentials
    // from an invalid service token, which must surface as an upstream failure.
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
  userId: string,
  sessionIdentity?: LearningOsSessionIdentity
): Promise<LearningOsCurrentAccount> {
  const { config, user } = await resolveLearningOsUserProxyContext(
    userId,
    API_LABEL,
    sessionIdentity
  );
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

export async function updateLearningOsCurrentAccount(
  userId: string,
  input: LearningOsProfileUpdateInput,
  sessionIdentity?: LearningOsSessionIdentity
): Promise<LearningOsCurrentAccount> {
  const { config, user } = await resolveLearningOsUserProxyContext(
    userId,
    API_LABEL,
    sessionIdentity
  );
  const response = await fetchLearningOsProxy({
    upstreamUrl: new URL(`${config.apiUrl}/api/convolab/auth/me`),
    apiToken: config.apiToken,
    user,
    method: 'PATCH',
    body: input,
    timeoutMs: TIMEOUT_MS,
    timeoutMessage: `${API_LABEL} request timed out.`,
    networkErrorMessage: `${API_LABEL} is unavailable.`,
  });

  const body = await parseJsonResponse(response);
  if (!response.ok) {
    if (response.status === 404) {
      throw new AppError('User not found', 404);
    }
    if (response.status === 422) {
      throw new AppError('Invalid profile details', 400);
    }
    if (response.status === 429) {
      throw rateLimitError(response, 'Too many profile update attempts.');
    }
    throw upstreamFailure(response.status);
  }

  return adaptAccount(body, true);
}

export async function changeLearningOsCurrentPassword(
  userId: string,
  { currentPassword, newPassword }: LearningOsPasswordChangeInput,
  sessionIdentity?: LearningOsSessionIdentity
): Promise<void> {
  const { config, user } = await resolveLearningOsUserProxyContext(
    userId,
    API_LABEL,
    sessionIdentity
  );
  const response = await fetchLearningOsProxy({
    upstreamUrl: new URL(`${config.apiUrl}/api/me/password`),
    apiToken: config.apiToken,
    user,
    method: 'PUT',
    body: {
      current_password: currentPassword,
      password: newPassword,
      password_confirmation: newPassword,
    },
    timeoutMs: TIMEOUT_MS,
    timeoutMessage: `${API_LABEL} request timed out.`,
    networkErrorMessage: `${API_LABEL} is unavailable.`,
  });

  if (response.ok) {
    if (response.status !== 204 || (await response.text()) !== '') {
      throw invalidResponse();
    }
    return;
  }

  if (response.status === 429) {
    throw rateLimitError(response, 'Too many password change attempts.');
  }
  if (response.status === 404) {
    throw new AppError('User not found', 404);
  }
  if (response.status === 422) {
    const body = await parseJsonResponse(response);
    if (hasValidationError(body, 'current_password')) {
      throw new AppError('Current password is incorrect', 401);
    }
    throw new AppError('Invalid new password', 400);
  }
  throw upstreamFailure(response.status);
}

export async function deleteLearningOsCurrentAccount(
  userId: string,
  { currentPassword }: LearningOsAccountDeletionInput,
  sessionIdentity?: LearningOsSessionIdentity
): Promise<void> {
  const { config, user } = await resolveLearningOsUserProxyContext(
    userId,
    API_LABEL,
    sessionIdentity
  );
  const response = await fetchLearningOsProxy({
    upstreamUrl: new URL(`${config.apiUrl}/api/me`),
    apiToken: config.apiToken,
    user,
    method: 'DELETE',
    body: { current_password: currentPassword },
    timeoutMs: TIMEOUT_MS,
    timeoutMessage: `${API_LABEL} request timed out.`,
    networkErrorMessage: `${API_LABEL} is unavailable.`,
  });

  if (response.ok) {
    if (response.status !== 204 || (await response.text()) !== '') {
      throw invalidResponse();
    }
    return;
  }

  if (response.status === 429) {
    throw rateLimitError(response, 'Too many account deletion attempts.');
  }
  if (response.status === 404) {
    // A prior attempt may have deleted the canonical account before ConvoLab finished
    // cleaning up its local projection. Treat absence as an idempotent delete result.
    return;
  }
  if (response.status === 422) {
    const body = await parseJsonResponse(response);
    if (hasValidationError(body, 'current_password')) {
      throw new AppError('Current password is incorrect', 401);
    }
  }
  throw upstreamFailure(response.status);
}

export async function registerLearningOsAccount(
  input: LearningOsSignupInput
): Promise<LearningOsLoginAccount> {
  const { config, user } = await resolveLearningOsServiceProxyContext(API_LABEL);
  const response = await fetchLearningOsProxy({
    upstreamUrl: new URL(`${config.apiUrl}/api/convolab/auth/signup`),
    apiToken: config.apiToken,
    user,
    method: 'POST',
    body: input,
    timeoutMs: TIMEOUT_MS,
    timeoutMessage: `${API_LABEL} request timed out.`,
    networkErrorMessage: `${API_LABEL} is unavailable.`,
  });

  const body = await parseJsonResponse(response);
  if (!response.ok) {
    if (isSignupFailure(body)) {
      const compatibility = signupFailureCompatibility(body.reason);
      if (response.status === compatibility.status) {
        throw new AppError(compatibility.message, compatibility.status);
      }
    }
    if (response.status === 422) {
      throw new AppError('Invalid signup details', 400);
    }
    if (response.status === 429) {
      throw rateLimitError(response, 'Too many signup attempts.');
    }
    throw upstreamFailure(response.status);
  }

  return adaptAccount(body, false);
}

export async function sendLearningOsVerificationEmail(
  userId: string,
  sessionIdentity?: LearningOsSessionIdentity
): Promise<void> {
  const { config, user } = await resolveLearningOsUserProxyContext(
    userId,
    API_LABEL,
    sessionIdentity
  );
  const response = await fetchLearningOsProxy({
    upstreamUrl: new URL(`${config.apiUrl}/api/convolab/auth/verification/send`),
    apiToken: config.apiToken,
    user,
    method: 'POST',
    timeoutMs: TIMEOUT_MS,
    timeoutMessage: `${API_LABEL} request timed out.`,
    networkErrorMessage: `${API_LABEL} is unavailable.`,
  });
  const body = await parseJsonResponse(response);

  if (!response.ok) {
    if (response.status === 400 && isMessageResponse(body, 'Email is already verified')) {
      throw new AppError('Email already verified', 400);
    }
    if (response.status === 404) {
      throw new AppError('User not found', 404);
    }
    if (response.status === 429) {
      throw rateLimitError(response, 'Too many verification email attempts.');
    }
    throw upstreamFailure(response.status);
  }

  if (!isMessageResponse(body, 'Verification email sent')) {
    throw invalidResponse();
  }
}

export async function verifyLearningOsEmail(
  token: string
): Promise<{ message: string; email: string }> {
  if (!VERIFICATION_TOKEN_PATTERN.test(token)) {
    throw new AppError('Invalid or expired verification token', 400);
  }

  const { config, user } = await resolveLearningOsServiceProxyContext(API_LABEL);
  const response = await fetchLearningOsProxy({
    upstreamUrl: new URL(`${config.apiUrl}/api/convolab/auth/verification`),
    apiToken: config.apiToken,
    user,
    method: 'POST',
    body: { token },
    timeoutMs: TIMEOUT_MS,
    timeoutMessage: `${API_LABEL} request timed out.`,
    networkErrorMessage: `${API_LABEL} is unavailable.`,
  });
  const body = await parseJsonResponse(response);

  if (!response.ok) {
    if (
      response.status === 422 ||
      (response.status === 400 && isMessageResponse(body, 'Invalid or expired verification token'))
    ) {
      throw new AppError('Invalid or expired verification token', 400);
    }
    if (response.status === 429) {
      throw rateLimitError(response, 'Too many verification attempts.');
    }
    throw upstreamFailure(response.status);
  }

  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    (body as Record<string, unknown>).message !== 'Email verified successfully' ||
    !isBoundedString((body as Record<string, unknown>).email, 320) ||
    !(body as Record<string, string>).email.includes('@')
  ) {
    throw invalidResponse();
  }

  return {
    message: 'Email verified successfully',
    email: (body as Record<string, string>).email,
  };
}

export async function sendLearningOsPasswordResetLink(email: unknown): Promise<void> {
  if (typeof email !== 'string') {
    return;
  }

  const normalizedEmail = email.trim();
  if (
    normalizedEmail.length === 0 ||
    normalizedEmail.length > 320 ||
    !normalizedEmail.includes('@')
  ) {
    // Keep malformed and unknown accounts indistinguishable without forwarding unbounded input.
    return;
  }

  const { config, user } = await resolveLearningOsServiceProxyContext(API_LABEL);
  const response = await fetchLearningOsProxy({
    upstreamUrl: new URL(`${config.apiUrl}/api/auth/password/forgot`),
    apiToken: config.apiToken,
    user,
    method: 'POST',
    body: { email: normalizedEmail },
    timeoutMs: TIMEOUT_MS,
    timeoutMessage: `${API_LABEL} request timed out.`,
    networkErrorMessage: `${API_LABEL} is unavailable.`,
  });

  if (response.ok) {
    if (response.status !== 204 || (await response.text()) !== '') {
      throw invalidResponse();
    }
    return;
  }

  if (response.status === 429) {
    throw rateLimitError(response, 'Too many password reset attempts.');
  }
  if (response.status === 400 || response.status === 422) {
    // Preserve the public generic-success contract for malformed and unknown accounts alike.
    return;
  }
  throw upstreamFailure(response.status);
}

export async function resetLearningOsPassword({
  email,
  token,
  newPassword,
}: LearningOsPasswordResetInput): Promise<void> {
  // This is only a coarse proxy guard; Learning OS owns canonical email validation.
  if (
    typeof email !== 'string' ||
    email.length > 320 ||
    !email.includes('@') ||
    email !== email.trim()
  ) {
    throw new AppError('Invalid or expired password reset token', 400);
  }
  if (
    typeof token !== 'string' ||
    token.length === 0 ||
    token.length > PASSWORD_RESET_TOKEN_MAX_LENGTH
  ) {
    throw new AppError('Invalid or expired password reset token', 400);
  }

  const { config, user } = await resolveLearningOsServiceProxyContext(API_LABEL);
  const response = await fetchLearningOsProxy({
    upstreamUrl: new URL(`${config.apiUrl}/api/auth/password/reset`),
    apiToken: config.apiToken,
    user,
    method: 'POST',
    body: {
      email,
      token,
      password: newPassword,
      password_confirmation: newPassword,
    },
    timeoutMs: TIMEOUT_MS,
    timeoutMessage: `${API_LABEL} request timed out.`,
    networkErrorMessage: `${API_LABEL} is unavailable.`,
  });

  if (response.ok) {
    if (response.status !== 204 || (await response.text()) !== '') {
      throw invalidResponse();
    }
    return;
  }

  if (response.status === 429) {
    throw rateLimitError(response, 'Too many password reset attempts.');
  }
  if (response.status === 422) {
    throw new AppError('Invalid or expired password reset token', 400);
  }
  throw upstreamFailure(response.status);
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

function rateLimitError(response: Response, message = 'Too many login attempts.'): AppError {
  const retryAfterHeader = response.headers.get('Retry-After') ?? '';
  const retryAfter = /^\d{1,4}$/.test(retryAfterHeader) ? Number(retryAfterHeader) : Number.NaN;
  const metadata =
    Number.isInteger(retryAfter) && retryAfter > 0 && retryAfter <= 3600
      ? { cooldown: { remainingSeconds: retryAfter } }
      : undefined;
  return new AppError(message, 429, metadata);
}

function isSignupFailure(
  value: unknown
): value is { message: string; reason: SignupFailureReason } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const response = value as Record<string, unknown>;
  return (
    typeof response.message === 'string' &&
    (response.reason === 'invalid_invite' ||
      response.reason === 'used_invite' ||
      response.reason === 'account_exists' ||
      response.reason === 'invalid_credentials')
  );
}

type SignupFailureReason =
  | 'invalid_invite'
  | 'used_invite'
  | 'account_exists'
  | 'invalid_credentials';

function signupFailureCompatibility(reason: SignupFailureReason): {
  message: string;
  status: number;
} {
  switch (reason) {
    case 'invalid_invite':
      return { message: 'Invalid invite code.', status: 400 };
    case 'used_invite':
      return { message: 'This invite code has already been used.', status: 400 };
    case 'account_exists':
      return { message: 'User already exists', status: 400 };
    case 'invalid_credentials':
      return { message: 'Invalid credentials', status: 401 };
  }
}

function isMessageResponse(value: unknown, message: string): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>).message === message
  );
}

function hasValidationError(value: unknown, field: string): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const errors = (value as Record<string, unknown>).errors;
  if (!errors || typeof errors !== 'object' || Array.isArray(errors)) return false;
  const messages = (errors as Record<string, unknown>)[field];
  return Array.isArray(messages) && messages.some((message) => typeof message === 'string');
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
    !CONVO_LAB_USER_ID_PATTERN.test(account.id) ||
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
