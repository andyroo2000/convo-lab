import type { NextFunction, Response } from 'express';

import type { AuthRequest } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import {
  fetchLearningOsProxy,
  resolveLearningOsServiceProxyContext,
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
