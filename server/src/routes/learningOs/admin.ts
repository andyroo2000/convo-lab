import type { NextFunction, Response } from 'express';

import { prisma } from '../../db/client.js';
import type { AuthRequest } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
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
  if (response.status === 422) {
    return new AppError('Custom code must be 6-20 alphanumeric characters', 400);
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
  method: 'POST' | 'DELETE',
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

export async function deleteLearningOsAdminUser(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!isUuid(req.params.id)) throw new AppError('User not found', 404);

    const { payload, response } = await fetchAdminMutation(
      req,
      `/users/${encodeURIComponent(req.params.id)}`,
      'DELETE'
    );
    if (!response.ok && response.status !== 404) throw mutationError(response, payload);

    const cleanup = await prisma.user.deleteMany({ where: { id: req.params.id } });
    if (response.status === 404 && cleanup.count === 0) throw mutationError(response, payload);
    if (response.ok && responseMessage(payload) !== 'User deleted successfully') {
      throw invalidResponse();
    }

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
    const customCode = req.body?.customCode;
    if (
      customCode !== undefined &&
      (typeof customCode !== 'string' || !/^[A-Za-z0-9]{6,20}$/.test(customCode))
    ) {
      throw new AppError('Custom code must be 6-20 alphanumeric characters', 400);
    }

    const { payload, response } = await fetchAdminMutation(
      req,
      '/invite-codes',
      'POST',
      customCode === undefined ? {} : { customCode }
    );
    if (!response.ok) throw mutationError(response, payload);
    if (!isCreatedInviteCode(payload)) throw invalidResponse();

    const invite = await prisma.inviteCode.upsert({
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
      `/invite-codes/${encodeURIComponent(req.params.id)}`,
      'DELETE'
    );
    if (!response.ok && response.status !== 404) throw mutationError(response, payload);

    const cleanup = await prisma.inviteCode.deleteMany({ where: { id: req.params.id } });
    if (response.status === 404 && cleanup.count === 0) throw mutationError(response, payload);
    if (response.ok && responseMessage(payload) !== 'Invite code deleted successfully') {
      throw invalidResponse();
    }

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
