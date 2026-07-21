import type { NextFunction, Response } from 'express';

import type { AuthRequest } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { streamLearningOsMediaResponse } from '../../services/learningOsMediaResponse.js';
import {
  fetchLearningOsProxy,
  resolveLearningOsProxyContext,
} from '../../services/learningOsProxy.js';
import { logGeneration } from '../../services/usageTracker.js';

const API_LABEL = 'Learning OS Script API';
const FETCH_TIMEOUT_MS = 10_000;
const ANNOTATE_TIMEOUT_MS = 120_000;
const UUID_SEGMENT = '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const UUID_PATTERN = new RegExp(`^${UUID_SEGMENT}$`, 'i');
const SCRIPT_STATUSES = new Set(['draft', 'annotated', 'generating', 'ready', 'error']);
const IMAGE_STATUSES = new Set(['pending', 'generating', 'ready', 'partial', 'error']);
const SEGMENT_IMAGE_STATUSES = new Set(['pending', 'generating', 'ready', 'error']);
const RENDER_STATUSES = new Set(['draft', 'generating', 'ready', 'error']);
const JOB_STATES = new Set(['waiting', 'active', 'completed', 'failed']);
const SCRIPT_CREATE_FIELDS = ['sourceText', 'voiceId'] as const;
const SCRIPT_UPDATE_FIELDS = ['title', 'voiceId', 'segments'] as const;
const SCRIPT_IMAGE_FIELDS = ['force'] as const;

type JsonRecord = Record<string, unknown>;
type ScriptMethod = 'GET' | 'POST' | 'PATCH';

const isJsonRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isSafeString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 1_000;

const isContentString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 100_000;

const isNullableContentString = (value: unknown): value is string | null =>
  value === null || isContentString(value);

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && UUID_PATTERN.test(value);

const isEnum = (value: unknown, allowed: ReadonlySet<string>): value is string =>
  typeof value === 'string' && allowed.has(value);

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

async function scriptProxyContext(req: AuthRequest) {
  if (!req.userId) {
    throw new AppError('Authentication required', 401);
  }

  return resolveLearningOsProxyContext(req.userId, API_LABEL);
}

async function fetchScriptResponse(
  req: AuthRequest,
  path: string,
  options: { method?: ScriptMethod; body?: unknown; timeoutMs?: number } = {}
): Promise<unknown> {
  const {
    config: { apiUrl, apiToken },
    user,
  } = await scriptProxyContext(req);
  const upstreamResponse = await fetchLearningOsProxy({
    upstreamUrl: new URL(`${apiUrl}/api/convolab/scripts${path}`),
    apiToken,
    user,
    method: options.method ?? 'GET',
    body: options.body,
    timeoutMs: options.timeoutMs ?? FETCH_TIMEOUT_MS,
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

const rewriteMedia = (value: unknown): JsonRecord | null | false => {
  if (value === null) {
    return null;
  }
  if (!isJsonRecord(value) || !isUuid(value.id) || !isSafeString(value.mediaKind)) {
    return false;
  }
  if (!(value.publicUrl === null || typeof value.publicUrl === 'string')) {
    return false;
  }

  return { ...value, publicUrl: `/api/scripts/media/${value.id}` };
};

const rewriteSegment = (value: unknown, scriptId: string): JsonRecord | null => {
  if (
    !isJsonRecord(value) ||
    !isUuid(value.id) ||
    value.scriptId !== scriptId ||
    !Number.isInteger(value.order) ||
    !isContentString(value.text) ||
    !isNullableContentString(value.reading) ||
    !isContentString(value.translation) ||
    !isEnum(value.imageStatus, SEGMENT_IMAGE_STATUSES) ||
    !(value.imageMediaId === null || isUuid(value.imageMediaId))
  ) {
    return null;
  }
  const media = rewriteMedia(value.imageMedia);
  if (media === false || (media !== null && media.id !== value.imageMediaId)) {
    return null;
  }

  return { ...value, imageMedia: media };
};

const rewriteRender = (value: unknown, scriptId: string, episodeId: string): JsonRecord | null => {
  if (
    !isJsonRecord(value) ||
    !isUuid(value.id) ||
    value.scriptId !== scriptId ||
    !['0.75', '0.85', '1.0'].includes(String(value.speed)) ||
    typeof value.numericSpeed !== 'number' ||
    !Number.isFinite(value.numericSpeed) ||
    !isEnum(value.status, RENDER_STATUSES) ||
    !(value.audioUrl === null || typeof value.audioUrl === 'string')
  ) {
    return null;
  }
  if (value.audioUrl === null) {
    return value;
  }

  return { ...value, audioUrl: `/api/scripts/${episodeId}/audio/${value.id}` };
};

const rewriteScript = (
  value: unknown,
  expectedEpisodeId?: string,
  allowMissingCollections = false
): JsonRecord | null => {
  if (
    !isJsonRecord(value) ||
    !isUuid(value.id) ||
    !isUuid(value.episodeId) ||
    (expectedEpisodeId !== undefined &&
      value.episodeId.toLowerCase() !== expectedEpisodeId.toLowerCase()) ||
    !isEnum(value.status, SCRIPT_STATUSES) ||
    !isEnum(value.imageStatus, IMAGE_STATUSES) ||
    !isSafeString(value.voiceId) ||
    value.voiceProvider !== 'google' ||
    (!allowMissingCollections && !Array.isArray(value.segments)) ||
    (!allowMissingCollections && !Array.isArray(value.renders))
  ) {
    return null;
  }
  const scriptId = value.id;
  const episodeId = value.episodeId;
  const rawSegments = Array.isArray(value.segments) ? value.segments : [];
  const rawRenders = Array.isArray(value.renders) ? value.renders : [];
  const segments = rawSegments.map((segment) => rewriteSegment(segment, scriptId));
  const renders = rawRenders.map((render) => rewriteRender(render, scriptId, episodeId));
  if (segments.some((segment) => segment === null) || renders.some((render) => render === null)) {
    return null;
  }

  return { ...value, segments, renders };
};

const rewriteEpisode = (value: unknown): JsonRecord | null => {
  if (
    !isJsonRecord(value) ||
    !isUuid(value.id) ||
    !isUuid(value.userId) ||
    value.contentType !== 'script' ||
    !isSafeString(value.title) ||
    !isContentString(value.sourceText)
  ) {
    return null;
  }
  const script = rewriteScript(value.audioScript, value.id, true);

  return script === null ? null : { ...value, audioScript: script };
};

const isQueueResponse = (value: unknown): value is JsonRecord =>
  isJsonRecord(value) &&
  isUuid(value.jobId) &&
  isSafeString(value.message) &&
  (value.existing === undefined || value.existing === true);

const isJobResponse = (value: unknown, expectedJobId: string): value is JsonRecord =>
  isJsonRecord(value) &&
  isUuid(value.id) &&
  value.id.toLowerCase() === expectedJobId.toLowerCase() &&
  isEnum(value.state, JOB_STATES) &&
  typeof value.progress === 'number' &&
  Number.isInteger(value.progress) &&
  value.progress >= 0 &&
  value.progress <= 100 &&
  (value.result === null || (isJsonRecord(value.result) && isUuid(value.result.episodeId)));

const invalidResponse = (operation: string): AppError =>
  new AppError(`${API_LABEL} returned an invalid ${operation} response.`, 502);

export async function storeLearningOsScript(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const payload = rewriteEpisode(
      await fetchScriptResponse(req, '', {
        method: 'POST',
        body: pickBody(req.body, SCRIPT_CREATE_FIELDS),
      })
    );
    if (payload === null) throw invalidResponse('create');
    await logGeneration(req.userId!, 'script', String(payload.id));
    res.json(payload);
  } catch (error) {
    next(error);
  }
}

export async function annotateLearningOsScript(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const payload = rewriteScript(
      await fetchScriptResponse(req, `/${encodeURIComponent(req.params.episodeId)}/annotate`, {
        method: 'POST',
        timeoutMs: ANNOTATE_TIMEOUT_MS,
      }),
      req.params.episodeId
    );
    if (payload === null) throw invalidResponse('annotation');
    res.json(payload);
  } catch (error) {
    next(error);
  }
}

export async function updateLearningOsScriptSegments(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const payload = rewriteScript(
      await fetchScriptResponse(req, `/${encodeURIComponent(req.params.episodeId)}/segments`, {
        method: 'PATCH',
        body: pickBody(req.body, SCRIPT_UPDATE_FIELDS),
      }),
      req.params.episodeId
    );
    if (payload === null) throw invalidResponse('segment update');
    res.json(payload);
  } catch (error) {
    next(error);
  }
}

async function queueScriptOperation(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
  operation: 'render' | 'images'
): Promise<void> {
  try {
    const payload = await fetchScriptResponse(
      req,
      `/${encodeURIComponent(req.params.episodeId)}/${operation}`,
      {
        method: 'POST',
        body: operation === 'images' ? pickBody(req.body, SCRIPT_IMAGE_FIELDS) : undefined,
      }
    );
    if (!isQueueResponse(payload)) throw invalidResponse(operation);
    res.json(payload);
  } catch (error) {
    next(error);
  }
}

export const renderLearningOsScript = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => queueScriptOperation(req, res, next, 'render');

export const generateLearningOsScriptImages = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => queueScriptOperation(req, res, next, 'images');

export async function showLearningOsScript(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const payload = rewriteScript(
      await fetchScriptResponse(req, `/${encodeURIComponent(req.params.episodeId)}/status`),
      req.params.episodeId
    );
    if (payload === null) throw invalidResponse('status');
    res.set('Cache-Control', 'private, no-store');
    res.json(payload);
  } catch (error) {
    next(error);
  }
}

export async function showLearningOsScriptJob(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const payload = await fetchScriptResponse(req, `/job/${encodeURIComponent(req.params.jobId)}`);
    if (!isJobResponse(payload, req.params.jobId)) throw invalidResponse('job');
    res.set('Cache-Control', 'private, no-store');
    res.json(payload);
  } catch (error) {
    next(error);
  }
}

async function streamScriptMedia(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
  kind: 'image' | 'audio'
): Promise<void> {
  try {
    const episodeId = req.params.episodeId;
    const objectId = kind === 'image' ? req.params.mediaId : req.params.renderId;
    if (!isUuid(objectId) || (kind === 'audio' && !isUuid(episodeId))) {
      throw new AppError(`Script ${kind} not found.`, 404);
    }
    const range = req.header('Range')?.trim();
    if (
      kind === 'audio' &&
      range !== undefined &&
      (range.length > 100 || !/^bytes=(?:\d+-\d*|-\d+)$/.test(range))
    ) {
      throw new AppError('Invalid script audio byte range.', 400);
    }
    const {
      config: { apiUrl, apiToken },
      user,
    } = await scriptProxyContext(req);
    const path =
      kind === 'image'
        ? `/api/convolab/scripts/media/${encodeURIComponent(objectId)}`
        : `/api/convolab/scripts/${encodeURIComponent(episodeId)}/audio/${encodeURIComponent(objectId)}`;
    const upstreamResponse = await fetchLearningOsProxy({
      upstreamUrl: new URL(`${apiUrl}${path}`),
      apiToken,
      user,
      method: 'GET',
      additionalHeaders:
        kind === 'audio'
          ? { Accept: 'audio/mpeg', ...(range === undefined ? {} : { Range: range }) }
          : { Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif' },
      timeoutMs: FETCH_TIMEOUT_MS,
      timeoutMessage: `${API_LABEL} request timed out.`,
      networkErrorMessage: `${API_LABEL} is unavailable.`,
    });
    if (upstreamResponse.status === 404) {
      throw new AppError(`Script ${kind} not found.`, 404);
    }
    if (!upstreamResponse.ok) {
      throw new AppError(`${API_LABEL} request failed.`, 502);
    }

    await streamLearningOsMediaResponse(upstreamResponse, res, {
      invalidHeadersMessage: `${API_LABEL} returned invalid ${kind} headers.`,
      isAllowedContentType: (contentType) =>
        kind === 'audio'
          ? /^audio\/mpeg(?:\s*;|$)/i.test(contentType)
          : /^image\/(?:gif|jpeg|png|webp)(?:\s*;|$)/i.test(contentType),
    });
  } catch (error) {
    next(error);
  }
}

export const streamLearningOsScriptImage = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => streamScriptMedia(req, res, next, 'image');

export const streamLearningOsScriptAudio = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => streamScriptMedia(req, res, next, 'audio');
