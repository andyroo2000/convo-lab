import type { NextFunction, Response } from 'express';

import type { AuthRequest } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import {
  fetchLearningOsProxy,
  resolveLearningOsProxyContext,
} from '../../services/learningOsProxy.js';
import { logGeneration } from '../../services/usageTracker.js';

const API_LABEL = 'Learning OS Dialogue API';
const FETCH_TIMEOUT_MS = 10_000;
const DIALOGUE_GENERATION_FIELDS = [
  'episodeId',
  'speakers',
  'variationCount',
  'dialogueLength',
  'jlptLevel',
  'vocabSeedOverride',
  'grammarSeedOverride',
] as const;
const JOB_STATES = new Set(['waiting', 'active', 'completed', 'failed']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type JsonRecord = Record<string, unknown>;

const isJsonRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isSafeString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 1_000;

const pickDialogueGenerationBody = (body: unknown): JsonRecord => {
  if (!isJsonRecord(body)) {
    return {};
  }

  return Object.fromEntries(
    DIALOGUE_GENERATION_FIELDS.filter((field) =>
      Object.prototype.hasOwnProperty.call(body, field)
    ).map((field) => [field, body[field]])
  );
};

async function fetchDialogueResponse(
  req: AuthRequest,
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown; forwardSafeClientError?: boolean } = {}
): Promise<unknown> {
  if (!req.userId) {
    throw new AppError('Authentication required', 401);
  }

  const {
    config: { apiUrl, apiToken },
    user,
  } = await resolveLearningOsProxyContext(req.userId, API_LABEL);
  const upstreamUrl = new URL(`${apiUrl}/api/convolab/dialogue${path}`);
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
      upstreamResponse.status === 403 ||
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

const isGenerateResponse = (payload: unknown): payload is JsonRecord =>
  isJsonRecord(payload) &&
  typeof payload.jobId === 'string' &&
  UUID_PATTERN.test(payload.jobId) &&
  isSafeString(payload.message);

const isDialogueResult = (value: unknown): value is JsonRecord => {
  if (!isJsonRecord(value) || !isJsonRecord(value.dialogue)) {
    return false;
  }

  return (
    typeof value.dialogue.id === 'string' &&
    UUID_PATTERN.test(value.dialogue.id) &&
    typeof value.dialogue.episodeId === 'string' &&
    UUID_PATTERN.test(value.dialogue.episodeId) &&
    Array.isArray(value.speakers) &&
    Array.isArray(value.sentences)
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

  return payload.state === 'completed' ? isDialogueResult(payload.result) : payload.result === null;
};

export async function generateLearningOsDialogue(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const payload = await fetchDialogueResponse(req, '/generate', {
      method: 'POST',
      body: pickDialogueGenerationBody(req.body),
      forwardSafeClientError: true,
    });
    if (!isGenerateResponse(payload)) {
      throw new AppError(`${API_LABEL} returned an invalid generate response.`, 502);
    }

    const episodeId = isJsonRecord(req.body) ? req.body.episodeId : undefined;
    if (typeof episodeId !== 'string') {
      throw new AppError(`${API_LABEL} accepted a request without an episode identifier.`, 502);
    }

    await logGeneration(req.userId!, 'dialogue', episodeId);
    res.json(payload);
  } catch (error) {
    next(error);
  }
}

export async function showLearningOsDialogueJob(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const jobId = req.params.jobId;
    const payload = await fetchDialogueResponse(req, `/job/${encodeURIComponent(jobId)}`, {
      forwardSafeClientError: true,
    });
    if (!isJobResponse(payload, jobId)) {
      throw new AppError(`${API_LABEL} returned an invalid job response.`, 502);
    }

    res.set('Cache-Control', 'private, no-store');
    res.json(payload);
  } catch (error) {
    next(error);
  }
}
