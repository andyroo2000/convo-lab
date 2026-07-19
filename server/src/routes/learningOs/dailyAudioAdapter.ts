import { AppError } from '../../middleware/errorHandler.js';

import { STUDY_ULID_SEGMENT } from './studyMediaUrls.js';

export type DailyAudioResponse = 'list' | 'detail' | 'status';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ULID_PATTERN = new RegExp(`^${STUDY_ULID_SEGMENT}$`, 'i');
const DAILY_AUDIO_API_PREFIX = '/api/daily-audio-practice/';
const DAILY_AUDIO_PROXY_PREFIX = '/api/learning-os/study/daily-audio-practice/';
const PRACTICE_STATUSES = new Set(['draft', 'generating', 'ready', 'error']);
const TRACK_MODES = new Set(['drill', 'dialogue', 'story']);
const TRACK_STATUSES = new Set(['draft', 'generating', 'ready', 'error', 'skipped']);
const PRACTICE_KEYS = new Set([
  'id',
  'userId',
  'practiceDate',
  'status',
  'targetDurationMinutes',
  'targetLanguage',
  'nativeLanguage',
  'sourceCardIdsJson',
  'selectionSummaryJson',
  'errorMessage',
  'createdAt',
  'updatedAt',
  'tracks',
]);
const SUMMARY_TRACK_KEYS = new Set([
  'id',
  'practiceId',
  'mode',
  'status',
  'title',
  'sortOrder',
  'audioUrl',
  'approxDurationSeconds',
  'errorMessage',
  'createdAt',
  'updatedAt',
]);
const DETAIL_TRACK_KEYS = new Set([
  ...SUMMARY_TRACK_KEYS,
  'scriptUnitsJson',
  'timingData',
  'generationMetadataJson',
]);
const STATUS_KEYS = new Set(['id', 'status', 'progress', 'tracks']);
const STATUS_TRACK_KEYS = new Set(['id', 'mode', 'status', 'audioUrl', 'approxDurationSeconds']);

function invalidResponse(response: DailyAudioResponse): never {
  throw new AppError(
    `Learning OS Study API returned an invalid Daily Audio ${response} response.`,
    502
  );
}

function record(value: unknown, response: DailyAudioResponse): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    invalidResponse(response);
  }

  return value as Record<string, unknown>;
}

function hasExactKeys(value: Record<string, unknown>, expected: ReadonlySet<string>): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.size && keys.every((key) => expected.has(key));
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function isStudyCardId(value: unknown): value is string {
  return isUuid(value) || (typeof value === 'string' && ULID_PATTERN.test(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isNullableNonNegativeInteger(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isInteger(value) && value >= 0);
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function isJsonContainerOrNull(value: unknown): boolean {
  return value === null || (typeof value === 'object' && value !== null);
}

function isTrack(
  value: unknown,
  response: Extract<DailyAudioResponse, 'list' | 'detail'>
): boolean {
  const track = record(value, response);
  const expectedKeys = response === 'list' ? SUMMARY_TRACK_KEYS : DETAIL_TRACK_KEYS;
  if (
    !hasExactKeys(track, expectedKeys) ||
    !isUuid(track.id) ||
    !isUuid(track.practiceId) ||
    typeof track.mode !== 'string' ||
    !TRACK_MODES.has(track.mode) ||
    typeof track.status !== 'string' ||
    !TRACK_STATUSES.has(track.status) ||
    !isNonEmptyString(track.title) ||
    typeof track.sortOrder !== 'number' ||
    !Number.isInteger(track.sortOrder) ||
    track.sortOrder < 0 ||
    !isNullableString(track.audioUrl) ||
    !isNullableNonNegativeInteger(track.approxDurationSeconds) ||
    !isNullableString(track.errorMessage) ||
    !isTimestamp(track.createdAt) ||
    !isTimestamp(track.updatedAt)
  ) {
    return false;
  }

  return (
    response === 'list' ||
    (isJsonContainerOrNull(track.scriptUnitsJson) &&
      isJsonContainerOrNull(track.timingData) &&
      isJsonContainerOrNull(track.generationMetadataJson))
  );
}

function isPractice(
  value: unknown,
  response: Extract<DailyAudioResponse, 'list' | 'detail'>
): boolean {
  const practice = record(value, response);
  return (
    hasExactKeys(practice, PRACTICE_KEYS) &&
    isUuid(practice.id) &&
    isNonEmptyString(practice.userId) &&
    typeof practice.practiceDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(practice.practiceDate) &&
    typeof practice.status === 'string' &&
    PRACTICE_STATUSES.has(practice.status) &&
    typeof practice.targetDurationMinutes === 'number' &&
    Number.isInteger(practice.targetDurationMinutes) &&
    practice.targetDurationMinutes > 0 &&
    isNonEmptyString(practice.targetLanguage) &&
    isNonEmptyString(practice.nativeLanguage) &&
    (practice.sourceCardIdsJson === null ||
      (Array.isArray(practice.sourceCardIdsJson) &&
        practice.sourceCardIdsJson.every(isStudyCardId))) &&
    isJsonContainerOrNull(practice.selectionSummaryJson) &&
    isNullableString(practice.errorMessage) &&
    isTimestamp(practice.createdAt) &&
    isTimestamp(practice.updatedAt) &&
    Array.isArray(practice.tracks) &&
    practice.tracks.every(
      (track) =>
        isTrack(track, response) && (track as Record<string, unknown>).practiceId === practice.id
    )
  );
}

function isStatusTrack(value: unknown): boolean {
  const track = record(value, 'status');
  return (
    hasExactKeys(track, STATUS_TRACK_KEYS) &&
    isUuid(track.id) &&
    typeof track.mode === 'string' &&
    TRACK_MODES.has(track.mode) &&
    typeof track.status === 'string' &&
    TRACK_STATUSES.has(track.status) &&
    isNullableString(track.audioUrl) &&
    isNullableNonNegativeInteger(track.approxDurationSeconds)
  );
}

function isStatus(value: unknown): boolean {
  const status = record(value, 'status');
  return (
    hasExactKeys(status, STATUS_KEYS) &&
    isUuid(status.id) &&
    typeof status.status === 'string' &&
    PRACTICE_STATUSES.has(status.status) &&
    (status.progress === null ||
      (typeof status.progress === 'number' &&
        Number.isInteger(status.progress) &&
        status.progress >= 0 &&
        status.progress <= 100)) &&
    Array.isArray(status.tracks) &&
    status.tracks.every(isStatusTrack)
  );
}

function rewriteTrackAudioUrl(
  audioUrl: unknown,
  practiceId: string,
  trackId: string,
  response: DailyAudioResponse
): string | null {
  if (audioUrl === null) {
    return null;
  }
  if (typeof audioUrl !== 'string') {
    invalidResponse(response);
  }

  const expectedPath = `${DAILY_AUDIO_API_PREFIX}${practiceId}/tracks/${trackId}/audio`;
  if (audioUrl.toLowerCase() === expectedPath.toLowerCase()) {
    return `${DAILY_AUDIO_PROXY_PREFIX}${practiceId.toLowerCase()}/tracks/${trackId.toLowerCase()}/audio`;
  }

  // Preserve imported legacy storage URLs, but fail closed for malformed Learning OS audio paths.
  if (audioUrl.toLowerCase().startsWith(DAILY_AUDIO_API_PREFIX)) {
    invalidResponse(response);
  }

  return audioUrl;
}

function rewritePracticeAudioUrls(
  value: Record<string, unknown>,
  response: Extract<DailyAudioResponse, 'list' | 'detail'>
): Record<string, unknown> {
  const practiceId = value.id as string;
  return {
    ...value,
    tracks: (value.tracks as Array<Record<string, unknown>>).map((track) => ({
      ...track,
      audioUrl: rewriteTrackAudioUrl(track.audioUrl, practiceId, track.id as string, response),
    })),
  };
}

export function adaptDailyAudioResponse(response: DailyAudioResponse, value: unknown): unknown {
  const valid =
    response === 'list'
      ? Array.isArray(value) && value.every((practice) => isPractice(practice, 'list'))
      : response === 'detail'
        ? isPractice(value, 'detail')
        : isStatus(value);

  if (!valid) {
    invalidResponse(response);
  }

  if (response === 'list') {
    return (value as Array<Record<string, unknown>>).map((practice) =>
      rewritePracticeAudioUrls(practice, response)
    );
  }
  if (response === 'detail') {
    return rewritePracticeAudioUrls(value as Record<string, unknown>, response);
  }

  const status = value as Record<string, unknown>;
  const practiceId = status.id as string;
  return {
    ...status,
    tracks: (status.tracks as Array<Record<string, unknown>>).map((track) => ({
      ...track,
      audioUrl: rewriteTrackAudioUrl(track.audioUrl, practiceId, track.id as string, response),
    })),
  };
}
