import type { NextFunction, Response } from 'express';

import { prisma } from '../../db/client.js';
import type { AuthRequest } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { updateJapanesePronunciationDictionary } from '../../services/japanesePronunciationOverrides.js';
import {
  fetchLearningOsProxy,
  resolveLearningOsServiceProxyContext,
  resolveLearningOsUserProxyContext,
} from '../../services/learningOsProxy.js';

const API_LABEL = 'Learning OS Admin API';
const FETCH_TIMEOUT_MS = 10_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const USER_LIST_QUERY_PARAMS = ['page', 'limit', 'search'] as const;
const INVITE_LIST_QUERY_PARAMS = ['page', 'limit'] as const;
const SPEAKER_AVATAR_FILENAME_PATTERN =
  /^ja-(male|female)-(casual|polite|formal)\.(jpg|jpeg|png|webp)$/i;
const PAGINATION_HEADERS = {
  'X-Pagination-Page': 'x-pagination-page',
  'X-Pagination-Limit': 'x-pagination-limit',
  'X-Pagination-Total': 'x-pagination-total',
  'X-Pagination-Pages': 'x-pagination-pages',
} as const;

type JsonRecord = Record<string, unknown>;
type CreatedInviteCode = {
  id: string;
  code: string;
  usedBy: null;
  usedAt: null;
  createdAt: string;
};
type PaginationMetadata = {
  headers: Record<string, string>;
  page: number;
  limit: number;
  total: number;
  pages: number;
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';

const isNonEmptyString = (value: unknown): value is string => isString(value) && value.length > 0;

const isNullableString = (value: unknown): value is string | null =>
  value === null || isString(value);

const isUuid = (value: unknown): value is string => isString(value) && UUID_PATTERN.test(value);

const isNullableUuid = (value: unknown): value is string | null => value === null || isUuid(value);

const isNonNegativeInteger = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 0;

const isPositiveInteger = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 1;

const isIsoTimestamp = (value: unknown): value is string =>
  isString(value) && value.length > 0 && Number.isFinite(Date.parse(value));

const isNullableIsoTimestamp = (value: unknown): value is string | null =>
  value === null || isIsoTimestamp(value);

const isStringMap = (value: unknown): value is Record<string, string> =>
  isRecord(value) &&
  Object.entries(value).every(([key, entry]) => isNonEmptyString(key) && isNonEmptyString(entry));

const isPronunciationDictionary = (
  value: unknown
): value is {
  keepKanji: string[];
  forceKana: Record<string, string>;
  verbKana: Record<string, string>;
  updatedAt?: string;
} =>
  isRecord(value) &&
  Array.isArray(value.keepKanji) &&
  value.keepKanji.every(isString) &&
  isStringMap(value.forceKana) &&
  isStringMap(value.verbKana) &&
  (value.updatedAt === undefined || isIsoTimestamp(value.updatedAt));

const isSpeakerAvatar = (value: unknown): value is JsonRecord =>
  isRecord(value) &&
  isUuid(value.id) &&
  isString(value.filename) &&
  SPEAKER_AVATAR_FILENAME_PATTERN.test(value.filename) &&
  isNonEmptyString(value.croppedUrl) &&
  isNonEmptyString(value.originalUrl) &&
  value.language === 'ja' &&
  (value.gender === 'male' || value.gender === 'female') &&
  (value.tone === 'casual' || value.tone === 'polite' || value.tone === 'formal') &&
  isIsoTimestamp(value.createdAt) &&
  isIsoTimestamp(value.updatedAt);

const isSpeakerAvatarOriginal = (value: unknown): value is { originalUrl: string } =>
  isRecord(value) && isNonEmptyString(value.originalUrl) && Object.keys(value).length === 1;

const isAdminStats = (value: unknown): value is JsonRecord => {
  if (!isRecord(value) || !isRecord(value.inviteCodes)) return false;

  const inviteCodes = value.inviteCodes;
  return (
    isNonNegativeInteger(value.users) &&
    isNonNegativeInteger(value.episodes) &&
    isNonNegativeInteger(value.courses) &&
    isNonNegativeInteger(inviteCodes.total) &&
    isNonNegativeInteger(inviteCodes.used) &&
    isNonNegativeInteger(inviteCodes.available) &&
    inviteCodes.used + inviteCodes.available === inviteCodes.total
  );
};

const isAdminUser = (value: unknown): value is JsonRecord =>
  isRecord(value) &&
  isUuid(value.id) &&
  isNonEmptyString(value.email) &&
  isNonEmptyString(value.name) &&
  isNullableString(value.displayName) &&
  isNullableString(value.avatarColor) &&
  isNullableString(value.avatarUrl) &&
  isNonEmptyString(value.role) &&
  isIsoTimestamp(value.createdAt) &&
  isIsoTimestamp(value.updatedAt) &&
  isRecord(value._count) &&
  isNonNegativeInteger(value._count.episodes) &&
  isNonNegativeInteger(value._count.courses);

const hasConsistentPagination = (
  page: unknown,
  limit: unknown,
  total: unknown,
  pages: unknown
): boolean =>
  isPositiveInteger(page) &&
  isPositiveInteger(limit) &&
  limit <= 100 &&
  isNonNegativeInteger(total) &&
  isPositiveInteger(pages) &&
  pages === Math.max(1, Math.ceil(total / limit)) &&
  page <= pages;

const isPagination = (value: unknown): value is JsonRecord =>
  isRecord(value) && hasConsistentPagination(value.page, value.limit, value.total, value.pages);

const isAdminUserList = (value: unknown): value is JsonRecord =>
  isRecord(value) &&
  Array.isArray(value.users) &&
  value.users.every(isAdminUser) &&
  isPagination(value.pagination);

const isAdminUserInfo = (value: unknown): value is JsonRecord =>
  isRecord(value) &&
  isUuid(value.id) &&
  isNonEmptyString(value.email) &&
  isNonEmptyString(value.name) &&
  isNullableString(value.displayName) &&
  isNonEmptyString(value.role) &&
  isNullableString(value.avatarColor) &&
  isNullableString(value.avatarUrl) &&
  isNonEmptyString(value.preferredStudyLanguage) &&
  isNonEmptyString(value.preferredNativeLanguage) &&
  typeof value.onboardingCompleted === 'boolean';

const isInviteUser = (value: unknown): value is JsonRecord =>
  isRecord(value) &&
  isUuid(value.id) &&
  isNonEmptyString(value.email) &&
  isNonEmptyString(value.name);

const isAdminInviteCode = (value: unknown): value is JsonRecord => {
  if (
    !isRecord(value) ||
    !isUuid(value.id) ||
    !isNonEmptyString(value.code) ||
    !isNullableUuid(value.usedBy) ||
    !isNullableIsoTimestamp(value.usedAt) ||
    !isIsoTimestamp(value.createdAt) ||
    !(value.user === null || isInviteUser(value.user))
  ) {
    return false;
  }

  if (value.user === null) return value.usedBy === null;

  return isInviteUser(value.user) && value.usedBy === value.user.id;
};

const appendQueryParams = (upstreamUrl: URL, req: AuthRequest, names: readonly string[]): void => {
  for (const name of names) {
    const value = req.query[name];
    if (typeof value === 'string') {
      upstreamUrl.searchParams.set(name, value);
    }
  }
};

async function fetchAdminResponse(
  req: AuthRequest,
  path: string,
  queryParams: readonly string[] = [],
  queryOverrides: Readonly<Record<string, string>> = {}
): Promise<{ payload: unknown; response: globalThis.Response }> {
  const {
    config: { apiUrl, apiToken },
    user,
  } = await resolveLearningOsServiceProxyContext(API_LABEL);
  const upstreamUrl = new URL(`${apiUrl}/api/convolab/admin${path}`);
  appendQueryParams(upstreamUrl, req, queryParams);
  for (const [name, value] of Object.entries(queryOverrides)) {
    upstreamUrl.searchParams.set(name, value);
  }

  const response = await fetchLearningOsProxy({
    upstreamUrl,
    apiToken,
    user,
    method: 'GET',
    timeoutMs: FETCH_TIMEOUT_MS,
    timeoutMessage: `${API_LABEL} request timed out.`,
    networkErrorMessage: `${API_LABEL} is unavailable.`,
  });

  if (!response.ok) {
    const status =
      response.status === 401 || response.status === 403 || response.status >= 500
        ? 502
        : response.status;
    throw new AppError(`${API_LABEL} request failed.`, status);
  }

  try {
    return { payload: await response.json(), response };
  } catch {
    throw new AppError(`${API_LABEL} returned an invalid JSON response.`, 502);
  }
}

const invalidResponse = (): AppError =>
  new AppError(`${API_LABEL} returned an invalid response.`, 502);

const readPaginationHeaders = (response: globalThis.Response): PaginationMetadata => {
  const headers: Record<string, string> = {};
  const pagination: Record<string, number> = {};
  for (const [publicName, upstreamName] of Object.entries(PAGINATION_HEADERS)) {
    const value = response.headers.get(upstreamName);
    if (value === null || !/^\d+$/.test(value)) throw invalidResponse();
    headers[publicName] = value;
    pagination[publicName] = Number(value);
  }

  const page = pagination['X-Pagination-Page'];
  const limit = pagination['X-Pagination-Limit'];
  const total = pagination['X-Pagination-Total'];
  const pages = pagination['X-Pagination-Pages'];
  if (!hasConsistentPagination(page, limit, total, pages)) throw invalidResponse();

  return { headers, page, limit, total, pages };
};

const assertInvitePayload = (payload: unknown): JsonRecord[] => {
  if (!Array.isArray(payload) || !payload.every(isAdminInviteCode)) throw invalidResponse();

  return payload;
};

const isCreatedInviteCode = (value: unknown): value is CreatedInviteCode =>
  isRecord(value) &&
  isUuid(value.id) &&
  isNonEmptyString(value.code) &&
  value.usedBy === null &&
  value.usedAt === null &&
  isIsoTimestamp(value.createdAt);

const responseMessage = (payload: unknown): string | null =>
  isRecord(payload) && isString(payload.message) ? payload.message : null;

const PRONUNCIATION_VALIDATION_MESSAGES = new Set([
  'keepKanji must be an array of strings',
  'keepKanji must contain no more than 500 entries',
  'keepKanji entries must be strings',
  'keepKanji entries must be non-empty strings',
  'keepKanji entries must be <= 64 characters',
  'forceKana must be an object of word-to-kana mappings',
  'forceKana must contain no more than 1000 entries',
  'forceKana values must be strings',
  'forceKana entries must be non-empty strings',
  'forceKana entries must be <= 64 characters',
  'verbKana must be an object of word-to-kana mappings',
  'verbKana must contain no more than 1000 entries',
  'verbKana values must be strings',
  'verbKana entries must be non-empty strings',
  'verbKana entries must be <= 64 characters',
]);

const isPrismaUniqueConstraintError = (error: unknown): boolean =>
  isRecord(error) && error.name === 'PrismaClientKnownRequestError' && error.code === 'P2002';

const mutationError = (response: globalThis.Response, payload: unknown): AppError => {
  const message = responseMessage(payload);
  const allowed = new Map<string, number>([
    ['Cannot delete your own account', 400],
    ['Cannot delete admin users', 403],
    ['User not found', 404],
    ['This code already exists', 400],
    ['Cannot delete used invite codes', 400],
    ['Invite code not found', 404],
    ['Unable to generate invite code', 503],
  ]);
  if (message !== null && allowed.get(message) === response.status) {
    return new AppError(message, response.status);
  }
  if (
    response.status === 400 &&
    message !== null &&
    PRONUNCIATION_VALIDATION_MESSAGES.has(message)
  ) {
    return new AppError(message, 400);
  }
  if (response.status === 429) {
    const retryAfter = response.headers.get('retry-after');
    const seconds = retryAfter !== null && /^\d{1,4}$/.test(retryAfter) ? Number(retryAfter) : null;
    const cooldown =
      seconds !== null && Number.isInteger(seconds) && seconds > 0 && seconds <= 3600
        ? { cooldown: { remainingSeconds: seconds } }
        : undefined;
    return new AppError('Too many admin mutation attempts.', 429, cooldown);
  }

  return new AppError(`${API_LABEL} request failed.`, 502);
};

async function fetchAdminMutation(
  req: AuthRequest,
  path: string,
  method: 'POST' | 'PUT' | 'DELETE',
  body?: unknown
): Promise<{ payload: unknown; response: globalThis.Response }> {
  if (!req.userId) throw new AppError('Authentication required', 401);

  const { config, user } = await resolveLearningOsUserProxyContext(req.userId, API_LABEL, {
    userId: req.userId,
    email: req.email,
    role: req.role,
    accountSource: req.accountSource,
  });
  const response = await fetchLearningOsProxy({
    upstreamUrl: new URL(`${config.apiUrl}/api/convolab/admin${path}`),
    apiToken: config.apiToken,
    user,
    method,
    ...(body === undefined ? {} : { body }),
    timeoutMs: FETCH_TIMEOUT_MS,
    timeoutMessage: `${API_LABEL} request timed out.`,
    networkErrorMessage: `${API_LABEL} is unavailable.`,
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw invalidResponse();
  }

  return { payload, response };
}

async function rollbackCreatedInvite(req: AuthRequest, inviteId: string): Promise<void> {
  try {
    const { payload, response } = await fetchAdminMutation(
      req,
      `/invite-codes/${inviteId}`,
      'DELETE'
    );
    if (!response.ok || responseMessage(payload) !== 'Invite code deleted successfully') {
      throw new AppError(`${API_LABEL} request failed.`, 502);
    }
  } catch (error) {
    console.error(`Unable to roll back Learning OS admin invite ${inviteId}:`, error);
    throw error;
  }
}

async function mirrorCreatedInvite(req: AuthRequest, payload: CreatedInviteCode) {
  try {
    return await prisma.inviteCode.upsert({
      where: { id: payload.id },
      create: {
        id: payload.id,
        code: payload.code,
        usedBy: null,
        usedAt: null,
        createdAt: new Date(payload.createdAt),
      },
      update: {
        code: payload.code,
        usedBy: null,
        usedAt: null,
        createdAt: new Date(payload.createdAt),
      },
    });
  } catch (error) {
    await rollbackCreatedInvite(req, payload.id);
    if (isPrismaUniqueConstraintError(error)) {
      throw new AppError('This code already exists', 400);
    }
    throw new AppError(`${API_LABEL} request failed.`, 502);
  }
}

export async function deleteLearningOsAdminUser(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!isUuid(req.params.id)) throw new AppError('User not found', 404);

    const { payload, response } = await fetchAdminMutation(
      req,
      `/users/${req.params.id}`,
      'DELETE'
    );
    if (!response.ok && response.status !== 404) throw mutationError(response, payload);
    if (response.status === 404 && responseMessage(payload) !== 'User not found') {
      throw mutationError(response, payload);
    }
    if (response.ok && responseMessage(payload) !== 'User deleted successfully') {
      throw invalidResponse();
    }

    const cleanup = await prisma.user.deleteMany({ where: { id: req.params.id } });
    // A canonical 404 plus stale local state is a retry of an already-successful delete.
    if (response.status === 404 && cleanup.count === 0) throw mutationError(response, payload);

    res.set('Cache-Control', 'private, no-store').json({ message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
}

export async function createLearningOsAdminInviteCode(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const requestedCustomCode = req.body?.customCode;
    const customCode = requestedCustomCode ? requestedCustomCode : undefined;
    if (
      customCode !== undefined &&
      (typeof customCode !== 'string' || !/^[A-Za-z0-9]{6,20}$/.test(customCode))
    ) {
      throw new AppError('Custom code must be 6-20 alphanumeric characters', 400);
    }
    if (
      customCode !== undefined &&
      (await prisma.inviteCode.findUnique({ where: { code: customCode } })) !== null
    ) {
      throw new AppError('This code already exists', 400);
    }

    const { payload, response } = await fetchAdminMutation(
      req,
      '/invite-codes',
      'POST',
      customCode === undefined ? {} : { customCode }
    );
    if (!response.ok) throw mutationError(response, payload);
    if (!isCreatedInviteCode(payload)) {
      if (isRecord(payload) && isUuid(payload.id)) {
        await rollbackCreatedInvite(req, payload.id);
      }
      throw invalidResponse();
    }

    const invite = await mirrorCreatedInvite(req, payload);

    res.set('Cache-Control', 'private, no-store').json(invite);
  } catch (error) {
    next(error);
  }
}

export async function deleteLearningOsAdminInviteCode(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!isUuid(req.params.id)) throw new AppError('Invite code not found', 404);

    const { payload, response } = await fetchAdminMutation(
      req,
      `/invite-codes/${req.params.id}`,
      'DELETE'
    );
    if (!response.ok && response.status !== 404) throw mutationError(response, payload);
    if (response.status === 404 && responseMessage(payload) !== 'Invite code not found') {
      throw mutationError(response, payload);
    }
    if (response.ok && responseMessage(payload) !== 'Invite code deleted successfully') {
      throw invalidResponse();
    }

    const cleanup = await prisma.inviteCode.deleteMany({ where: { id: req.params.id } });
    // A canonical 404 plus stale local state is a retry of an already-successful delete.
    if (response.status === 404 && cleanup.count === 0) throw mutationError(response, payload);

    res
      .set('Cache-Control', 'private, no-store')
      .json({ message: 'Invite code deleted successfully' });
  } catch (error) {
    next(error);
  }
}

export async function showLearningOsAdminStats(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { payload } = await fetchAdminResponse(req, '/stats');
    if (!isAdminStats(payload)) throw invalidResponse();

    res.set('Cache-Control', 'private, no-store').json(payload);
  } catch (error) {
    next(error);
  }
}

export async function listLearningOsAdminUsers(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { payload } = await fetchAdminResponse(req, '/users', USER_LIST_QUERY_PARAMS);
    if (!isAdminUserList(payload)) throw invalidResponse();

    res.set('Cache-Control', 'private, no-store').json(payload);
  } catch (error) {
    next(error);
  }
}

export async function showLearningOsAdminUser(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { payload } = await fetchAdminResponse(
      req,
      `/users/${encodeURIComponent(req.params.id)}/info`
    );
    if (!isAdminUserInfo(payload)) throw invalidResponse();

    res.set('Cache-Control', 'private, no-store').json(payload);
  } catch (error) {
    next(error);
  }
}

export async function listLearningOsAdminInviteCodes(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const usesExplicitPagination =
      typeof req.query.page === 'string' || typeof req.query.limit === 'string';

    if (!usesExplicitPagination) {
      const inviteCodes: JsonRecord[] = [];
      let expectedTotal: number | null = null;
      let expectedPages = 1;

      for (let page = 1; page <= expectedPages; page++) {
        const { payload, response } = await fetchAdminResponse(req, '/invite-codes', [], {
          page: String(page),
          limit: '100',
        });
        const pageInviteCodes = assertInvitePayload(payload);
        const pagination = readPaginationHeaders(response);

        if (
          pagination.page !== page ||
          pagination.limit !== 100 ||
          (expectedTotal !== null &&
            (pagination.total !== expectedTotal || pagination.pages !== expectedPages))
        ) {
          throw invalidResponse();
        }

        expectedTotal = pagination.total;
        expectedPages = pagination.pages;
        inviteCodes.push(...pageInviteCodes);
      }

      if (
        inviteCodes.length !== expectedTotal ||
        new Set(inviteCodes.map((inviteCode) => inviteCode.id)).size !== inviteCodes.length
      ) {
        throw invalidResponse();
      }

      res.set('Cache-Control', 'private, no-store').json(inviteCodes);
      return;
    }

    const { payload, response } = await fetchAdminResponse(
      req,
      '/invite-codes',
      INVITE_LIST_QUERY_PARAMS
    );
    const inviteCodes = assertInvitePayload(payload);
    const { headers } = readPaginationHeaders(response);

    res.set({ ...headers, 'Cache-Control': 'private, no-store' }).json(inviteCodes);
  } catch (error) {
    next(error);
  }
}

export async function showLearningOsAdminSpeakerAvatarOriginal(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { filename } = req.params;
    if (!SPEAKER_AVATAR_FILENAME_PATTERN.test(filename)) {
      throw new AppError('Invalid avatar filename format', 400);
    }

    const { payload } = await fetchAdminResponse(
      req,
      `/avatars/speaker/${encodeURIComponent(filename)}/original`
    );
    if (!isSpeakerAvatarOriginal(payload)) throw invalidResponse();

    res.set('Cache-Control', 'private, no-store').json(payload);
  } catch (error) {
    next(error);
  }
}

export async function listLearningOsAdminSpeakerAvatars(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { payload } = await fetchAdminResponse(req, '/avatars/speakers');
    if (!Array.isArray(payload) || !payload.every(isSpeakerAvatar)) throw invalidResponse();

    res.set('Cache-Control', 'private, max-age=3600').json(payload);
  } catch (error) {
    next(error);
  }
}

export async function showLearningOsAdminPronunciationDictionary(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { payload } = await fetchAdminResponse(req, '/pronunciation-dictionaries');
    if (!isPronunciationDictionary(payload)) throw invalidResponse();

    res.set('Cache-Control', 'private, no-store').json(payload);
  } catch (error) {
    next(error);
  }
}

export async function updateLearningOsAdminPronunciationDictionary(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { payload, response } = await fetchAdminMutation(
      req,
      '/pronunciation-dictionaries',
      'PUT',
      req.body
    );
    if (!response.ok) throw mutationError(response, payload);
    if (!isPronunciationDictionary(payload)) throw invalidResponse();

    try {
      // Learning OS is canonical; this mirror only keeps synchronous legacy Express consumers
      // current until their remaining generation routes move to Learning OS.
      await updateJapanesePronunciationDictionary(payload);
    } catch (error) {
      console.error('Unable to mirror Learning OS pronunciation dictionary locally:', error);
      throw new AppError(`${API_LABEL} request failed.`, 502);
    }

    res.set('Cache-Control', 'private, no-store').json(payload);
  } catch (error) {
    next(error);
  }
}
