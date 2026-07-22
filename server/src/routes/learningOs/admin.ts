import type { NextFunction, Response } from 'express';

import { prisma } from '../../db/client.js';
import type { AuthRequest } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { updateJapanesePronunciationDictionary } from '../../services/japanesePronunciationOverrides.js';
import { streamLearningOsMediaResponse } from '../../services/learningOsMediaResponse.js';
import {
  fetchLearningOsProxy,
  resolveLearningOsServiceProxyContext,
  resolveLearningOsUserProxyContext,
} from '../../services/learningOsProxy.js';

const API_LABEL = 'Learning OS Admin API';
const FETCH_TIMEOUT_MS = 10_000;
const AVATAR_WRITE_TIMEOUT_MS = 30_000;
const COURSE_PROVIDER_TIMEOUT_MS = 120_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FISH_AUDIO_VOICE_PATTERN = /^fishaudio:[a-f0-9]{32}$/;
const LANGUAGE_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/;
const SENTENCE_TEST_CURSOR_PATTERN = /^[A-Za-z0-9_-]{1,160}$/;
const SENTENCE_TEST_CURSOR_VALUE_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})\.(\d{3})\|([0-9a-f-]{36})$/i;
const USER_LIST_QUERY_PARAMS = ['page', 'limit', 'search'] as const;
const INVITE_LIST_QUERY_PARAMS = ['page', 'limit'] as const;
const SPEAKER_AVATAR_FILENAME_PATTERN =
  /^ja-(male|female)-(casual|polite|formal)\.(jpg|jpeg|png|webp)$/i;
const PAGINATION_HEADERS = {
  'X-Pagination-Page': 'x-pagination-page',
  'X-Pagination-Limit': 'x-pagination-limit',
  'X-Pagination-Total': 'x-pagination-total',
  'X-Pagination-Pages': 'x-pagination-pages',
} as const;

type JsonRecord = Record<string, unknown>;
type CreatedInviteCode = {
  id: string;
  code: string;
  usedBy: null;
  usedAt: null;
  createdAt: string;
};
type PaginationMetadata = {
  headers: Record<string, string>;
  page: number;
  limit: number;
  total: number;
  pages: number;
};
type AvatarCropArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};
type SpeakerAvatarMutation = {
  message: string;
  filename: string;
  croppedUrl: string;
  originalUrl: string;
};
type AdminCourseLineRendering = {
  id: string;
  courseId: string;
  unitIndex: number;
  text: string;
  speed: number;
  voiceId: string;
  audioUrl: string;
  createdAt: string;
};
type AdminRequestMethod = 'GET' | 'POST' | 'PUT';

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';

const isNonEmptyString = (value: unknown): value is string => isString(value) && value.length > 0;

const isNullableString = (value: unknown): value is string | null =>
  value === null || isString(value);

const isHttpUrl = (value: unknown): value is string => {
  if (!isNonEmptyString(value)) return false;

  try {
    const url = new URL(value);
    return (
      (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password
    );
  } catch {
    return false;
  }
};

const isUuid = (value: unknown): value is string => isString(value) && UUID_PATTERN.test(value);

const isNullableUuid = (value: unknown): value is string | null => value === null || isUuid(value);

const isNonNegativeInteger = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 0;

const isNonNegativeFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const isPositiveInteger = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= 1;

const isIsoTimestamp = (value: unknown): value is string =>
  isString(value) && value.length > 0 && Number.isFinite(Date.parse(value));

const isNullableIsoTimestamp = (value: unknown): value is string | null =>
  value === null || isIsoTimestamp(value);

const isStringMap = (value: unknown): value is Record<string, string> =>
  isRecord(value) &&
  Object.entries(value).every(([key, entry]) => isNonEmptyString(key) && isNonEmptyString(entry));

const isPronunciationDictionary = (
  value: unknown
): value is {
  keepKanji: string[];
  forceKana: Record<string, string>;
  verbKana: Record<string, string>;
  updatedAt?: string;
} =>
  isRecord(value) &&
  Array.isArray(value.keepKanji) &&
  value.keepKanji.every(isString) &&
  isStringMap(value.forceKana) &&
  isStringMap(value.verbKana) &&
  (value.updatedAt === undefined || isIsoTimestamp(value.updatedAt));

const isSpeakerAvatar = (value: unknown): value is JsonRecord =>
  isRecord(value) &&
  isUuid(value.id) &&
  isString(value.filename) &&
  SPEAKER_AVATAR_FILENAME_PATTERN.test(value.filename) &&
  isNonEmptyString(value.croppedUrl) &&
  isNonEmptyString(value.originalUrl) &&
  value.language === 'ja' &&
  (value.gender === 'male' || value.gender === 'female') &&
  (value.tone === 'casual' || value.tone === 'polite' || value.tone === 'formal') &&
  isIsoTimestamp(value.createdAt) &&
  isIsoTimestamp(value.updatedAt);

const isSpeakerAvatarOriginal = (value: unknown): value is { originalUrl: string } =>
  isRecord(value) && isNonEmptyString(value.originalUrl) && Object.keys(value).length === 1;

const isSpeakerAvatarMutation = (
  value: unknown,
  expectedMessage: string,
  requestedFilename: string
): value is SpeakerAvatarMutation =>
  isRecord(value) &&
  Object.keys(value).length === 4 &&
  value.message === expectedMessage &&
  value.filename === requestedFilename.toLowerCase() &&
  SPEAKER_AVATAR_FILENAME_PATTERN.test(value.filename) &&
  isHttpUrl(value.croppedUrl) &&
  isHttpUrl(value.originalUrl);

const isUserAvatarMutation = (
  value: unknown
): value is { message: 'User avatar uploaded successfully'; avatarUrl: string } =>
  isRecord(value) &&
  Object.keys(value).length === 2 &&
  value.message === 'User avatar uploaded successfully' &&
  isHttpUrl(value.avatarUrl);

const parseCropArea = (value: unknown): AvatarCropArea => {
  let candidate = value;
  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate) as unknown;
    } catch {
      throw new AppError('Invalid crop area', 400);
    }
  }

  if (!isRecord(candidate)) throw new AppError('Invalid crop area', 400);
  const cropArea = candidate as Partial<AvatarCropArea>;
  if (
    ![cropArea.x, cropArea.y, cropArea.width, cropArea.height].every(
      (coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate)
    ) ||
    (cropArea.width as number) <= 0 ||
    (cropArea.height as number) <= 0
  ) {
    throw new AppError('Invalid crop area', 400);
  }

  return cropArea as AvatarCropArea;
};

const avatarFormData = (
  file: Express.Multer.File | undefined,
  cropArea: AvatarCropArea
): FormData => {
  if (!file) throw new AppError('No image file provided', 400);

  const form = new FormData();
  form.set('cropArea', JSON.stringify(cropArea));
  form.set(
    'image',
    new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }),
    file.originalname
  );

  return form;
};

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

const isCreatedInviteCode = (value: unknown): value is CreatedInviteCode =>
  isRecord(value) &&
  isUuid(value.id) &&
  isNonEmptyString(value.code) &&
  value.usedBy === null &&
  value.usedAt === null &&
  isIsoTimestamp(value.createdAt);

const responseMessage = (payload: unknown): string | null =>
  isRecord(payload) && isString(payload.message) ? payload.message : null;

const isRecordList = (value: unknown): value is JsonRecord[] =>
  Array.isArray(value) && value.every(isRecord);

const hasExactKeys = (value: JsonRecord, keys: readonly string[]): boolean =>
  Object.keys(value).length === keys.length && keys.every((key) => key in value);

const unicodeLength = (value: string): number => Array.from(value).length;

const isAdminCoursePrompt = (value: unknown): value is JsonRecord =>
  isRecord(value) &&
  Object.keys(value).length === 2 &&
  isNonEmptyString(value.prompt) &&
  isRecord(value.metadata) &&
  Object.keys(value.metadata).length === 3 &&
  isPositiveInteger(value.metadata.targetExchangeCount) &&
  isString(value.metadata.vocabularySeeds) &&
  isString(value.metadata.grammarSeeds);

const isAdminCourseScriptConfig = (value: unknown): value is JsonRecord =>
  isRecord(value) && Object.keys(value).length === 1 && isRecord(value.config);

const isAdminCourseDialogue = (value: unknown): value is JsonRecord =>
  isRecord(value) && Object.keys(value).length === 1 && isRecordList(value.exchanges);

const isAdminCourseScript = (value: unknown): value is JsonRecord =>
  isRecord(value) &&
  Object.keys(value).length === 3 &&
  isRecordList(value.scriptUnits) &&
  isNonNegativeInteger(value.estimatedDurationSeconds) &&
  isNonNegativeInteger(value.vocabularyItemCount);

const isAdminCourseAudio = (value: unknown, courseId: string): value is JsonRecord =>
  isRecord(value) &&
  Object.keys(value).length === 3 &&
  value.message === 'Audio generation started' &&
  // Learning OS intentionally uses the canonical course ID as its compatibility job ID.
  value.jobId === courseId &&
  value.courseId === courseId;

const isAdminCoursePipeline = (value: unknown, courseId: string): value is JsonRecord =>
  isRecord(value) &&
  Object.keys(value).length === 7 &&
  value.id === courseId &&
  isNonEmptyString(value.status) &&
  (value.stage === null || value.stage === 'exchanges' || value.stage === 'script') &&
  (value.exchanges === null || isRecordList(value.exchanges)) &&
  (value.scriptUnits === null || isRecordList(value.scriptUnits)) &&
  isNullableString(value.audioUrl) &&
  (value.approxDurationSeconds === null || isNonNegativeInteger(value.approxDurationSeconds));

const isAdminCoursePipelineUpdate = (value: unknown): value is { success: true } =>
  isRecord(value) && Object.keys(value).length === 1 && value.success === true;

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

const canonicalAdminCourseLineAudioPath = (courseId: string, renderingId: string): string =>
  `/api/convolab/admin/courses/${courseId}/line-renderings/${renderingId}/audio`;

const publicAdminCourseLineAudioPath = (courseId: string, renderingId: string): string =>
  `/api/admin/courses/${courseId}/line-renderings/${renderingId}/audio`;

const isAdminCourseLineRendering = (
  value: unknown,
  expectedCourseId: string
): value is AdminCourseLineRendering => {
  if (
    !isRecord(value) ||
    Object.keys(value).length !== 8 ||
    !isUuid(value.id) ||
    value.courseId !== expectedCourseId ||
    !isNonNegativeInteger(value.unitIndex) ||
    value.unitIndex > 1_000_000 ||
    !isNonEmptyString(value.text) ||
    typeof value.speed !== 'number' ||
    !Number.isFinite(value.speed) ||
    value.speed < 0.5 ||
    value.speed > 2 ||
    !isString(value.voiceId) ||
    !FISH_AUDIO_VOICE_PATTERN.test(value.voiceId) ||
    !isIsoTimestamp(value.createdAt)
  ) {
    return false;
  }

  const renderingId = value.id.toLowerCase();
  return (
    value.audioUrl === canonicalAdminCourseLineAudioPath(expectedCourseId, renderingId) ||
    isHttpUrl(value.audioUrl)
  );
};

const rewriteAdminCourseLineRendering = (
  rendering: AdminCourseLineRendering
): AdminCourseLineRendering => {
  const renderingId = rendering.id.toLowerCase();

  return {
    ...rendering,
    id: renderingId,
    audioUrl:
      rendering.audioUrl === canonicalAdminCourseLineAudioPath(rendering.courseId, renderingId)
        ? publicAdminCourseLineAudioPath(rendering.courseId, renderingId)
        : rendering.audioUrl,
  };
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
  ['Cannot delete your own account', 400],
  ['Cannot delete admin users', 403],
  ['User not found', 404],
  ['This code already exists', 400],
  ['Cannot delete used invite codes', 400],
  ['Invite code not found', 404],
  ['Unable to generate invite code', 503],
  ['Invalid avatar filename format', 400],
  ['No image file provided', 400],
  ['Invalid crop area', 400],
  ['Invalid image file', 400],
  ['Speaker avatar not found', 404],
  ['Speaker avatar changed while it was being re-cropped', 409],
  ['Speaker avatar must be uploaded before it can be re-cropped', 409],
  ['Test course not found', 404],
  ['Sentence test not found', 404],
  ['Sentence script generation is temporarily unavailable', 503],
  ['Episode not found', 404],
  ['Cannot delete non-test courses via Script Lab. Use the standard admin interface.', 400],
  ['Course not found', 404],
  ['Course has no episode with source text', 400],
  ['Course changed while dialogue was being generated', 409],
  ['No dialogue exchanges found. Generate dialogue first.', 400],
  ['Course changed while script was being generated', 409],
  ['Course requires a narrator voice and a duration from 1 to 120 minutes', 400],
  ['Script provider is temporarily unavailable', 503],
  ['No script data found. Generate script first.', 400],
  ['Script data is not in the correct format for audio generation. Generate script first.', 400],
  ['Course is already being generated', 409],
  ['Course script changed while audio generation was being queued', 409],
  ['Course generation could not be queued. Please try again.', 503],
  ['Rendering not found', 404],
  ['Line synthesis is temporarily unavailable', 503],
  ['Invalid stage. Must be "exchanges" or "script"', 400],
  ['Pipeline data must be a list.', 400],
  ['Pipeline data contains too many items.', 400],
  ['Pipeline data is too complex.', 400],
  ['Pipeline data text is too long.', 400],
  ['Pipeline data contains an invalid number.', 400],
  ['Pipeline data contains an invalid key.', 400],
  ['Pipeline data contains an invalid value.', 400],
]);

const isPrismaUniqueConstraintError = (error: unknown): boolean =>
  isRecord(error) && error.name === 'PrismaClientKnownRequestError' && error.code === 'P2002';

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

async function fetchAdminCourseRequest(
  req: AuthRequest,
  operation: string,
  method: AdminRequestMethod,
  body?: unknown,
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<{ courseId: string; payload: unknown }> {
  const courseId = req.params.id;
  if (!isUuid(courseId)) throw new AppError('Course not found', 404);

  const { payload, response } = await fetchAdminMutation(
    req,
    `/courses/${courseId}/${operation}`,
    method,
    body,
    timeoutMs
  );
  if (!response.ok) throw mutationError(response, payload);

  return { courseId, payload };
}

async function fetchAdminMultipartMutation(
  req: AuthRequest,
  path: string,
  form: FormData
): Promise<{ payload: unknown; response: globalThis.Response }> {
  if (!req.userId) throw new AppError('Authentication required', 401);

  const { config, user } = await resolveLearningOsUserProxyContext(req.userId, API_LABEL, {
    userId: req.userId,
    email: req.email,
    role: req.role,
    accountSource: req.accountSource,
  });
  const response = await fetchLearningOsProxy({
    upstreamUrl: new URL(`${config.apiUrl}/api/convolab/admin${path}`),
    apiToken: config.apiToken,
    user,
    method: 'POST',
    rawBody: form,
    timeoutMs: AVATAR_WRITE_TIMEOUT_MS,
    timeoutMessage: `${API_LABEL} request timed out.`,
    networkErrorMessage: `${API_LABEL} is unavailable.`,
  });

  try {
    return { payload: await response.json(), response };
  } catch {
    throw invalidResponse();
  }
}

const speakerAvatarMetadata = (filename: string) => {
  const [language, gender, tone] = filename.replace(/\.(jpg|jpeg|png|webp)$/i, '').split('-');
  return { language, gender, tone };
};

async function mirrorSpeakerAvatar(payload: SpeakerAvatarMutation): Promise<void> {
  const { language, gender, tone } = speakerAvatarMetadata(payload.filename);
  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.speakerAvatar.deleteMany({
        where: {
          language,
          gender,
          tone,
          filename: { not: payload.filename },
        },
      });
      await transaction.speakerAvatar.upsert({
        where: { filename: payload.filename },
        create: {
          filename: payload.filename,
          croppedUrl: payload.croppedUrl,
          originalUrl: payload.originalUrl,
          language,
          gender,
          tone,
        },
        update: {
          croppedUrl: payload.croppedUrl,
          originalUrl: payload.originalUrl,
          language,
          gender,
          tone,
        },
      });
    });
  } catch (error) {
    console.error('Unable to mirror Learning OS speaker avatar locally:', error);
    throw new AppError(`${API_LABEL} request failed.`, 502);
  }
}

async function rollbackCreatedInvite(req: AuthRequest, inviteId: string): Promise<void> {
  try {
    const { payload, response } = await fetchAdminMutation(
      req,
      `/invite-codes/${inviteId}`,
      'DELETE'
    );
    if (!response.ok || responseMessage(payload) !== 'Invite code deleted successfully') {
      throw new AppError(`${API_LABEL} request failed.`, 502);
    }
  } catch (error) {
    console.error(`Unable to roll back Learning OS admin invite ${inviteId}:`, error);
    throw error;
  }
}

async function mirrorCreatedInvite(req: AuthRequest, payload: CreatedInviteCode) {
  try {
    return await prisma.inviteCode.upsert({
      where: { id: payload.id },
      create: {
        id: payload.id,
        code: payload.code,
        usedBy: null,
        usedAt: null,
        createdAt: new Date(payload.createdAt),
      },
      update: {
        code: payload.code,
        usedBy: null,
        usedAt: null,
        createdAt: new Date(payload.createdAt),
      },
    });
  } catch (error) {
    await rollbackCreatedInvite(req, payload.id);
    if (isPrismaUniqueConstraintError(error)) {
      throw new AppError('This code already exists', 400);
    }
    throw new AppError(`${API_LABEL} request failed.`, 502);
  }
}

export async function buildLearningOsAdminCoursePrompt(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { payload } = await fetchAdminCourseRequest(req, 'build-prompt', 'POST', {});
    if (!isAdminCoursePrompt(payload)) throw invalidResponse();

    res.set('Cache-Control', 'private, no-store').json(payload);
  } catch (error) {
    next(error);
  }
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

export async function buildLearningOsAdminCourseScriptConfig(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { payload } = await fetchAdminCourseRequest(req, 'build-script-config', 'POST', {});
    if (!isAdminCourseScriptConfig(payload)) throw invalidResponse();

    res.set('Cache-Control', 'private, no-store').json(payload);
  } catch (error) {
    next(error);
  }
}

export async function synthesizeLearningOsAdminCourseLine(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const courseId = req.params.id?.toLowerCase();
    if (!isUuid(courseId)) throw new AppError('Course not found', 404);

    const body = isRecord(req.body) ? req.body : {};
    const text = isString(body.text) ? body.text.trim() : '';
    const voiceId = isString(body.voiceId) ? body.voiceId.trim().toLowerCase() : '';
    if (!text || !voiceId || body.unitIndex === undefined) {
      throw new AppError('Missing required fields: text, voiceId, unitIndex', 400);
    }
    if (text.length > 15_000) throw new AppError('text must not exceed 15000 characters', 400);
    if (!FISH_AUDIO_VOICE_PATTERN.test(voiceId)) {
      throw new AppError('Only Fish Audio voices are supported for line synthesis', 400);
    }
    if (
      !Number.isInteger(body.unitIndex) ||
      (body.unitIndex as number) < 0 ||
      (body.unitIndex as number) > 1_000_000
    ) {
      throw new AppError('unitIndex must be an integer between 0 and 1000000', 400);
    }
    const speed = body.speed === undefined ? 1 : body.speed;
    if (typeof speed !== 'number' || !Number.isFinite(speed) || speed < 0.5 || speed > 2) {
      throw new AppError('speed must be between 0.5 and 2', 400);
    }

    const { payload, response } = await fetchAdminMutation(
      req,
      `/courses/${courseId}/synthesize-line`,
      'POST',
      { text, voiceId, speed, unitIndex: body.unitIndex },
      COURSE_PROVIDER_TIMEOUT_MS
    );
    if (!response.ok) throw mutationError(response, payload);
    if (
      !isRecord(payload) ||
      Object.keys(payload).length !== 2 ||
      !isUuid(payload.renderingId) ||
      payload.audioUrl !==
        canonicalAdminCourseLineAudioPath(courseId, payload.renderingId.toLowerCase())
    ) {
      throw invalidResponse();
    }

    const renderingId = payload.renderingId.toLowerCase();
    res.set('Cache-Control', 'private, no-store').json({
      renderingId,
      audioUrl: publicAdminCourseLineAudioPath(courseId, renderingId),
    });
  } catch (error) {
    next(error);
  }
}

export async function listLearningOsAdminCourseLineRenderings(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const courseId = req.params.id?.toLowerCase();
    if (!isUuid(courseId)) throw new AppError('Course not found', 404);

    const { payload, response } = await fetchAdminMutation(
      req,
      `/courses/${courseId}/line-renderings`,
      'GET'
    );
    if (!response.ok) throw mutationError(response, payload);
    if (
      !isRecord(payload) ||
      Object.keys(payload).length !== 1 ||
      !Array.isArray(payload.renderings) ||
      !payload.renderings.every((rendering) => isAdminCourseLineRendering(rendering, courseId))
    ) {
      throw invalidResponse();
    }

    res.set('Cache-Control', 'private, no-store').json({
      renderings: payload.renderings.map(rewriteAdminCourseLineRendering),
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteLearningOsAdminCourseLineRendering(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const courseId = req.params.id?.toLowerCase();
    const renderingId = req.params.renderingId?.toLowerCase();
    if (!isUuid(courseId) || !isUuid(renderingId)) {
      throw new AppError('Rendering not found', 404);
    }

    const { payload, response } = await fetchAdminMutation(
      req,
      `/courses/${courseId}/line-renderings/${renderingId}`,
      'DELETE'
    );
    if (!response.ok) throw mutationError(response, payload);
    if (!isRecord(payload) || Object.keys(payload).length !== 1 || payload.success !== true) {
      throw invalidResponse();
    }

    res.set('Cache-Control', 'private, no-store').json(payload);
  } catch (error) {
    next(error);
  }
}

export async function streamLearningOsAdminCourseLineRendering(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const courseId = req.params.id?.toLowerCase();
    const renderingId = req.params.renderingId?.toLowerCase();
    if (!isUuid(courseId) || !isUuid(renderingId)) {
      throw new AppError('Rendering not found', 404);
    }

    const range = req.header('Range')?.trim();
    if (range !== undefined && (range.length > 100 || !/^bytes=(?:\d+-\d*|-\d+)$/.test(range))) {
      throw new AppError('Invalid line audio byte range.', 400);
    }
    if (!req.userId) throw new AppError('Authentication required', 401);

    const { config, user } = await resolveLearningOsUserProxyContext(req.userId, API_LABEL, {
      userId: req.userId,
      email: req.email,
      role: req.role,
      accountSource: req.accountSource,
    });
    const upstreamResponse = await fetchLearningOsProxy({
      upstreamUrl: new URL(
        `${config.apiUrl}${canonicalAdminCourseLineAudioPath(courseId, renderingId)}`
      ),
      apiToken: config.apiToken,
      user,
      method: 'GET',
      additionalHeaders: { Accept: 'audio/mpeg', ...(range === undefined ? {} : { Range: range }) },
      timeoutMs: FETCH_TIMEOUT_MS,
      timeoutMessage: `${API_LABEL} request timed out.`,
      networkErrorMessage: `${API_LABEL} is unavailable.`,
    });

    if (upstreamResponse.status === 404) throw new AppError('Rendering not found', 404);
    if (!upstreamResponse.ok) throw new AppError(`${API_LABEL} request failed.`, 502);

    await streamLearningOsMediaResponse(upstreamResponse, res, {
      invalidHeadersMessage: `${API_LABEL} returned invalid media headers.`,
      isAllowedContentType: (contentType) => /^audio\/mpeg(?:\s*;|$)/i.test(contentType),
    });
  } catch (error) {
    next(error);
  }
}

export async function generateLearningOsAdminCourseDialogue(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const customPrompt = req.body?.customPrompt;
    if (customPrompt !== undefined && customPrompt !== null && typeof customPrompt !== 'string') {
      throw new AppError('customPrompt must be a string', 400);
    }
    if (typeof customPrompt === 'string' && customPrompt.length > 100_000) {
      throw new AppError('customPrompt must not exceed 100000 characters', 400);
    }

    const body = customPrompt === undefined || customPrompt === null ? {} : { customPrompt };
    const { payload } = await fetchAdminCourseRequest(
      req,
      'generate-dialogue',
      'POST',
      body,
      COURSE_PROVIDER_TIMEOUT_MS
    );
    if (!isAdminCourseDialogue(payload)) throw invalidResponse();

    res.set('Cache-Control', 'private, no-store').json(payload);
  } catch (error) {
    next(error);
  }
}

export async function generateLearningOsAdminCourseScript(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { payload } = await fetchAdminCourseRequest(
      req,
      'generate-script',
      'POST',
      {},
      COURSE_PROVIDER_TIMEOUT_MS
    );
    if (!isAdminCourseScript(payload)) throw invalidResponse();

    res.set('Cache-Control', 'private, no-store').json(payload);
  } catch (error) {
    next(error);
  }
}

export async function generateLearningOsAdminCourseAudio(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { courseId, payload } = await fetchAdminCourseRequest(req, 'generate-audio', 'POST', {});
    if (!isAdminCourseAudio(payload, courseId)) throw invalidResponse();

    res.set('Cache-Control', 'private, no-store').json(payload);
  } catch (error) {
    next(error);
  }
}

export async function showLearningOsAdminCoursePipeline(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { courseId, payload } = await fetchAdminCourseRequest(req, 'pipeline-data', 'GET');
    if (!isAdminCoursePipeline(payload, courseId)) throw invalidResponse();

    res.set('Cache-Control', 'private, no-store').json(payload);
  } catch (error) {
    next(error);
  }
}

export async function updateLearningOsAdminCoursePipeline(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const stage = req.body?.stage;
    const data = req.body?.data;
    if (stage !== 'exchanges' && stage !== 'script') {
      throw new AppError('Invalid stage. Must be "exchanges" or "script"', 400);
    }
    if (!Array.isArray(data)) throw new AppError('Pipeline data must be a list.', 400);

    const { payload } = await fetchAdminCourseRequest(req, 'pipeline-data', 'PUT', {
      stage,
      data,
    });
    if (!isAdminCoursePipelineUpdate(payload)) throw invalidResponse();

    res.set('Cache-Control', 'private, no-store').json(payload);
  } catch (error) {
    next(error);
  }
}

export async function deleteLearningOsAdminUser(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!isUuid(req.params.id)) throw new AppError('User not found', 404);

    const { payload, response } = await fetchAdminMutation(
      req,
      `/users/${req.params.id}`,
      'DELETE'
    );
    if (!response.ok && response.status !== 404) throw mutationError(response, payload);
    if (response.status === 404 && responseMessage(payload) !== 'User not found') {
      throw mutationError(response, payload);
    }
    if (response.ok && responseMessage(payload) !== 'User deleted successfully') {
      throw invalidResponse();
    }

    const cleanup = await prisma.user.deleteMany({ where: { id: req.params.id } });
    // A canonical 404 plus stale local state is a retry of an already-successful delete.
    if (response.status === 404 && cleanup.count === 0) throw mutationError(response, payload);

    res.set('Cache-Control', 'private, no-store').json({ message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
}

export async function createLearningOsAdminInviteCode(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const requestedCustomCode = req.body?.customCode;
    const customCode = requestedCustomCode ? requestedCustomCode : undefined;
    if (
      customCode !== undefined &&
      (typeof customCode !== 'string' || !/^[A-Za-z0-9]{6,20}$/.test(customCode))
    ) {
      throw new AppError('Custom code must be 6-20 alphanumeric characters', 400);
    }
    if (
      customCode !== undefined &&
      (await prisma.inviteCode.findUnique({ where: { code: customCode } })) !== null
    ) {
      throw new AppError('This code already exists', 400);
    }

    const { payload, response } = await fetchAdminMutation(
      req,
      '/invite-codes',
      'POST',
      customCode === undefined ? {} : { customCode }
    );
    if (!response.ok) throw mutationError(response, payload);
    if (!isCreatedInviteCode(payload)) {
      if (isRecord(payload) && isUuid(payload.id)) {
        await rollbackCreatedInvite(req, payload.id);
      }
      throw invalidResponse();
    }

    const invite = await mirrorCreatedInvite(req, payload);

    res.set('Cache-Control', 'private, no-store').json(invite);
  } catch (error) {
    next(error);
  }
}

export async function deleteLearningOsAdminInviteCode(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!isUuid(req.params.id)) throw new AppError('Invite code not found', 404);

    const { payload, response } = await fetchAdminMutation(
      req,
      `/invite-codes/${req.params.id}`,
      'DELETE'
    );
    if (!response.ok && response.status !== 404) throw mutationError(response, payload);
    if (response.status === 404 && responseMessage(payload) !== 'Invite code not found') {
      throw mutationError(response, payload);
    }
    if (response.ok && responseMessage(payload) !== 'Invite code deleted successfully') {
      throw invalidResponse();
    }

    const cleanup = await prisma.inviteCode.deleteMany({ where: { id: req.params.id } });
    // A canonical 404 plus stale local state is a retry of an already-successful delete.
    if (response.status === 404 && cleanup.count === 0) throw mutationError(response, payload);

    res
      .set('Cache-Control', 'private, no-store')
      .json({ message: 'Invite code deleted successfully' });
  } catch (error) {
    next(error);
  }
}

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

export async function showLearningOsAdminSpeakerAvatarOriginal(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { filename } = req.params;
    if (!SPEAKER_AVATAR_FILENAME_PATTERN.test(filename)) {
      throw new AppError('Invalid avatar filename format', 400);
    }

    const { payload } = await fetchAdminResponse(
      req,
      `/avatars/speaker/${encodeURIComponent(filename)}/original`
    );
    if (!isSpeakerAvatarOriginal(payload)) throw invalidResponse();

    res.set('Cache-Control', 'private, no-store').json(payload);
  } catch (error) {
    next(error);
  }
}

export async function uploadLearningOsAdminSpeakerAvatar(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { filename } = req.params;
    if (!SPEAKER_AVATAR_FILENAME_PATTERN.test(filename)) {
      throw new AppError('Invalid avatar filename format', 400);
    }

    const cropArea = parseCropArea(req.body?.cropArea);
    const form = avatarFormData(req.file, cropArea);
    const { payload, response } = await fetchAdminMultipartMutation(
      req,
      `/avatars/speaker/${encodeURIComponent(filename)}/upload`,
      form
    );
    if (!response.ok) throw mutationError(response, payload);
    if (!isSpeakerAvatarMutation(payload, 'Speaker avatar uploaded successfully', filename)) {
      throw invalidResponse();
    }

    await mirrorSpeakerAvatar(payload);
    res.set('Cache-Control', 'private, no-store').json(payload);
  } catch (error) {
    next(error);
  }
}

export async function recropLearningOsAdminSpeakerAvatar(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { filename } = req.params;
    if (!SPEAKER_AVATAR_FILENAME_PATTERN.test(filename)) {
      throw new AppError('Invalid avatar filename format', 400);
    }

    const cropArea = parseCropArea(req.body?.cropArea);
    const { payload, response } = await fetchAdminMutation(
      req,
      `/avatars/speaker/${encodeURIComponent(filename)}/recrop`,
      'POST',
      { cropArea },
      AVATAR_WRITE_TIMEOUT_MS
    );
    if (!response.ok) throw mutationError(response, payload);
    if (!isSpeakerAvatarMutation(payload, 'Speaker avatar re-cropped successfully', filename)) {
      throw invalidResponse();
    }

    await mirrorSpeakerAvatar(payload);
    res.set('Cache-Control', 'private, no-store').json(payload);
  } catch (error) {
    next(error);
  }
}

export async function uploadLearningOsAdminUserAvatar(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userId } = req.params;
    if (!isUuid(userId)) throw new AppError('User not found', 404);

    const cropArea = parseCropArea(req.body?.cropArea);
    const form = avatarFormData(req.file, cropArea);
    const { payload, response } = await fetchAdminMultipartMutation(
      req,
      `/avatars/user/${encodeURIComponent(userId)}/upload`,
      form
    );
    if (!response.ok) throw mutationError(response, payload);
    if (!isUserAvatarMutation(payload)) throw invalidResponse();

    try {
      // Learning OS is canonical. Existing Express consumers only need a best-effort local row
      // when one still exists; Learning OS-only accounts intentionally have no Prisma mirror.
      await prisma.user.updateMany({
        where: { id: userId },
        data: { avatarUrl: payload.avatarUrl },
      });
    } catch (error) {
      console.error('Unable to mirror Learning OS user avatar locally:', error);
      throw new AppError(`${API_LABEL} request failed.`, 502);
    }

    res.set('Cache-Control', 'private, no-store').json(payload);
  } catch (error) {
    next(error);
  }
}

export async function listLearningOsAdminSpeakerAvatars(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { payload } = await fetchAdminResponse(req, '/avatars/speakers');
    if (!Array.isArray(payload) || !payload.every(isSpeakerAvatar)) throw invalidResponse();

    res.set('Cache-Control', 'private, max-age=3600').json(payload);
  } catch (error) {
    next(error);
  }
}

export async function showLearningOsAdminPronunciationDictionary(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { payload } = await fetchAdminResponse(req, '/pronunciation-dictionaries');
    if (!isPronunciationDictionary(payload)) throw invalidResponse();

    res.set('Cache-Control', 'private, no-store').json(payload);
  } catch (error) {
    next(error);
  }
}

export async function updateLearningOsAdminPronunciationDictionary(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { payload, response } = await fetchAdminMutation(
      req,
      '/pronunciation-dictionaries',
      'PUT',
      req.body
    );
    if (!response.ok) throw mutationError(response, payload);
    if (!isPronunciationDictionary(payload)) throw invalidResponse();

    try {
      // Learning OS is canonical; this mirror only keeps synchronous legacy Express consumers
      // current until their remaining generation routes move to Learning OS.
      await updateJapanesePronunciationDictionary(payload);
    } catch (error) {
      console.error('Unable to mirror Learning OS pronunciation dictionary locally:', error);
      throw new AppError(`${API_LABEL} request failed.`, 502);
    }

    res.set('Cache-Control', 'private, no-store').json(payload);
  } catch (error) {
    next(error);
  }
}
