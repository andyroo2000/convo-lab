import type { NextFunction, Response } from 'express';

import type { AuthRequest } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { streamLearningOsMediaResponse } from '../../services/learningOsMediaResponse.js';
import {
  fetchLearningOsProxy,
  resolveLearningOsUserProxyContext,
} from '../../services/learningOsProxy.js';

const API_LABEL = 'Learning OS Admin API';
const FETCH_TIMEOUT_MS = 10_000;
const COURSE_PROVIDER_TIMEOUT_MS = 120_000;
const PRONUNCIATION_PROVIDER_TIMEOUT_MS = 190_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FISH_AUDIO_VOICE_PATTERN = /^fishaudio:[a-f0-9]{32}$/;
const LANGUAGE_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/;
const SENTENCE_TEST_CURSOR_PATTERN = /^[A-Za-z0-9_-]{1,160}$/;
const SENTENCE_TEST_CURSOR_VALUE_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})\.(\d{3})\|([0-9a-f-]{36})$/i;

type JsonRecord = Record<string, unknown>;
type AdminPronunciationFormat = 'kanji' | 'kana' | 'mixed' | 'furigana_brackets';
type AdminRequestMethod = 'GET' | 'POST';

const ADMIN_PRONUNCIATION_FORMATS = new Set<AdminPronunciationFormat>([
  'kanji',
  'kana',
  'mixed',
  'furigana_brackets',
]);

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';

const isNonEmptyString = (value: unknown): value is string => isString(value) && value.length > 0;

const isNullableString = (value: unknown): value is string | null =>
  value === null || isString(value);

const isUuid = (value: unknown): value is string => isString(value) && UUID_PATTERN.test(value);

const isNonNegativeInteger = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 0;

const isNonNegativeFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const isIsoTimestamp = (value: unknown): value is string =>
  isString(value) && value.length > 0 && Number.isFinite(Date.parse(value));

const invalidResponse = (): AppError =>
  new AppError(`${API_LABEL} returned an invalid response.`, 502);

const responseMessage = (payload: unknown): string | null =>
  isRecord(payload) && isString(payload.message) ? payload.message : null;

const hasExactKeys = (value: JsonRecord, keys: readonly string[]): boolean =>
  Object.keys(value).length === keys.length && keys.every((key) => key in value);

const unicodeLength = (value: string): number => Array.from(value).length;

const isAdminSentenceScriptUnit = (value: unknown): value is JsonRecord => {
  if (!isRecord(value) || !isNonEmptyString(value.type)) return false;

  if (value.type === 'narration_L1') {
    return (
      hasExactKeys(value, ['type', 'text', 'voiceId']) &&
      isNonEmptyString(value.text) &&
      isString(value.voiceId) &&
      FISH_AUDIO_VOICE_PATTERN.test(value.voiceId)
    );
  }
  if (value.type === 'L2') {
    const allowedKeys = new Set(['type', 'text', 'reading', 'translation', 'voiceId', 'speed']);
    return (
      Object.keys(value).every((key) => allowedKeys.has(key)) &&
      isNonEmptyString(value.text) &&
      isString(value.voiceId) &&
      FISH_AUDIO_VOICE_PATTERN.test(value.voiceId) &&
      (value.reading === undefined || isNonEmptyString(value.reading)) &&
      (value.translation === undefined || isNonEmptyString(value.translation)) &&
      (value.speed === undefined ||
        (typeof value.speed === 'number' &&
          Number.isFinite(value.speed) &&
          value.speed >= 0.5 &&
          value.speed <= 2))
    );
  }
  if (value.type === 'pause') {
    return (
      hasExactKeys(value, ['type', 'seconds']) &&
      typeof value.seconds === 'number' &&
      Number.isFinite(value.seconds) &&
      value.seconds >= 0 &&
      value.seconds <= 60
    );
  }
  if (value.type === 'marker') {
    return hasExactKeys(value, ['type', 'label']) && isNonEmptyString(value.label);
  }

  return false;
};

const isNullableAdminSentenceScriptUnits = (value: unknown): boolean =>
  value === null ||
  (Array.isArray(value) && value.length <= 1_000 && value.every(isAdminSentenceScriptUnit));

const isGeneratedAdminSentenceScript = (value: unknown): value is JsonRecord => {
  if (!isRecord(value)) return false;
  const keys = [
    'units',
    'estimatedDurationSeconds',
    'rawResponse',
    'resolvedPrompt',
    'translation',
    'testId',
  ];
  const hasParseError = 'parseError' in value;

  return (
    hasExactKeys(value, hasParseError ? [...keys, 'parseError'] : keys) &&
    isNullableAdminSentenceScriptUnits(value.units) &&
    (value.estimatedDurationSeconds === null ||
      isNonNegativeFiniteNumber(value.estimatedDurationSeconds)) &&
    isString(value.rawResponse) &&
    isString(value.resolvedPrompt) &&
    isNullableString(value.translation) &&
    isUuid(value.testId) &&
    (!hasParseError || isNonEmptyString(value.parseError))
  );
};

const isAdminSentenceScriptTestSummary = (value: unknown): value is JsonRecord =>
  isRecord(value) &&
  hasExactKeys(value, [
    'id',
    'sentence',
    'translation',
    'estimatedDurationSecs',
    'parseError',
    'createdAt',
  ]) &&
  isUuid(value.id) &&
  isNonEmptyString(value.sentence) &&
  isNullableString(value.translation) &&
  (value.estimatedDurationSecs === null ||
    isNonNegativeFiniteNumber(value.estimatedDurationSecs)) &&
  isNullableString(value.parseError) &&
  isIsoTimestamp(value.createdAt);

const isAdminSentenceScriptTestList = (value: unknown): value is JsonRecord =>
  isRecord(value) &&
  hasExactKeys(value, ['tests', 'nextCursor']) &&
  Array.isArray(value.tests) &&
  value.tests.every(isAdminSentenceScriptTestSummary) &&
  (value.nextCursor === null ||
    (isNonEmptyString(value.nextCursor) && isAdminSentenceTestCursor(value.nextCursor)));

const isAdminSentenceScriptTest = (value: unknown, testId: string): value is JsonRecord =>
  isRecord(value) &&
  hasExactKeys(value, [
    'id',
    'userId',
    'sentence',
    'translation',
    'targetLanguage',
    'nativeLanguage',
    'jlptLevel',
    'l1VoiceId',
    'l2VoiceId',
    'promptTemplate',
    'unitsJson',
    'rawResponse',
    'estimatedDurationSecs',
    'parseError',
    'createdAt',
  ]) &&
  value.id === testId &&
  isUuid(value.userId) &&
  isNonEmptyString(value.sentence) &&
  isNullableString(value.translation) &&
  isNonEmptyString(value.targetLanguage) &&
  isNonEmptyString(value.nativeLanguage) &&
  isNullableString(value.jlptLevel) &&
  isString(value.l1VoiceId) &&
  FISH_AUDIO_VOICE_PATTERN.test(value.l1VoiceId) &&
  isString(value.l2VoiceId) &&
  FISH_AUDIO_VOICE_PATTERN.test(value.l2VoiceId) &&
  isString(value.promptTemplate) &&
  isNullableAdminSentenceScriptUnits(value.unitsJson) &&
  isString(value.rawResponse) &&
  (value.estimatedDurationSecs === null ||
    isNonNegativeFiniteNumber(value.estimatedDurationSecs)) &&
  isNullableString(value.parseError) &&
  isIsoTimestamp(value.createdAt);

const isDeletedAdminSentenceScriptTests = (value: unknown): value is JsonRecord =>
  isRecord(value) && hasExactKeys(value, ['deleted']) && isNonNegativeInteger(value.deleted);

const isAdminSentenceTestCursor = (value: string): boolean => {
  if (!SENTENCE_TEST_CURSOR_PATTERN.test(value)) return false;
  try {
    const decoded = Buffer.from(value, 'base64url').toString('utf8');
    const match = SENTENCE_TEST_CURSOR_VALUE_PATTERN.exec(decoded);
    if (!match || !isUuid(match[8])) return false;
    const [year, month, day, hour, minute, second, millisecond] = match.slice(1, 8).map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day &&
      date.getUTCHours() === hour &&
      date.getUTCMinutes() === minute &&
      date.getUTCSeconds() === second &&
      date.getUTCMilliseconds() === millisecond
    );
  } catch {
    return false;
  }
};

const isAdminScriptLabCourseSummary = (value: unknown): value is JsonRecord =>
  isRecord(value) &&
  Object.keys(value).length === 7 &&
  isUuid(value.id) &&
  isNonEmptyString(value.title) &&
  isNonEmptyString(value.status) &&
  isIsoTimestamp(value.createdAt) &&
  typeof value.hasExchanges === 'boolean' &&
  typeof value.hasScript === 'boolean' &&
  typeof value.hasAudio === 'boolean';

const isAdminScriptLabCourseList = (value: unknown): value is JsonRecord =>
  isRecord(value) &&
  Object.keys(value).length === 1 &&
  Array.isArray(value.courses) &&
  value.courses.every(isAdminScriptLabCourseSummary);

const isNullableJsonContainer = (value: unknown): boolean =>
  value === null || isRecord(value) || Array.isArray(value);

const isAdminScriptLabCourse = (value: unknown, courseId: string): value is JsonRecord =>
  isRecord(value) &&
  Object.keys(value).length === 13 &&
  value.id === courseId &&
  isNonEmptyString(value.title) &&
  isNullableString(value.description) &&
  isNonEmptyString(value.status) &&
  isIsoTimestamp(value.createdAt) &&
  isNullableString(value.jlptLevel) &&
  typeof value.hasExchanges === 'boolean' &&
  typeof value.hasScript === 'boolean' &&
  typeof value.hasAudio === 'boolean' &&
  isNullableString(value.audioUrl) &&
  isNullableString(value.sourceText) &&
  isNullableJsonContainer(value.exchanges) &&
  isNullableJsonContainer(value.scriptUnits);

const isCreatedAdminScriptLabCourse = (value: unknown): value is JsonRecord =>
  isRecord(value) &&
  Object.keys(value).length === 2 &&
  isUuid(value.courseId) &&
  value.isTestCourse === true;

const isDeletedAdminScriptLabCourses = (value: unknown): value is JsonRecord =>
  isRecord(value) && Object.keys(value).length === 1 && isNonNegativeInteger(value.deleted);

const canonicalAdminScriptLabAudioPath = (renderingId: string): string =>
  `/api/convolab/admin/script-lab/audio/${renderingId}`;

const publicAdminScriptLabAudioPath = (renderingId: string): string =>
  `/api/admin/script-lab/audio/${renderingId}`;

const adminScriptLabAudioRenderingId = (value: unknown): string | null => {
  if (!isString(value)) return null;

  const match = /^\/api\/convolab\/admin\/script-lab\/audio\/([^/]+)$/.exec(value);
  if (!match || !isUuid(match[1])) return null;

  const renderingId = match[1].toLowerCase();
  return value === canonicalAdminScriptLabAudioPath(renderingId) ? renderingId : null;
};

const PRONUNCIATION_VALIDATION_MESSAGES = new Set([
  'keepKanji must be an array of strings',
  'keepKanji must contain no more than 500 entries',
  'keepKanji entries must be strings',
  'keepKanji entries must be non-empty strings',
  'keepKanji entries must be <= 64 characters',
  'forceKana must be an object of word-to-kana mappings',
  'forceKana must contain no more than 1000 entries',
  'forceKana values must be strings',
  'forceKana entries must be non-empty strings',
  'forceKana entries must be <= 64 characters',
  'verbKana must be an object of word-to-kana mappings',
  'verbKana must contain no more than 1000 entries',
  'verbKana values must be strings',
  'verbKana entries must be non-empty strings',
  'verbKana entries must be <= 64 characters',
]);

const MUTATION_ERROR_STATUSES = new Map<string, number>([
  ['Test course not found', 404],
  ['Sentence test not found', 404],
  ['Sentence script generation is temporarily unavailable', 503],
  ['Episode not found', 404],
  ['Cannot delete non-test courses via Script Lab. Use the standard admin interface.', 400],
  ['Course not found', 404],
  ['Rendering not found', 404],
  ['Line synthesis is temporarily unavailable', 503],
  ['Pronunciation test is temporarily unavailable', 503],
]);

const mutationError = (response: globalThis.Response, payload: unknown): AppError => {
  const message = responseMessage(payload);
  if (message !== null && MUTATION_ERROR_STATUSES.get(message) === response.status) {
    return new AppError(message, response.status);
  }
  if (
    response.status === 400 &&
    message !== null &&
    PRONUNCIATION_VALIDATION_MESSAGES.has(message)
  ) {
    return new AppError(message, 400);
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
  method: AdminRequestMethod | 'DELETE',
  body?: unknown,
  timeoutMs = FETCH_TIMEOUT_MS,
  query: Readonly<Record<string, string>> = {}
): Promise<{ payload: unknown; response: globalThis.Response }> {
  if (!req.userId) throw new AppError('Authentication required', 401);

  const { config, user } = await resolveLearningOsUserProxyContext(req.userId, API_LABEL, {
    userId: req.userId,
    email: req.email,
    role: req.role,
    accountSource: req.accountSource,
  });
  const upstreamUrl = new URL(`${config.apiUrl}/api/convolab/admin${path}`);
  for (const [name, value] of Object.entries(query)) upstreamUrl.searchParams.set(name, value);
  const response = await fetchLearningOsProxy({
    upstreamUrl,
    apiToken: config.apiToken,
    user,
    method,
    ...(body === undefined ? {} : { body }),
    timeoutMs,
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

async function streamLearningOsAdminAudio(
  req: AuthRequest,
  res: Response,
  options: {
    upstreamPath: string;
    notFoundMessage: string;
    invalidRangeMessage: string;
  }
): Promise<void> {
  const range = req.header('Range')?.trim();
  if (range !== undefined && (range.length > 100 || !/^bytes=(?:\d+-\d*|-\d+)$/.test(range))) {
    throw new AppError(options.invalidRangeMessage, 400);
  }
  if (!req.userId) throw new AppError('Authentication required', 401);

  const { config, user } = await resolveLearningOsUserProxyContext(req.userId, API_LABEL, {
    userId: req.userId,
    email: req.email,
    role: req.role,
    accountSource: req.accountSource,
  });
  const upstreamResponse = await fetchLearningOsProxy({
    upstreamUrl: new URL(`${config.apiUrl}${options.upstreamPath}`),
    apiToken: config.apiToken,
    user,
    method: 'GET',
    additionalHeaders: { Accept: 'audio/mpeg', ...(range === undefined ? {} : { Range: range }) },
    timeoutMs: FETCH_TIMEOUT_MS,
    timeoutMessage: `${API_LABEL} request timed out.`,
    networkErrorMessage: `${API_LABEL} is unavailable.`,
  });

  if (upstreamResponse.status === 404) throw new AppError(options.notFoundMessage, 404);
  if (!upstreamResponse.ok) throw new AppError(`${API_LABEL} request failed.`, 502);

  await streamLearningOsMediaResponse(upstreamResponse, res, {
    invalidHeadersMessage: `${API_LABEL} returned invalid media headers.`,
    isAllowedContentType: (contentType) => /^audio\/mpeg(?:\s*;|$)/i.test(contentType),
  });
}

export async function generateLearningOsAdminSentenceScript(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = isRecord(req.body) ? req.body : {};
    const sentence = isString(body.sentence) ? body.sentence.trim() : '';
    if (!sentence) throw new AppError('sentence is required', 400);
    if (unicodeLength(sentence) > 15_000) {
      throw new AppError('sentence must not exceed 15000 characters', 400);
    }

    const forwarded: JsonRecord = { sentence };
    for (const field of ['translation', 'jlptLevel'] as const) {
      const candidate = body[field];
      if (candidate === undefined) continue;
      let value: string | null;
      if (candidate === null) {
        value = null;
      } else if (isString(candidate)) {
        value = candidate.trim() || null;
      } else {
        throw new AppError(`${field} must be a string`, 400);
      }
      const maximum = field === 'translation' ? 15_000 : 32;
      if (value !== null && unicodeLength(value) > maximum) {
        throw new AppError(`${field} is too long`, 400);
      }
      forwarded[field] = value;
    }
    for (const field of ['targetLanguage', 'nativeLanguage'] as const) {
      if (body[field] === undefined) continue;
      const value = isString(body[field]) ? body[field].trim().toLowerCase() : '';
      if (!LANGUAGE_PATTERN.test(value) || value.length > 16) {
        throw new AppError(`${field} is invalid`, 400);
      }
      forwarded[field] = value;
    }
    for (const field of ['l1VoiceId', 'l2VoiceId'] as const) {
      if (body[field] === undefined) continue;
      const value = isString(body[field]) ? body[field].trim().toLowerCase() : '';
      if (!FISH_AUDIO_VOICE_PATTERN.test(value)) {
        throw new AppError(`${field} must be a Fish Audio voice ID`, 400);
      }
      forwarded[field] = value;
    }
    if (body.promptOverride !== undefined) {
      const candidate = body.promptOverride;
      let promptOverride: string | null;
      if (candidate === null) {
        promptOverride = null;
      } else if (isString(candidate)) {
        promptOverride = candidate.trim() || null;
      } else {
        throw new AppError('promptOverride must be a string', 400);
      }
      if (promptOverride !== null && unicodeLength(promptOverride) > 100_000) {
        throw new AppError('promptOverride is too long', 400);
      }
      forwarded.promptOverride = promptOverride;
    }

    const { payload, response } = await fetchAdminMutation(
      req,
      '/script-lab/sentence-script',
      'POST',
      forwarded,
      COURSE_PROVIDER_TIMEOUT_MS
    );
    if (!response.ok) throw mutationError(response, payload);
    if (!isGeneratedAdminSentenceScript(payload)) throw invalidResponse();

    res.set('Cache-Control', 'private, no-store').json(payload);
  } catch (error) {
    next(error);
  }
}

export async function listLearningOsAdminSentenceScriptTests(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const query: Record<string, string> = {};
    if (req.query.limit !== undefined) {
      const limit = req.query.limit;
      if (typeof limit !== 'string' || !/^\d+$/.test(limit)) {
        throw new AppError('limit must be an integer between 1 and 100', 400);
      }
      const parsed = Number(limit);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
        throw new AppError('limit must be an integer between 1 and 100', 400);
      }
      query.limit = String(parsed);
    }
    if (req.query.cursor !== undefined) {
      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor.trim() : '';
      if (!isAdminSentenceTestCursor(cursor)) throw new AppError('cursor is invalid', 400);
      query.cursor = cursor;
    }

    const { payload, response } = await fetchAdminMutation(
      req,
      '/script-lab/sentence-tests',
      'GET',
      undefined,
      FETCH_TIMEOUT_MS,
      query
    );
    if (!response.ok) throw mutationError(response, payload);
    if (!isAdminSentenceScriptTestList(payload)) throw invalidResponse();

    res.set('Cache-Control', 'private, no-store').json(payload);
  } catch (error) {
    next(error);
  }
}

export async function showLearningOsAdminSentenceScriptTest(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const testId = req.params.id?.trim().toLowerCase();
    if (!isUuid(testId)) throw new AppError('Sentence test not found', 404);

    const { payload, response } = await fetchAdminMutation(
      req,
      `/script-lab/sentence-tests/${testId}`,
      'GET'
    );
    if (!response.ok) throw mutationError(response, payload);
    if (!isAdminSentenceScriptTest(payload, testId)) throw invalidResponse();

    res.set('Cache-Control', 'private, no-store').json(payload);
  } catch (error) {
    next(error);
  }
}

export async function deleteLearningOsAdminSentenceScriptTests(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const requestedIds = req.body?.ids;
    if (!Array.isArray(requestedIds) || requestedIds.length < 1 || requestedIds.length > 100) {
      throw new AppError('ids array is required', 400);
    }
    const ids = requestedIds.map((id) => (typeof id === 'string' ? id.trim().toLowerCase() : id));
    if (
      !ids.every((id): id is string => typeof id === 'string' && isUuid(id)) ||
      new Set(ids).size !== ids.length
    ) {
      throw new AppError('ids must contain distinct UUIDs', 400);
    }

    const { payload, response } = await fetchAdminMutation(
      req,
      '/script-lab/sentence-tests',
      'DELETE',
      { ids }
    );
    if (!response.ok) throw mutationError(response, payload);
    if (!isDeletedAdminSentenceScriptTests(payload)) throw invalidResponse();

    res.set('Cache-Control', 'private, no-store').json(payload);
  } catch (error) {
    next(error);
  }
}

export async function testLearningOsAdminPronunciation(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = isRecord(req.body) ? req.body : {};
    const text = isString(body.text) ? body.text.trim() : '';
    const format = isString(body.format) ? body.format.trim().toLowerCase() : '';
    const voiceId = isString(body.voiceId) ? body.voiceId.trim().toLowerCase() : '';
    if (!text || !format || !voiceId) {
      throw new AppError('text, format, and voiceId are required', 400);
    }
    if (unicodeLength(text) > 15_000) {
      throw new AppError('text must not exceed 15000 characters', 400);
    }
    if (!ADMIN_PRONUNCIATION_FORMATS.has(format as AdminPronunciationFormat)) {
      throw new AppError(
        `Invalid format. Must be one of: ${[...ADMIN_PRONUNCIATION_FORMATS].join(', ')}`,
        400
      );
    }
    if (!FISH_AUDIO_VOICE_PATTERN.test(voiceId)) {
      throw new AppError('Only Fish Audio voices are supported for pronunciation tests', 400);
    }
    const speed = body.speed === undefined ? 1 : body.speed;
    if (typeof speed !== 'number' || !Number.isFinite(speed) || speed < 0.5 || speed > 2) {
      throw new AppError('speed must be between 0.5 and 2', 400);
    }

    const normalizedFormat = format as AdminPronunciationFormat;
    const { payload, response } = await fetchAdminMutation(
      req,
      '/script-lab/test-pronunciation',
      'POST',
      { text, format: normalizedFormat, voiceId, speed },
      PRONUNCIATION_PROVIDER_TIMEOUT_MS
    );
    if (!response.ok) throw mutationError(response, payload);
    if (
      !isRecord(payload) ||
      Object.keys(payload).length !== 5 ||
      !isNonEmptyString(payload.preprocessedText) ||
      unicodeLength(payload.preprocessedText) > 100_000 ||
      !isNonNegativeFiniteNumber(payload.durationSeconds) ||
      payload.format !== normalizedFormat ||
      payload.originalText !== text
    ) {
      throw invalidResponse();
    }
    const renderingId = adminScriptLabAudioRenderingId(payload.audioUrl);
    if (renderingId === null) throw invalidResponse();

    res.set('Cache-Control', 'private, no-store').json({
      ...payload,
      audioUrl: publicAdminScriptLabAudioPath(renderingId),
    });
  } catch (error) {
    next(error);
  }
}

export async function synthesizeLearningOsAdminScriptLabLine(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = isRecord(req.body) ? req.body : {};
    const text = isString(body.text) ? body.text.trim() : '';
    const voiceId = isString(body.voiceId) ? body.voiceId.trim().toLowerCase() : '';
    if (!text || !voiceId) throw new AppError('text and voiceId are required', 400);
    if (unicodeLength(text) > 15_000) {
      throw new AppError('text must not exceed 15000 characters', 400);
    }
    if (!FISH_AUDIO_VOICE_PATTERN.test(voiceId)) {
      throw new AppError('Only Fish Audio voices are supported for line synthesis', 400);
    }
    const speed = body.speed === undefined ? 1 : body.speed;
    if (typeof speed !== 'number' || !Number.isFinite(speed) || speed < 0.5 || speed > 2) {
      throw new AppError('speed must be between 0.5 and 2', 400);
    }

    const { payload, response } = await fetchAdminMutation(
      req,
      '/script-lab/synthesize-line',
      'POST',
      { text, voiceId, speed },
      COURSE_PROVIDER_TIMEOUT_MS
    );
    if (!response.ok) throw mutationError(response, payload);
    if (!isRecord(payload) || Object.keys(payload).length !== 1) throw invalidResponse();
    const renderingId = adminScriptLabAudioRenderingId(payload.audioUrl);
    if (renderingId === null) throw invalidResponse();

    res.set('Cache-Control', 'private, no-store').json({
      audioUrl: publicAdminScriptLabAudioPath(renderingId),
    });
  } catch (error) {
    next(error);
  }
}

export async function streamLearningOsAdminScriptLabAudio(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const renderingId = req.params.renderingId?.trim().toLowerCase();
    if (!isUuid(renderingId)) throw new AppError('Rendering not found', 404);

    await streamLearningOsAdminAudio(req, res, {
      upstreamPath: canonicalAdminScriptLabAudioPath(renderingId),
      notFoundMessage: 'Rendering not found',
      invalidRangeMessage: 'Invalid Script Lab audio byte range.',
    });
  } catch (error) {
    next(error);
  }
}

export async function listLearningOsAdminScriptLabCourses(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { payload, response } = await fetchAdminMutation(req, '/script-lab/courses', 'GET');
    if (!response.ok) throw mutationError(response, payload);
    if (!isAdminScriptLabCourseList(payload)) throw invalidResponse();

    res.set('Cache-Control', 'private, no-store').json(payload);
  } catch (error) {
    next(error);
  }
}

export async function showLearningOsAdminScriptLabCourse(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const courseId = req.params.id;
    if (!isUuid(courseId)) throw new AppError('Test course not found', 404);

    const { payload, response } = await fetchAdminMutation(
      req,
      `/script-lab/courses/${courseId}`,
      'GET'
    );
    if (!response.ok) throw mutationError(response, payload);
    if (!isAdminScriptLabCourse(payload, courseId)) throw invalidResponse();

    res.set('Cache-Control', 'private, no-store').json(payload);
  } catch (error) {
    next(error);
  }
}

export async function createLearningOsAdminScriptLabCourse(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = isRecord(req.body) ? req.body : {};
    const title = isString(body.title) ? body.title.trim() : body.title;
    const sourceText = body.sourceText;
    if (
      !isNonEmptyString(title) ||
      title.length > 255 ||
      !isNonEmptyString(sourceText) ||
      sourceText.trim().length === 0
    ) {
      throw new AppError('Title and sourceText are required', 400);
    }

    const optionalFields = [
      'episodeId',
      'targetLanguage',
      'nativeLanguage',
      'jlptLevel',
      'maxDurationMinutes',
      'speaker1Gender',
      'speaker2Gender',
    ] as const;
    const forwarded: JsonRecord = { title, sourceText };
    for (const field of optionalFields) {
      if (body[field] !== undefined) forwarded[field] = body[field];
    }

    const { payload, response } = await fetchAdminMutation(
      req,
      '/script-lab/courses',
      'POST',
      forwarded
    );
    if (!response.ok) throw mutationError(response, payload);
    if (!isCreatedAdminScriptLabCourse(payload)) throw invalidResponse();

    res.set('Cache-Control', 'private, no-store').json(payload);
  } catch (error) {
    next(error);
  }
}

export async function deleteLearningOsAdminScriptLabCourses(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const requestedIds = req.body?.courseIds;
    if (!Array.isArray(requestedIds) || requestedIds.length < 1 || requestedIds.length > 100) {
      throw new AppError('courseIds array is required', 400);
    }

    const courseIds = requestedIds.map((id) =>
      typeof id === 'string' ? id.trim().toLowerCase() : id
    );
    if (
      !courseIds.every((id): id is string => typeof id === 'string' && isUuid(id)) ||
      new Set(courseIds).size !== courseIds.length
    ) {
      throw new AppError('courseIds must contain distinct UUIDs', 400);
    }

    const { payload, response } = await fetchAdminMutation(req, '/script-lab/courses', 'DELETE', {
      courseIds,
    });
    if (!response.ok) throw mutationError(response, payload);
    if (!isDeletedAdminScriptLabCourses(payload)) throw invalidResponse();

    res.set('Cache-Control', 'private, no-store').json(payload);
  } catch (error) {
    next(error);
  }
}
