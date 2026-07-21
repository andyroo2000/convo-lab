import type { NextFunction, Response } from 'express';

import type { AuthRequest } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import {
  fetchLearningOsProxy,
  resolveLearningOsProxyContext,
} from '../../services/learningOsProxy.js';

const API_LABEL = 'Learning OS Image API';
const FETCH_TIMEOUT_MS = 10_000;
const IMAGE_GENERATION_FIELDS = ['episodeId', 'dialogueId', 'imageCount'] as const;
const JOB_STATES = new Set(['waiting', 'active', 'completed', 'failed']);
const UUID_SEGMENT = '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const UUID_PATTERN = new RegExp(`^${UUID_SEGMENT}$`, 'i');

type JsonRecord = Record<string, unknown>;

const isJsonRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isSafeString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 1_000;

const isContentString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 100_000;

const isHttpUrl = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2_048) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

const isIsoTimestamp = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
  Number.isFinite(Date.parse(value));

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_PATTERN.test(value);

const isNullableUuid = (value: unknown): value is string | null => value === null || isUuid(value);

const pickImageGenerationBody = (body: unknown): JsonRecord => {
  if (!isJsonRecord(body)) {
    return {};
  }

  return Object.fromEntries(
    IMAGE_GENERATION_FIELDS.filter((field) =>
      Object.prototype.hasOwnProperty.call(body, field)
    ).map((field) => [field, body[field]])
  );
};

async function fetchImageResponse(
  req: AuthRequest,
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown } = {}
): Promise<unknown> {
  if (!req.userId) {
    throw new AppError('Authentication required', 401);
  }

  const {
    config: { apiUrl, apiToken },
    user,
  } = await resolveLearningOsProxyContext(req.userId, API_LABEL);
  const upstreamResponse = await fetchLearningOsProxy({
    upstreamUrl: new URL(`${apiUrl}/api/convolab/images${path}`),
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

    let payload: unknown;
    try {
      payload = await upstreamResponse.json();
    } catch {
      throw new AppError(`${API_LABEL} request failed.`, status);
    }

    const message = isJsonRecord(payload) ? payload.message : undefined;
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
  isJsonRecord(payload) && isUuid(payload.jobId) && isSafeString(payload.message);

const isImageResult = (value: unknown): value is JsonRecord =>
  isJsonRecord(value) &&
  isUuid(value.id) &&
  isUuid(value.episodeId) &&
  isHttpUrl(value.url) &&
  isContentString(value.prompt) &&
  Number.isInteger(value.order) &&
  Number(value.order) >= 0 &&
  isNullableUuid(value.sentenceStartId) &&
  isNullableUuid(value.sentenceEndId) &&
  isIsoTimestamp(value.createdAt);

const isJobResponse = (payload: unknown, expectedJobId: string): payload is JsonRecord => {
  if (
    !isJsonRecord(payload) ||
    !isUuid(payload.id) ||
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
    ? Array.isArray(payload.result) && payload.result.every(isImageResult)
    : payload.result === null;
};

export async function generateLearningOsImages(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const payload = await fetchImageResponse(req, '/generate', {
      method: 'POST',
      body: pickImageGenerationBody(req.body),
    });
    if (!isGenerateResponse(payload)) {
      throw new AppError(`${API_LABEL} returned an invalid generate response.`, 502);
    }

    res.json(payload);
  } catch (error) {
    next(error);
  }
}

export async function showLearningOsImageJob(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const jobId = req.params.jobId;
    const payload = await fetchImageResponse(req, `/job/${encodeURIComponent(jobId)}`);
    if (!isJobResponse(payload, jobId)) {
      throw new AppError(`${API_LABEL} returned an invalid job response.`, 502);
    }

    res.set('Cache-Control', 'private, no-store');
    res.json(payload);
  } catch (error) {
    next(error);
  }
}
