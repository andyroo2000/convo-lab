import type { NextFunction, Response } from 'express';

import type { AuthRequest } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { getEffectiveUserId } from '../../middleware/impersonation.js';
import {
  fetchLearningOsProxy,
  resolveLearningOsProxyContext,
} from '../../services/learningOsProxy.js';

const API_LABEL = 'Learning OS Episode API';
const FETCH_TIMEOUT_MS = 10_000;
const LIST_QUERY_PARAMS = ['library', 'limit', 'offset'] as const;

async function fetchEpisodeResponse(
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
  const upstreamUrl = new URL(`${apiUrl}/api/convolab/episodes${path}`);

  if (forwardListQuery) {
    for (const name of LIST_QUERY_PARAMS) {
      const value = req.query[name];
      if (typeof value === 'string') {
        upstreamUrl.searchParams.set(name, value);
      }
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

export async function listLearningOsEpisodes(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const episodes = await fetchEpisodeResponse(req, '', true);
    if (!Array.isArray(episodes)) {
      throw new AppError(`${API_LABEL} returned an invalid list response.`, 502);
    }

    res.json(episodes);
  } catch (error) {
    next(error);
  }
}

export async function showLearningOsEpisode(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const episode = await fetchEpisodeResponse(req, `/${encodeURIComponent(req.params.id)}`, false);
    if (typeof episode !== 'object' || episode === null || Array.isArray(episode)) {
      throw new AppError(`${API_LABEL} returned an invalid detail response.`, 502);
    }

    res.set('Cache-Control', 'private, max-age=60');
    res.json(episode);
  } catch (error) {
    next(error);
  }
}
