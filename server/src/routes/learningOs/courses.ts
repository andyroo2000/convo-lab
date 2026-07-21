import type { NextFunction, Response } from 'express';

import { prisma } from '../../db/client.js';
import type { AuthRequest } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { getEffectiveUserId } from '../../middleware/impersonation.js';
import {
  fetchLearningOsProxy,
  resolveLearningOsProxyContext,
} from '../../services/learningOsProxy.js';
import { logGeneration } from '../../services/usageTracker.js';

const API_LABEL = 'Learning OS Course API';
const FETCH_TIMEOUT_MS = 10_000;
const CREATE_TIMEOUT_MS = 100_000;
const LIST_QUERY_PARAMS = ['library', 'limit', 'offset'] as const;
const COURSE_GENERATION_STATUSES = new Set(['draft', 'generating', 'ready', 'error']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type JsonRecord = Record<string, unknown>;

const isJsonRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isSafeString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 1_000;

const isNullableProgress = (value: unknown): value is number | null =>
  value === null ||
  (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100);

const isNullableSafeString = (value: unknown): value is string | null =>
  value === null || isSafeString(value);

const isCourseGenerationStatus = (value: unknown): value is string =>
  typeof value === 'string' && COURSE_GENERATION_STATUSES.has(value);

async function isAdminRequest(req: AuthRequest): Promise<boolean> {
  if (req.role !== undefined) {
    return req.role === 'admin';
  }
  if (!req.userId) {
    return false;
  }

  const actor = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { role: true },
  });

  return actor?.role === 'admin';
}

async function fetchCourseResponse(
  req: AuthRequest,
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
    forwardListQuery?: boolean;
    forwardSafeClientError?: boolean;
    timeoutMs?: number;
  } = {}
): Promise<unknown> {
  if (!req.userId) {
    throw new AppError('Authentication required', 401);
  }

  const effectiveUserId = await getEffectiveUserId(req);
  const {
    config: { apiUrl, apiToken },
    user,
  } = await resolveLearningOsProxyContext(effectiveUserId, API_LABEL);
  const upstreamUrl = new URL(`${apiUrl}/api/convolab/courses${path}`);

  if (options.forwardListQuery) {
    for (const name of LIST_QUERY_PARAMS) {
      const value = req.query[name];
      if (typeof value === 'string') {
        upstreamUrl.searchParams.set(name, value);
      }
    }

    const status = req.query.status;
    if ((status === 'all' || status === 'draft') && (await isAdminRequest(req))) {
      upstreamUrl.searchParams.set('status', status);
    }
  }

  const upstreamResponse = await fetchLearningOsProxy({
    upstreamUrl,
    apiToken,
    user,
    method: options.method ?? 'GET',
    body: options.body,
    timeoutMs: options.timeoutMs ?? FETCH_TIMEOUT_MS,
    timeoutMessage: `${API_LABEL} request timed out.`,
    networkErrorMessage: `${API_LABEL} is unavailable.`,
  });

  if (!upstreamResponse.ok) {
    if (
      upstreamResponse.status === 401 ||
      (upstreamResponse.status === 403 && options.forwardSafeClientError) ||
      upstreamResponse.status >= 500
    ) {
      throw new AppError(`${API_LABEL} request failed.`, 502);
    }

    if (!options.forwardSafeClientError) {
      throw new AppError(`${API_LABEL} request failed.`, upstreamResponse.status);
    }

    let errorPayload: unknown;
    try {
      errorPayload = await upstreamResponse.json();
    } catch {
      throw new AppError(`${API_LABEL} request failed.`, upstreamResponse.status);
    }

    const message = isJsonRecord(errorPayload) ? errorPayload.message : undefined;
    throw new AppError(
      isSafeString(message) ? message : `${API_LABEL} request failed.`,
      upstreamResponse.status
    );
  }

  try {
    return await upstreamResponse.json();
  } catch {
    throw new AppError(`${API_LABEL} returned an invalid JSON response.`, 502);
  }
}

const isCourseResponse = (payload: unknown): payload is JsonRecord =>
  isJsonRecord(payload) &&
  typeof payload.id === 'string' &&
  UUID_PATTERN.test(payload.id) &&
  isSafeString(payload.title) &&
  isCourseGenerationStatus(payload.status);

const isCourseMessageResponse = (payload: unknown): payload is JsonRecord =>
  isJsonRecord(payload) && isSafeString(payload.message);

export async function storeLearningOsCourse(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const payload = await fetchCourseResponse(req, '', {
      method: 'POST',
      body: req.body,
      forwardSafeClientError: true,
      timeoutMs: CREATE_TIMEOUT_MS,
    });
    if (!isCourseResponse(payload)) {
      throw new AppError(`${API_LABEL} returned an invalid create response.`, 502);
    }

    res.json(payload);
  } catch (error) {
    next(error);
  }
}

export async function updateLearningOsCourse(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const payload = await fetchCourseResponse(req, `/${encodeURIComponent(req.params.id)}`, {
      method: 'PATCH',
      body: req.body,
      forwardSafeClientError: true,
    });
    if (!isCourseMessageResponse(payload)) {
      throw new AppError(`${API_LABEL} returned an invalid update response.`, 502);
    }

    // Preserve the existing Convo Lab acknowledgment while Learning OS keeps its own wire text.
    res.json({ message: 'Course updated successfully' });
  } catch (error) {
    next(error);
  }
}

export async function deleteLearningOsCourse(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const payload = await fetchCourseResponse(req, `/${encodeURIComponent(req.params.id)}`, {
      method: 'DELETE',
      forwardSafeClientError: true,
    });
    if (!isCourseMessageResponse(payload)) {
      throw new AppError(`${API_LABEL} returned an invalid delete response.`, 502);
    }

    res.json(payload);
  } catch (error) {
    next(error);
  }
}

export async function listLearningOsCourses(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const courses = await fetchCourseResponse(req, '', { forwardListQuery: true });
    if (!Array.isArray(courses)) {
      throw new AppError(`${API_LABEL} returned an invalid list response.`, 502);
    }

    res.json(courses);
  } catch (error) {
    next(error);
  }
}

export async function showLearningOsCourse(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const course = await fetchCourseResponse(req, `/${encodeURIComponent(req.params.id)}`);
    if (typeof course !== 'object' || course === null || Array.isArray(course)) {
      throw new AppError(`${API_LABEL} returned an invalid detail response.`, 502);
    }

    res.set('Cache-Control', 'private, max-age=60');
    res.json(course);
  } catch (error) {
    next(error);
  }
}

const courseLifecyclePath = (req: AuthRequest, operation: string): string =>
  `/${encodeURIComponent(req.params.id)}/${operation}`;

const isCourseActionResponse = (
  payload: unknown,
  expectedCourseId: string
): payload is JsonRecord =>
  isJsonRecord(payload) &&
  isSafeString(payload.message) &&
  isSafeString(payload.jobId) &&
  payload.courseId === expectedCourseId;

const isCourseResetResponse = (payload: unknown, expectedCourseId: string): payload is JsonRecord =>
  isJsonRecord(payload) && isSafeString(payload.message) && payload.courseId === expectedCourseId;

const isCourseStatusResponse = (payload: unknown): payload is JsonRecord =>
  isJsonRecord(payload) &&
  isCourseGenerationStatus(payload.status) &&
  isNullableProgress(payload.progress) &&
  typeof payload.isStuck === 'boolean' &&
  isNullableSafeString(payload.errorMessage);

async function respondWithCourseAction(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
  operation: 'generate' | 'retry'
): Promise<void> {
  try {
    const payload = await fetchCourseResponse(req, courseLifecyclePath(req, operation), {
      method: 'POST',
      forwardSafeClientError: true,
    });
    if (!isCourseActionResponse(payload, req.params.id)) {
      throw new AppError(`${API_LABEL} returned an invalid ${operation} response.`, 502);
    }

    await logGeneration(req.userId!, 'course', req.params.id);
    res.json(payload);
  } catch (error) {
    next(error);
  }
}

export async function generateLearningOsCourse(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  await respondWithCourseAction(req, res, next, 'generate');
}

export async function showLearningOsCourseGenerationStatus(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const payload = await fetchCourseResponse(req, courseLifecyclePath(req, 'status'), {
      forwardSafeClientError: true,
    });
    if (!isCourseStatusResponse(payload)) {
      throw new AppError(`${API_LABEL} returned an invalid status response.`, 502);
    }

    res.set('Cache-Control', 'private, no-store');
    res.json(payload);
  } catch (error) {
    next(error);
  }
}

export async function resetLearningOsCourseGeneration(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const payload = await fetchCourseResponse(req, courseLifecyclePath(req, 'reset'), {
      method: 'POST',
      forwardSafeClientError: true,
    });
    if (!isCourseResetResponse(payload, req.params.id)) {
      throw new AppError(`${API_LABEL} returned an invalid reset response.`, 502);
    }

    res.json(payload);
  } catch (error) {
    next(error);
  }
}

export async function retryLearningOsCourseGeneration(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  await respondWithCourseAction(req, res, next, 'retry');
}
