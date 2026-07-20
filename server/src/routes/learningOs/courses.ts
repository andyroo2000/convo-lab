import type { NextFunction, Response } from 'express';

import { prisma } from '../../db/client.js';
import type { AuthRequest } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { getEffectiveUserId } from '../../middleware/impersonation.js';
import {
  fetchLearningOsProxy,
  resolveLearningOsProxyContext,
} from '../../services/learningOsProxy.js';

const API_LABEL = 'Learning OS Course API';
const FETCH_TIMEOUT_MS = 10_000;
const LIST_QUERY_PARAMS = ['library', 'limit', 'offset'] as const;

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
  forwardListQuery: boolean
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

  if (forwardListQuery) {
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
    method: 'GET',
    timeoutMs: FETCH_TIMEOUT_MS,
    timeoutMessage: `${API_LABEL} request timed out.`,
    networkErrorMessage: `${API_LABEL} is unavailable.`,
  });

  if (!upstreamResponse.ok) {
    const statusCode =
      upstreamResponse.status === 401 || upstreamResponse.status >= 500
        ? 502
        : upstreamResponse.status;
    throw new AppError(`${API_LABEL} request failed.`, statusCode);
  }

  try {
    return await upstreamResponse.json();
  } catch {
    throw new AppError(`${API_LABEL} returned an invalid JSON response.`, 502);
  }
}

export async function listLearningOsCourses(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const courses = await fetchCourseResponse(req, '', true);
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
    const course = await fetchCourseResponse(req, `/${encodeURIComponent(req.params.id)}`, false);
    if (typeof course !== 'object' || course === null || Array.isArray(course)) {
      throw new AppError(`${API_LABEL} returned an invalid detail response.`, 502);
    }

    res.set('Cache-Control', 'private, max-age=60');
    res.json(course);
  } catch (error) {
    next(error);
  }
}
