import type { NextFunction, Response } from 'express';

import type { AuthRequest } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { streamLearningOsMediaResponse } from '../../services/learningOsMediaResponse.js';
import {
  fetchLearningOsProxy,
  resolveLearningOsProxyContext,
} from '../../services/learningOsProxy.js';

const API_LABEL = 'Learning OS Audio API';
const FETCH_TIMEOUT_MS = 10_000;
const AUDIO_GENERATION_FIELDS = ['episodeId', 'dialogueId', 'speed', 'pauseMode'] as const;
const ALL_SPEEDS_FIELDS = ['episodeId', 'dialogueId'] as const;
const JOB_STATES = new Set(['waiting', 'active', 'completed', 'failed']);
const TRACKS = new Set(['default', '0.7', '0.85', '1.0']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AUDIO_PATH_PATTERN =
  /^\/api\/convolab\/episodes\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/audio\/(default|0\.7|0\.85|1\.0)$/i;

type JsonRecord = Record<string, unknown>;

const isJsonRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isSafeString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 1_000;

const pickBody = (body: unknown, fields: readonly string[]): JsonRecord => {
  if (!isJsonRecord(body)) {
    return {};
  }

  return Object.fromEntries(
    fields
      .filter((field) => Object.prototype.hasOwnProperty.call(body, field))
      .map((field) => [field, body[field]])
  );
};

async function audioProxyContext(req: AuthRequest) {
  if (!req.userId) {
    throw new AppError('Authentication required', 401);
  }

  return resolveLearningOsProxyContext(req.userId, API_LABEL);
}

async function fetchAudioJson(
  req: AuthRequest,
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown } = {}
): Promise<unknown> {
  const {
    config: { apiUrl, apiToken },
    user,
  } = await audioProxyContext(req);
  const upstreamResponse = await fetchLearningOsProxy({
    upstreamUrl: new URL(`${apiUrl}/api/convolab/audio${path}`),
    apiToken,
    user,
    method: options.method ?? 'GET',
    body: options.body,
    timeoutMs: FETCH_TIMEOUT_MS,
    timeoutMessage: `${API_LABEL} request timed out.`,
    networkErrorMessage: `${API_LABEL} is unavailable.`,
  });

  if (!upstreamResponse.ok) {
    const status =
      upstreamResponse.status === 401 ||
      upstreamResponse.status === 403 ||
      upstreamResponse.status >= 500
        ? 502
        : upstreamResponse.status;
    if (status === 502) {
      throw new AppError(`${API_LABEL} request failed.`, status);
    }

    let errorPayload: unknown;
    try {
      errorPayload = await upstreamResponse.json();
    } catch {
      throw new AppError(`${API_LABEL} request failed.`, status);
    }
    const message = isJsonRecord(errorPayload) ? errorPayload.message : undefined;
    const retryAfter = upstreamResponse.headers.get('retry-after');
    const cooldownSeconds =
      status === 429 && retryAfter !== null && /^\d{1,6}$/.test(retryAfter)
        ? Number.parseInt(retryAfter, 10)
        : null;
    throw new AppError(
      isSafeString(message) ? message : `${API_LABEL} request failed.`,
      status,
      cooldownSeconds === null ? undefined : { cooldown: { remainingSeconds: cooldownSeconds } }
    );
  }

  try {
    return await upstreamResponse.json();
  } catch {
    throw new AppError(`${API_LABEL} returned an invalid JSON response.`, 502);
  }
}

const isGenerateResponse = (payload: unknown): payload is JsonRecord =>
  isJsonRecord(payload) &&
  typeof payload.jobId === 'string' &&
  UUID_PATTERN.test(payload.jobId) &&
  isSafeString(payload.message) &&
  (payload.existing === undefined || payload.existing === true);

const audioUrlMatch = (value: unknown): RegExpMatchArray | null =>
  typeof value === 'string' ? value.match(AUDIO_PATH_PATTERN) : null;

const isDuration = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const isSentenceTimings = (value: unknown): value is JsonRecord => {
  if (!isJsonRecord(value)) {
    return false;
  }

  return Object.entries(value).every(
    ([sentenceId, timing]) =>
      UUID_PATTERN.test(sentenceId) &&
      isJsonRecord(timing) &&
      typeof timing.startTime === 'number' &&
      Number.isFinite(timing.startTime) &&
      timing.startTime >= 0 &&
      typeof timing.endTime === 'number' &&
      Number.isFinite(timing.endTime) &&
      timing.endTime >= timing.startTime
  );
};

const isSingleResult = (value: unknown): value is JsonRecord =>
  isJsonRecord(value) &&
  audioUrlMatch(value.audioUrl)?.[2] === 'default' &&
  isDuration(value.duration) &&
  isSentenceTimings(value.sentenceTimings);

const isAllSpeedsResult = (value: unknown): value is JsonRecord[] => {
  if (!Array.isArray(value) || value.length !== 3) {
    return false;
  }

  const expectedTracks = new Map([
    [0.7, '0.7'],
    [0.85, '0.85'],
    [1, '1.0'],
  ]);
  const matches = value.map((track) =>
    isJsonRecord(track) ? audioUrlMatch(track.audioUrl) : null
  );

  return (
    value.every((track, index) => {
      const match = matches[index];
      return (
        isJsonRecord(track) &&
        typeof track.speed === 'number' &&
        expectedTracks.get(track.speed) === match?.[2] &&
        isDuration(track.duration)
      );
    }) &&
    new Set(value.map((track) => track.speed)).size === 3 &&
    new Set(matches.map((match) => match?.[1]?.toLowerCase())).size === 1
  );
};

const isJobResponse = (payload: unknown, expectedJobId: string): payload is JsonRecord => {
  if (
    !isJsonRecord(payload) ||
    typeof payload.id !== 'string' ||
    !UUID_PATTERN.test(payload.id) ||
    payload.id.toLowerCase() !== expectedJobId.toLowerCase() ||
    typeof payload.state !== 'string' ||
    !JOB_STATES.has(payload.state) ||
    typeof payload.progress !== 'number' ||
    !Number.isInteger(payload.progress) ||
    payload.progress < 0 ||
    payload.progress > 100
  ) {
    return false;
  }

  return payload.state === 'completed'
    ? isSingleResult(payload.result) || isAllSpeedsResult(payload.result)
    : payload.result === null;
};

export async function generateLearningOsAudio(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const payload = await fetchAudioJson(req, '/generate', {
      method: 'POST',
      body: pickBody(req.body, AUDIO_GENERATION_FIELDS),
    });
    if (!isGenerateResponse(payload)) {
      throw new AppError(`${API_LABEL} returned an invalid generate response.`, 502);
    }

    res.json(payload);
  } catch (error) {
    next(error);
  }
}

export async function generateAllSpeedsLearningOsAudio(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const payload = await fetchAudioJson(req, '/generate-all-speeds', {
      method: 'POST',
      body: pickBody(req.body, ALL_SPEEDS_FIELDS),
    });
    if (!isGenerateResponse(payload)) {
      throw new AppError(`${API_LABEL} returned an invalid generate response.`, 502);
    }

    res.json(payload);
  } catch (error) {
    next(error);
  }
}

export async function showLearningOsAudioJob(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const jobId = req.params.jobId;
    const payload = await fetchAudioJson(req, `/job/${encodeURIComponent(jobId)}`);
    if (!isJobResponse(payload, jobId)) {
      throw new AppError(`${API_LABEL} returned an invalid job response.`, 502);
    }

    res.set('Cache-Control', 'private, no-store');
    res.json(payload);
  } catch (error) {
    next(error);
  }
}

export async function streamLearningOsEpisodeAudio(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { episodeId, track } = req.params;
    if (!UUID_PATTERN.test(episodeId) || !TRACKS.has(track)) {
      throw new AppError('Episode audio not found', 404);
    }

    const range = req.header('Range')?.trim();
    if (range !== undefined && (range.length > 100 || !/^bytes=(?:\d+-\d*|-\d+)$/.test(range))) {
      throw new AppError('Invalid episode audio byte range.', 400);
    }

    const {
      config: { apiUrl, apiToken },
      user,
    } = await audioProxyContext(req);
    const upstreamResponse = await fetchLearningOsProxy({
      upstreamUrl: new URL(
        `${apiUrl}/api/convolab/episodes/${encodeURIComponent(episodeId)}/audio/${encodeURIComponent(track)}`
      ),
      apiToken,
      user,
      method: 'GET',
      additionalHeaders: { Accept: 'audio/mpeg', ...(range === undefined ? {} : { Range: range }) },
      timeoutMs: FETCH_TIMEOUT_MS,
      timeoutMessage: `${API_LABEL} request timed out.`,
      networkErrorMessage: `${API_LABEL} is unavailable.`,
    });

    if (upstreamResponse.status === 404) {
      throw new AppError('Episode audio not found', 404);
    }
    if (!upstreamResponse.ok) {
      throw new AppError(`${API_LABEL} request failed.`, 502);
    }

    await streamLearningOsMediaResponse(upstreamResponse, res, {
      invalidHeadersMessage: `${API_LABEL} returned invalid media headers.`,
      isAllowedContentType: (contentType) => /^audio\/mpeg(?:\s*;|$)/i.test(contentType),
    });
  } catch (error) {
    next(error);
  }
}
