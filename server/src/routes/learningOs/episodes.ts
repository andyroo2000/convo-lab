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
const EPISODE_CREATE_FIELDS = [
  'title',
  'sourceText',
  'targetLanguage',
  'nativeLanguage',
  'audioSpeed',
  'jlptLevel',
  'autoGenerateAudio',
] as const;
const EPISODE_UPDATE_FIELDS = ['title', 'status'] as const;
const EPISODE_STATUSES = new Set(['draft', 'generating', 'ready', 'error']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type JsonRecord = Record<string, unknown>;
type EpisodeWriteField =
  | (typeof EPISODE_CREATE_FIELDS)[number]
  | (typeof EPISODE_UPDATE_FIELDS)[number];

const isJsonRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isSafeString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 1_000;

const pickEpisodeWriteBody = (body: unknown, fields: readonly EpisodeWriteField[]): JsonRecord => {
  if (!isJsonRecord(body)) {
    return {};
  }

  return Object.fromEntries(
    fields
      .filter((field) => Object.prototype.hasOwnProperty.call(body, field))
      .map((field) => [field, body[field]])
  );
};

async function fetchEpisodeResponse(
  req: AuthRequest,
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
    forwardListQuery?: boolean;
    forwardSafeClientError?: boolean;
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
  const upstreamUrl = new URL(`${apiUrl}/api/convolab/episodes${path}`);

  if (options.forwardListQuery) {
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
    method: options.method ?? 'GET',
    body: options.body,
    timeoutMs: FETCH_TIMEOUT_MS,
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

const isEpisodeResponse = (payload: unknown): payload is JsonRecord =>
  isJsonRecord(payload) &&
  typeof payload.id === 'string' &&
  UUID_PATTERN.test(payload.id) &&
  isSafeString(payload.title) &&
  typeof payload.status === 'string' &&
  EPISODE_STATUSES.has(payload.status);

const isEpisodeMessageResponse = (payload: unknown): payload is JsonRecord =>
  isJsonRecord(payload) && isSafeString(payload.message);

export async function storeLearningOsEpisode(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const payload = await fetchEpisodeResponse(req, '', {
      method: 'POST',
      body: pickEpisodeWriteBody(req.body, EPISODE_CREATE_FIELDS),
      forwardSafeClientError: true,
    });
    if (!isEpisodeResponse(payload)) {
      throw new AppError(`${API_LABEL} returned an invalid create response.`, 502);
    }

    res.json(payload);
  } catch (error) {
    next(error);
  }
}

export async function updateLearningOsEpisode(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const payload = await fetchEpisodeResponse(req, `/${encodeURIComponent(req.params.id)}`, {
      method: 'PATCH',
      body: pickEpisodeWriteBody(req.body, EPISODE_UPDATE_FIELDS),
      forwardSafeClientError: true,
    });
    if (!isEpisodeMessageResponse(payload)) {
      throw new AppError(`${API_LABEL} returned an invalid update response.`, 502);
    }

    res.json({ message: 'Episode updated successfully' });
  } catch (error) {
    next(error);
  }
}

export async function deleteLearningOsEpisode(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const payload = await fetchEpisodeResponse(req, `/${encodeURIComponent(req.params.id)}`, {
      method: 'DELETE',
      forwardSafeClientError: true,
    });
    if (!isEpisodeMessageResponse(payload)) {
      throw new AppError(`${API_LABEL} returned an invalid delete response.`, 502);
    }

    res.json({ message: 'Episode deleted successfully' });
  } catch (error) {
    next(error);
  }
}

export async function listLearningOsEpisodes(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const episodes = await fetchEpisodeResponse(req, '', { forwardListQuery: true });
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
    const episode = await fetchEpisodeResponse(req, `/${encodeURIComponent(req.params.id)}`);
    if (typeof episode !== 'object' || episode === null || Array.isArray(episode)) {
      throw new AppError(`${API_LABEL} returned an invalid detail response.`, 502);
    }

    res.set('Cache-Control', 'private, max-age=60');
    res.json(episode);
  } catch (error) {
    next(error);
  }
}
