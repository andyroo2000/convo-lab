import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import {
  DEFAULT_STUDY_ANSWER_AUDIO_VOICE_ID,
  STUDY_ANSWER_AUDIO_FEMALE_VOICE_ID,
  TTS_VOICES,
} from '@languageflow/shared/src/constants-new.js';
import {
  STUDY_CANDIDATE_CONTEXT_MAX_LENGTH,
  STUDY_CANDIDATE_IMAGE_PROMPT_MAX_LENGTH,
  STUDY_CANDIDATE_SOURCE_SENTENCE_MAX_LENGTH,
  STUDY_CANDIDATE_TARGET_MAX_LENGTH,
  STUDY_VOCAB_BUNDLE_CARD_COUNT,
} from '@languageflow/shared/src/studyConstants.js';
import type { StudyCardCreationKind } from '@languageflow/shared/src/types.js';
import { Router, type NextFunction, type Response } from 'express';
import { rateLimit as createExpressRateLimit } from 'express-rate-limit';

import { requireAuth, type AuthRequest } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { rateLimitStudyRoute } from '../../middleware/studyRateLimit.js';
import {
  fetchLearningOsProxy,
  learningOsProxyHeaders,
  resolveLearningOsProxyContext,
  type LearningOsProxyUser,
} from '../../services/learningOsProxy.js';
import { assertStudyCardPayloadContract } from '../../services/study/cardPayloadContract.js';
import {
  cardTypeForStudyCardCreationKind,
  STUDY_CARD_CREATION_KINDS,
} from '../../services/study/shared/candidates.js';
import { STUDY_VOCAB_VARIANT_KINDS_BY_STAGE } from '../../services/study/variants/constants.js';

import { adaptDailyAudioResponse, type DailyAudioResponse } from './dailyAudioAdapter.js';
import {
  rewriteLearningOsStudyMediaUrl,
  rewriteStudyCardDraftMediaUrls,
  rewriteStudyCardMediaUrls,
  STUDY_ULID_SEGMENT,
} from './studyMediaUrls.js';
import {
  adaptLearningOsStudyReadResponse,
  type LearningOsStudyReadFeature,
} from './studyReadAdapters.js';
import {
  STUDY_IMPORT_ID_SEGMENT,
  STUDY_IMPORT_ULID_SEGMENT,
  STUDY_IMPORT_UPLOAD_PATH_PATTERN,
} from './studyRouteContract.js';

const router = Router();
const LEARNING_OS_FETCH_TIMEOUT_MS = 10_000;
const LEARNING_OS_GENERATED_MEDIA_TIMEOUT_MS = 120_000;
const LEARNING_OS_IMPORT_UPLOAD_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_STUDY_IMPORT_UPLOAD_BYTES = 2_147_483_648;
const MAX_NEW_QUEUE_REORDER_SIZE = 500;
const MAX_UPSTREAM_VALIDATION_MESSAGE_LENGTH = 500;
const MAX_STUDY_ANSWER_AUDIO_TEXT_LENGTH = 500;
const MAX_STUDY_REVIEW_DURATION_MS = 60 * 60 * 1000;
const MAX_STUDY_SET_DUE_FUTURE_YEARS = 10;
const MAX_STUDY_DRAFT_IMAGE_PROMPT_LENGTH = 1000;
const MAX_STUDY_DRAFT_MEDIA_FILENAME_LENGTH = 255;
const MAX_STUDY_DRAFT_MEDIA_ID_LENGTH = 255;
const MAX_STUDY_DRAFT_MEDIA_URL_LENGTH = 4096;
const UUID_SEGMENT = '[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}';
const DAILY_AUDIO_UUID_SEGMENT =
  '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const ULID_PATTERN = new RegExp(`^${STUDY_ULID_SEGMENT}$`, 'i');
const UUID_PATTERN = new RegExp(`^${UUID_SEGMENT}$`, 'i');
const STUDY_CARD_ID_SEGMENT = `(?:${STUDY_ULID_SEGMENT}|${UUID_SEGMENT})`;
const STRICT_ISO_DATETIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const STUDY_IMPORT_CONTENT_TYPES = new Set([
  'application/octet-stream',
  'application/zip',
  'application/x-zip-compressed',
  'multipart/x-zip',
]);
const STUDY_CARD_TYPES = new Set(['recognition', 'production', 'cloze']);
const STUDY_CARD_ACTIONS = new Set(['suspend', 'unsuspend', 'forget', 'set_due']);
const STUDY_CARD_SET_DUE_MODES = new Set(['now', 'tomorrow', 'custom_date']);
const STUDY_CARD_IMAGE_PLACEMENTS = new Set(['none', 'prompt', 'answer', 'both']);
const STUDY_CARD_DRAFT_AUDIO_ROLES = new Set(['prompt', 'answer']);
const STUDY_CARD_DRAFT_MEDIA_SOURCES = new Set([
  'imported',
  'generated',
  'missing',
  'imported_image',
  'imported_other',
]);
// Study cards are Japanese-only; expand these derived catalogs with the route contract if that changes.
const STUDY_ANSWER_AUDIO_FISH_VOICE_IDS = new Set<string>(
  TTS_VOICES.ja.voices.filter((voice) => voice.provider === 'fishaudio').map((voice) => voice.id)
);
const STUDY_ANSWER_AUDIO_LEGACY_VOICE_MIGRATIONS = new Map<string, string>(
  TTS_VOICES.ja.voices
    .filter((voice) => 'hiddenFromPicker' in voice && voice.hiddenFromPicker)
    .map((voice) => [
      voice.id,
      voice.gender === 'female'
        ? STUDY_ANSWER_AUDIO_FEMALE_VOICE_ID
        : DEFAULT_STUDY_ANSWER_AUDIO_VOICE_ID,
    ])
);

const learningOsStudyIpRateLimit = createExpressRateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
const learningOsStudyReadRateLimit = rateLimitStudyRoute({
  key: 'learning-os-read-proxy',
  max: 240,
  windowMs: 60 * 1000,
});
const learningOsStudyMediaRateLimit = rateLimitStudyRoute({
  key: 'learning-os-media-proxy',
  max: 600,
  windowMs: 60 * 1000,
});
const learningOsDailyAudioGenerationRateLimit = rateLimitStudyRoute({
  key: 'learning-os-daily-audio-generation-proxy',
  max: 10,
  windowMs: 60 * 60 * 1000,
  onBackendError: 'fail-closed',
});
const learningOsStudyImportRateLimit = rateLimitStudyRoute({
  key: 'learning-os-import-proxy',
  max: 240,
  windowMs: 60 * 1000,
  onBackendError: 'fail-closed',
});
const learningOsSettingsWriteRateLimit = rateLimitStudyRoute({
  key: 'learning-os-settings-write-proxy',
  max: 60,
  windowMs: 60 * 1000,
  onBackendError: 'fail-closed',
});
const learningOsNewQueueWriteRateLimit = rateLimitStudyRoute({
  key: 'learning-os-new-queue-write-proxy',
  max: 60,
  windowMs: 60 * 1000,
  onBackendError: 'fail-closed',
});
const learningOsStudySessionRateLimit = rateLimitStudyRoute({
  key: 'learning-os-session-start-proxy',
  max: 30,
  windowMs: 60 * 1000,
  onBackendError: 'fail-closed',
});
const learningOsReviewWriteRateLimit = rateLimitStudyRoute({
  key: 'learning-os-review-write-proxy',
  max: 120,
  windowMs: 60 * 1000,
  onBackendError: 'fail-closed',
});
const learningOsCardCreateRateLimit = rateLimitStudyRoute({
  key: 'learning-os-card-create-proxy',
  max: 120,
  windowMs: 60 * 1000,
  onBackendError: 'fail-closed',
});
const learningOsCardUpdateRateLimit = rateLimitStudyRoute({
  key: 'learning-os-card-update-proxy',
  max: 120,
  windowMs: 60 * 1000,
  onBackendError: 'fail-closed',
});
const learningOsCardDeleteRateLimit = rateLimitStudyRoute({
  key: 'learning-os-card-delete-proxy',
  max: 60,
  windowMs: 60 * 1000,
  onBackendError: 'fail-closed',
});
const learningOsCardActionRateLimit = rateLimitStudyRoute({
  key: 'learning-os-card-action-proxy',
  max: 120,
  windowMs: 60 * 1000,
  onBackendError: 'fail-closed',
});
const learningOsCardAnswerAudioRateLimit = rateLimitStudyRoute({
  key: 'learning-os-card-answer-audio-proxy',
  max: 30,
  windowMs: 60 * 1000,
  onBackendError: 'fail-closed',
});
const learningOsCardImageRateLimit = rateLimitStudyRoute({
  key: 'learning-os-card-image-proxy',
  max: 10,
  windowMs: 60 * 1000,
  onBackendError: 'fail-closed',
});
const learningOsCardPitchAccentRateLimit = rateLimitStudyRoute({
  key: 'learning-os-card-pitch-accent-proxy',
  max: 30,
  windowMs: 60 * 1000,
  onBackendError: 'fail-closed',
});
const learningOsCardDraftCreateRateLimit = rateLimitStudyRoute({
  key: 'learning-os-card-draft-create-proxy',
  max: 60,
  windowMs: 60 * 1000,
  onBackendError: 'fail-closed',
});
const learningOsVocabBundleDraftCreateRateLimit = rateLimitStudyRoute({
  key: 'learning-os-vocab-bundle-draft-create-proxy',
  max: 20,
  windowMs: 60 * 1000,
  onBackendError: 'fail-closed',
});
const learningOsCardDraftUpdateRateLimit = rateLimitStudyRoute({
  key: 'learning-os-card-draft-update-proxy',
  max: 120,
  windowMs: 60 * 1000,
  onBackendError: 'fail-closed',
});
const learningOsCardDraftRetryRateLimit = rateLimitStudyRoute({
  key: 'learning-os-card-draft-retry-proxy',
  max: 30,
  windowMs: 60 * 1000,
  onBackendError: 'fail-closed',
});
const learningOsCardDraftCommitRateLimit = rateLimitStudyRoute({
  key: 'learning-os-card-draft-commit-proxy',
  max: 60,
  windowMs: 60 * 1000,
  onBackendError: 'fail-closed',
});
const learningOsCardDraftDeleteRateLimit = rateLimitStudyRoute({
  key: 'learning-os-card-draft-delete-proxy',
  max: 60,
  windowMs: 60 * 1000,
  onBackendError: 'fail-closed',
});
const learningOsCardDraftPreviewMediaRateLimit = rateLimitStudyRoute({
  key: 'learning-os-card-draft-preview-media-proxy',
  max: 10,
  windowMs: 60 * 1000,
  onBackendError: 'fail-closed',
});

type StudyProxyMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';
type StudyWriteFeature =
  | 'settingsWrite'
  | 'newQueueWrite'
  | 'reviewWrite'
  | 'cardCreate'
  | 'cardUpdate'
  | 'cardDelete'
  | 'cardAction'
  | 'cardAnswerAudio'
  | 'cardImage'
  | 'cardPitchAccent'
  | 'vocabBundleDraftCreate'
  | 'cardDraftCreate'
  | 'cardDraftUpdate'
  | 'cardDraftRetry'
  | 'cardDraftCommit'
  | 'cardDraftDelete'
  | 'cardDraftPreviewMedia'
  | 'dailyAudioCreate';
type StudyWriteBody =
  | 'empty'
  | 'cardCreate'
  | 'cardUpdate'
  | 'cardAction'
  | 'answerAudioRegenerate'
  | 'imageRegenerate'
  | 'vocabBundleDraftCreate'
  | 'cardDraftCreate'
  | 'cardDraftUpdate'
  | 'cardDraftCommit'
  | 'knownKanjiManual'
  | 'newQueue'
  | 'review'
  | 'reviewUndo'
  | 'session'
  | 'settings'
  | 'importCreate'
  | 'wanikaniConnection'
  | 'dailyAudioCreate';

interface StudyProxyRoute {
  method: StudyProxyMethod;
  pattern: RegExp;
  rateLimitCategory?: 'import';
  responseFeature?: LearningOsStudyReadFeature;
  queryParams: ReadonlySet<string>;
  upstreamQueryAliases?: Readonly<Record<string, string>>;
  writeFeature?: StudyWriteFeature;
  writeBody?: StudyWriteBody;
  reviewOperation?: 'session' | 'write';
  importUpload?: boolean;
  mediaResponse?: boolean;
  normalizeUlidPath?: boolean;
  normalizeUuidPath?: boolean;
  upstreamApiPrefix?: '/api' | '/api/study';
  timeoutMs?: number;
  responseAdapter?:
    | 'card'
    | 'cardAction'
    | 'cardDraft'
    | 'cardDraftCommit'
    | 'cardDraftList'
    | 'cardDraftPreviewAudio'
    | 'cardDraftPreviewImage'
    | 'vocabBundleDraftCreate'
    | `dailyAudio:${DailyAudioResponse}`;
}

const ALLOWED_STUDY_ROUTES: StudyProxyRoute[] = [
  {
    method: 'POST',
    pattern: /^\/daily-audio-practice$/,
    queryParams: new Set(),
    writeFeature: 'dailyAudioCreate',
    writeBody: 'dailyAudioCreate',
    upstreamApiPrefix: '/api',
    responseAdapter: 'dailyAudio:detail',
  },
  {
    method: 'GET',
    pattern: /^\/daily-audio-practice$/,
    queryParams: new Set(),
    upstreamApiPrefix: '/api',
    responseAdapter: 'dailyAudio:list',
  },
  {
    method: 'GET',
    pattern: new RegExp(`^/daily-audio-practice/${DAILY_AUDIO_UUID_SEGMENT}/status$`, 'i'),
    queryParams: new Set(),
    upstreamApiPrefix: '/api',
    responseAdapter: 'dailyAudio:status',
    normalizeUuidPath: true,
  },
  {
    method: 'GET',
    pattern: new RegExp(
      `^/daily-audio-practice/${DAILY_AUDIO_UUID_SEGMENT}/tracks/${DAILY_AUDIO_UUID_SEGMENT}/audio$`,
      'i'
    ),
    queryParams: new Set(),
    upstreamApiPrefix: '/api',
    mediaResponse: true,
    normalizeUuidPath: true,
  },
  {
    method: 'GET',
    pattern: new RegExp(`^/daily-audio-practice/${DAILY_AUDIO_UUID_SEGMENT}$`, 'i'),
    queryParams: new Set(),
    upstreamApiPrefix: '/api',
    responseAdapter: 'dailyAudio:detail',
    normalizeUuidPath: true,
  },
  {
    method: 'POST',
    pattern: /^\/card-candidates\/vocab-bundle\/drafts$/,
    queryParams: new Set(),
    writeFeature: 'vocabBundleDraftCreate',
    writeBody: 'vocabBundleDraftCreate',
    responseAdapter: 'vocabBundleDraftCreate',
  },
  {
    method: 'GET',
    pattern: new RegExp(`^/media/${STUDY_ULID_SEGMENT}$`, 'i'),
    queryParams: new Set(),
    mediaResponse: true,
  },
  {
    method: 'GET',
    pattern: /^\/card-drafts$/,
    queryParams: new Set(['cursor', 'limit']),
    responseAdapter: 'cardDraftList',
  },
  {
    method: 'POST',
    pattern: /^\/card-drafts$/,
    queryParams: new Set(),
    writeFeature: 'cardDraftCreate',
    writeBody: 'cardDraftCreate',
    responseAdapter: 'cardDraft',
  },
  {
    method: 'PATCH',
    pattern: new RegExp(`^/card-drafts/${STUDY_ULID_SEGMENT}$`, 'i'),
    queryParams: new Set(),
    writeFeature: 'cardDraftUpdate',
    writeBody: 'cardDraftUpdate',
    responseAdapter: 'cardDraft',
  },
  {
    method: 'POST',
    pattern: new RegExp(`^/card-drafts/${STUDY_ULID_SEGMENT}/retry$`, 'i'),
    queryParams: new Set(),
    writeFeature: 'cardDraftRetry',
    responseAdapter: 'cardDraft',
  },
  {
    method: 'POST',
    pattern: new RegExp(`^/card-drafts/${STUDY_ULID_SEGMENT}/preview-audio$`, 'i'),
    queryParams: new Set(),
    writeFeature: 'cardDraftPreviewMedia',
    writeBody: 'empty',
    responseAdapter: 'cardDraftPreviewAudio',
    normalizeUlidPath: true,
    timeoutMs: LEARNING_OS_GENERATED_MEDIA_TIMEOUT_MS,
  },
  {
    method: 'POST',
    pattern: new RegExp(`^/card-drafts/${STUDY_ULID_SEGMENT}/preview-image$`, 'i'),
    queryParams: new Set(),
    writeFeature: 'cardDraftPreviewMedia',
    writeBody: 'empty',
    responseAdapter: 'cardDraftPreviewImage',
    normalizeUlidPath: true,
    timeoutMs: LEARNING_OS_GENERATED_MEDIA_TIMEOUT_MS,
  },
  {
    method: 'POST',
    pattern: new RegExp(`^/card-drafts/${STUDY_ULID_SEGMENT}/create-card$`, 'i'),
    queryParams: new Set(),
    writeFeature: 'cardDraftCommit',
    writeBody: 'cardDraftCommit',
    responseAdapter: 'cardDraftCommit',
  },
  {
    method: 'DELETE',
    pattern: new RegExp(`^/card-drafts/${STUDY_ULID_SEGMENT}$`, 'i'),
    queryParams: new Set(),
    writeFeature: 'cardDraftDelete',
  },
  {
    method: 'POST',
    pattern: /^\/cards$/,
    queryParams: new Set(),
    writeFeature: 'cardCreate',
    writeBody: 'cardCreate',
    responseAdapter: 'card',
  },
  {
    method: 'PATCH',
    pattern: new RegExp(`^/cards/${STUDY_CARD_ID_SEGMENT}$`, 'i'),
    queryParams: new Set(),
    writeFeature: 'cardUpdate',
    writeBody: 'cardUpdate',
    responseAdapter: 'card',
  },
  {
    method: 'DELETE',
    pattern: new RegExp(`^/cards/${STUDY_CARD_ID_SEGMENT}$`, 'i'),
    queryParams: new Set(),
    writeFeature: 'cardDelete',
  },
  {
    method: 'POST',
    pattern: new RegExp(`^/cards/${STUDY_CARD_ID_SEGMENT}/actions$`, 'i'),
    queryParams: new Set(),
    writeFeature: 'cardAction',
    writeBody: 'cardAction',
    responseAdapter: 'cardAction',
  },
  {
    method: 'POST',
    pattern: new RegExp(`^/cards/${STUDY_CARD_ID_SEGMENT}/prepare-answer-audio$`, 'i'),
    queryParams: new Set(),
    writeFeature: 'cardAnswerAudio',
    writeBody: 'empty',
    responseAdapter: 'card',
    timeoutMs: LEARNING_OS_GENERATED_MEDIA_TIMEOUT_MS,
  },
  {
    method: 'POST',
    pattern: new RegExp(`^/cards/${STUDY_CARD_ID_SEGMENT}/regenerate-answer-audio$`, 'i'),
    queryParams: new Set(),
    writeFeature: 'cardAnswerAudio',
    writeBody: 'answerAudioRegenerate',
    responseAdapter: 'card',
    timeoutMs: LEARNING_OS_GENERATED_MEDIA_TIMEOUT_MS,
  },
  {
    method: 'POST',
    pattern: new RegExp(`^/cards/${STUDY_CARD_ID_SEGMENT}/regenerate-image$`, 'i'),
    queryParams: new Set(),
    writeFeature: 'cardImage',
    writeBody: 'imageRegenerate',
    responseAdapter: 'card',
    timeoutMs: LEARNING_OS_GENERATED_MEDIA_TIMEOUT_MS,
  },
  {
    method: 'POST',
    pattern: new RegExp(`^/cards/${STUDY_CARD_ID_SEGMENT}/pitch-accent$`, 'i'),
    queryParams: new Set(),
    writeFeature: 'cardPitchAccent',
    writeBody: 'empty',
    responseAdapter: 'card',
    timeoutMs: LEARNING_OS_GENERATED_MEDIA_TIMEOUT_MS,
  },
  {
    method: 'POST',
    pattern: /^\/session\/start$/,
    responseFeature: 'session',
    queryParams: new Set(),
    writeBody: 'session',
    reviewOperation: 'session',
  },
  {
    method: 'POST',
    pattern: /^\/reviews$/,
    responseFeature: 'review',
    queryParams: new Set(),
    writeFeature: 'reviewWrite',
    writeBody: 'review',
    reviewOperation: 'write',
  },
  {
    method: 'POST',
    pattern: /^\/reviews\/undo$/,
    responseFeature: 'reviewUndo',
    queryParams: new Set(),
    writeFeature: 'reviewWrite',
    writeBody: 'reviewUndo',
    reviewOperation: 'write',
  },
  {
    method: 'GET',
    pattern: /^\/overview$/,
    responseFeature: 'overview',
    queryParams: new Set(['timeZone']),
    upstreamQueryAliases: { timeZone: 'time_zone' },
  },
  {
    method: 'GET',
    pattern: /^\/settings$/,
    responseFeature: 'settings',
    queryParams: new Set(),
  },
  {
    method: 'PATCH',
    pattern: /^\/settings$/,
    responseFeature: 'settings',
    queryParams: new Set(),
    writeFeature: 'settingsWrite',
    writeBody: 'settings',
  },
  {
    method: 'GET',
    pattern: /^\/browser$/,
    responseFeature: 'browser',
    queryParams: new Set([
      'q',
      'noteType',
      'cardType',
      'queueState',
      'sortField',
      'sortDirection',
      'cursor',
      'limit',
    ]),
  },
  {
    method: 'GET',
    pattern: /^\/browser\/[A-Za-z0-9-]+$/,
    responseFeature: 'browserDetail',
    queryParams: new Set(),
  },
  {
    method: 'GET',
    pattern: /^\/new-queue$/,
    responseFeature: 'newQueue',
    queryParams: new Set(['cursor', 'limit', 'q']),
  },
  {
    method: 'POST',
    pattern: /^\/new-queue\/reorder$/,
    responseFeature: 'newQueue',
    queryParams: new Set(),
    writeFeature: 'newQueueWrite',
    writeBody: 'newQueue',
  },
  {
    method: 'POST',
    pattern: /^\/imports$/,
    rateLimitCategory: 'import',
    responseFeature: 'importSession',
    queryParams: new Set(),
    writeBody: 'importCreate',
  },
  {
    method: 'GET',
    pattern: /^\/imports\/readiness$/,
    rateLimitCategory: 'import',
    responseFeature: 'importReadiness',
    queryParams: new Set(),
  },
  {
    method: 'GET',
    pattern: /^\/imports\/current$/,
    rateLimitCategory: 'import',
    responseFeature: 'importCurrent',
    queryParams: new Set(),
  },
  {
    method: 'PUT',
    pattern: STUDY_IMPORT_UPLOAD_PATH_PATTERN,
    rateLimitCategory: 'import',
    responseFeature: 'importJob',
    queryParams: new Set(),
    importUpload: true,
  },
  {
    method: 'POST',
    pattern: new RegExp(`^/imports/${STUDY_IMPORT_ULID_SEGMENT}/complete$`),
    rateLimitCategory: 'import',
    responseFeature: 'importJob',
    queryParams: new Set(),
  },
  {
    method: 'POST',
    pattern: new RegExp(`^/imports/${STUDY_IMPORT_ULID_SEGMENT}/cancel$`),
    rateLimitCategory: 'import',
    responseFeature: 'importJob',
    queryParams: new Set(),
  },
  {
    method: 'GET',
    pattern: new RegExp(`^/imports/${STUDY_IMPORT_ID_SEGMENT}$`),
    rateLimitCategory: 'import',
    responseFeature: 'importJob',
    queryParams: new Set(),
  },
  {
    method: 'GET',
    pattern: /^\/known-kanji$/,
    queryParams: new Set(),
  },
  {
    method: 'PATCH',
    pattern: /^\/known-kanji\/manual$/,
    queryParams: new Set(),
    writeFeature: 'settingsWrite',
    writeBody: 'knownKanjiManual',
  },
  {
    method: 'PUT',
    pattern: /^\/wanikani$/,
    queryParams: new Set(),
    writeFeature: 'settingsWrite',
    writeBody: 'wanikaniConnection',
  },
  {
    method: 'DELETE',
    pattern: /^\/wanikani$/,
    queryParams: new Set(),
    writeFeature: 'settingsWrite',
  },
  {
    method: 'POST',
    pattern: /^\/wanikani\/sync$/,
    queryParams: new Set(),
    writeFeature: 'settingsWrite',
  },
];

function getStudyProxyRoute(method: string, pathname: string): StudyProxyRoute | null {
  return (
    ALLOWED_STUDY_ROUTES.find(
      (route) => route.method === method.toUpperCase() && route.pattern.test(pathname)
    ) ?? null
  );
}

function normalizeStudyProxyPath(pathname: string): string {
  return pathname
    .split('/')
    .map((segment) => (ULID_PATTERN.test(segment) ? segment.toUpperCase() : segment))
    .join('/');
}

function normalizeUuidProxyPath(pathname: string): string {
  return pathname
    .split('/')
    .map((segment) => (UUID_PATTERN.test(segment) ? segment.toLowerCase() : segment))
    .join('/');
}

function appendQueryParams(target: URL, query: AuthRequest['query'], route: StudyProxyRoute) {
  Object.entries(query).forEach(([key, value]) => {
    if (!route.queryParams.has(key)) {
      throw new AppError(`Query parameter "${key}" is not allowed for this Study API route.`, 400);
    }

    const upstreamKey = route.upstreamQueryAliases?.[key] ?? key;
    if (typeof value === 'string') {
      target.searchParams.append(upstreamKey, value);
      return;
    }

    throw new AppError(`Query parameter "${key}" must be provided exactly once as a string.`, 400);
  });
}

function requestRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AppError('Request body must be a JSON object.', 400);
  }

  return value as Record<string, unknown>;
}

function adaptEmptyBody(value: unknown): undefined {
  if (value === undefined) {
    return undefined;
  }
  if (Object.keys(requestRecord(value)).length > 0) {
    throw new AppError('Request body must be empty.', 400);
  }

  return undefined;
}

function adaptStudyCardPayloads(value: unknown): {
  prompt: Record<string, unknown>;
  answer: Record<string, unknown>;
} {
  const body = requestRecord(value);
  return assertStudyCardPayloadContract(body.prompt, body.answer);
}

function adaptCardCreateBody(value: unknown): Record<string, unknown> {
  const body = requestRecord(value);
  const payloads = adaptStudyCardPayloads(body);
  const id = body.id;
  const creationKind = body.creationKind;
  const cardType = body.cardType;
  const normalizedCreationKind =
    typeof creationKind === 'string' ? creationKind.trim().toLowerCase() : undefined;
  const normalizedCardType =
    typeof cardType === 'string' ? cardType.trim().toLowerCase() : undefined;

  if (typeof id !== 'string' || !ULID_PATTERN.test(id.trim())) {
    throw new AppError('id must be a valid ULID.', 400);
  }
  if (
    creationKind !== undefined &&
    (normalizedCreationKind === undefined ||
      !STUDY_CARD_CREATION_KINDS.has(normalizedCreationKind as StudyCardCreationKind))
  ) {
    throw new AppError('creationKind is not supported.', 400);
  }
  if (creationKind === undefined && normalizedCardType === undefined) {
    throw new AppError('cardType must be recognition, production, or cloze.', 400);
  }
  if (
    cardType !== undefined &&
    (normalizedCardType === undefined || !STUDY_CARD_TYPES.has(normalizedCardType))
  ) {
    throw new AppError('cardType must be recognition, production, or cloze.', 400);
  }
  if (
    normalizedCreationKind !== undefined &&
    normalizedCardType !== undefined &&
    cardTypeForStudyCardCreationKind(normalizedCreationKind as StudyCardCreationKind) !==
      normalizedCardType
  ) {
    throw new AppError('cardType must match creationKind.', 400);
  }

  return {
    id: id.trim().toUpperCase(),
    ...(normalizedCreationKind === undefined ? {} : { creationKind: normalizedCreationKind }),
    ...(normalizedCardType === undefined ? {} : { cardType: normalizedCardType }),
    ...payloads,
  };
}

function normalizedOptionalString(
  value: unknown,
  field: string,
  maxLength: number
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new AppError(
      `${field} must be a string no longer than ${String(maxLength)} characters.`,
      400
    );
  }

  const normalized = value.trim();
  return normalized === '' ? null : normalized;
}

function adaptCardDraftImagePlacement(value: unknown): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!STUDY_CARD_IMAGE_PLACEMENTS.has(normalized)) {
    throw new AppError('imagePlacement must be none, prompt, answer, or both.', 400);
  }

  return normalized;
}

function adaptCardDraftMediaRef(
  value: unknown,
  field: 'previewAudio' | 'previewImage',
  mediaKind: 'audio' | 'image'
): Record<string, unknown> | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const media = requestRecord(value);
  const allowedKeys = new Set(['id', 'filename', 'url', 'mediaKind', 'source']);
  if (Object.keys(media).some((key) => !allowedKeys.has(key))) {
    throw new AppError(`${field} contains an unsupported field.`, 400);
  }

  const filename = normalizedOptionalString(
    media.filename,
    `${field}.filename`,
    MAX_STUDY_DRAFT_MEDIA_FILENAME_LENGTH
  );
  const id = normalizedOptionalString(media.id, `${field}.id`, MAX_STUDY_DRAFT_MEDIA_ID_LENGTH);
  const url = normalizedOptionalString(media.url, `${field}.url`, MAX_STUDY_DRAFT_MEDIA_URL_LENGTH);
  const source = typeof media.source === 'string' ? media.source.trim().toLowerCase() : '';
  if (!filename) {
    throw new AppError(`${field}.filename is required.`, 400);
  }
  if (media.mediaKind !== mediaKind) {
    throw new AppError(`${field}.mediaKind must be ${mediaKind}.`, 400);
  }
  if (!STUDY_CARD_DRAFT_MEDIA_SOURCES.has(source)) {
    throw new AppError(`${field}.source is not supported.`, 400);
  }

  return {
    ...(id === undefined || id === null ? {} : { id }),
    filename,
    ...(url === undefined ? {} : { url }),
    mediaKind,
    source,
  };
}

function adaptCardDraftCreateBody(value: unknown): Record<string, unknown> {
  const body = requestRecord(value);
  const payloads = adaptStudyCardPayloads(body);
  const creationKind =
    typeof body.creationKind === 'string' ? body.creationKind.trim().toLowerCase() : '';
  const cardType = typeof body.cardType === 'string' ? body.cardType.trim().toLowerCase() : '';
  if (!STUDY_CARD_CREATION_KINDS.has(creationKind as StudyCardCreationKind)) {
    throw new AppError('creationKind is not supported.', 400);
  }
  if (!STUDY_CARD_TYPES.has(cardType)) {
    throw new AppError('cardType must be recognition, production, or cloze.', 400);
  }
  if (cardTypeForStudyCardCreationKind(creationKind as StudyCardCreationKind) !== cardType) {
    throw new AppError('cardType must match creationKind.', 400);
  }

  const imagePlacement = adaptCardDraftImagePlacement(body.imagePlacement);
  const imagePrompt = normalizedOptionalString(
    body.imagePrompt,
    'imagePrompt',
    MAX_STUDY_DRAFT_IMAGE_PROMPT_LENGTH
  );

  return {
    creationKind,
    cardType,
    ...payloads,
    ...(imagePlacement === undefined ? {} : { imagePlacement }),
    ...(imagePrompt === undefined ? {} : { imagePrompt }),
  };
}

function adaptVocabBundleDraftCreateBody(value: unknown): Record<string, unknown> {
  const body = requestRecord(value);
  if (typeof body.targetWord !== 'string' || body.targetWord.trim() === '') {
    throw new AppError('targetWord is required.', 400);
  }
  const targetWord = body.targetWord.trim();
  if (targetWord.length > STUDY_CANDIDATE_TARGET_MAX_LENGTH) {
    throw new AppError(
      `targetWord must be a string no longer than ${String(STUDY_CANDIDATE_TARGET_MAX_LENGTH)} characters.`,
      400
    );
  }

  const sourceSentence = normalizedOptionalString(
    body.sourceSentence,
    'sourceSentence',
    STUDY_CANDIDATE_SOURCE_SENTENCE_MAX_LENGTH
  );
  const context = normalizedOptionalString(
    body.context,
    'context',
    STUDY_CANDIDATE_CONTEXT_MAX_LENGTH
  );
  if (body.includeLearnerContext !== undefined && typeof body.includeLearnerContext !== 'boolean') {
    throw new AppError('includeLearnerContext must be a boolean.', 400);
  }

  return {
    targetWord,
    ...(sourceSentence === undefined ? {} : { sourceSentence }),
    ...(context === undefined ? {} : { context }),
    ...(body.includeLearnerContext === undefined
      ? {}
      : { includeLearnerContext: body.includeLearnerContext }),
  };
}

function adaptCardDraftUpdateBody(value: unknown): Record<string, unknown> {
  const body = requestRecord(value);
  const hasPrompt = Object.hasOwn(body, 'prompt');
  const hasAnswer = Object.hasOwn(body, 'answer');
  if (hasPrompt !== hasAnswer) {
    throw new AppError('prompt and answer payloads are required together.', 400);
  }

  const payloads = hasPrompt ? adaptStudyCardPayloads(body) : undefined;
  const imagePlacement = adaptCardDraftImagePlacement(body.imagePlacement);
  const imagePrompt = normalizedOptionalString(
    body.imagePrompt,
    'imagePrompt',
    MAX_STUDY_DRAFT_IMAGE_PROMPT_LENGTH
  );
  const previewAudio = adaptCardDraftMediaRef(body.previewAudio, 'previewAudio', 'audio');
  const previewImage = adaptCardDraftMediaRef(body.previewImage, 'previewImage', 'image');
  let previewAudioRole: string | null | undefined = body.previewAudioRole as
    | string
    | null
    | undefined;
  if (previewAudioRole !== undefined && previewAudioRole !== null) {
    previewAudioRole =
      typeof previewAudioRole === 'string' ? previewAudioRole.trim().toLowerCase() : '';
    if (!STUDY_CARD_DRAFT_AUDIO_ROLES.has(previewAudioRole)) {
      throw new AppError('previewAudioRole must be prompt or answer.', 400);
    }
  }
  if (previewAudioRole !== undefined && previewAudioRole !== null && previewAudio === null) {
    throw new AppError('previewAudioRole requires previewAudio.', 400);
  }

  return {
    ...(payloads ?? {}),
    ...(imagePlacement === undefined ? {} : { imagePlacement }),
    ...(imagePrompt === undefined ? {} : { imagePrompt }),
    ...(previewAudio === undefined ? {} : { previewAudio }),
    ...(previewAudioRole === undefined ? {} : { previewAudioRole }),
    ...(previewImage === undefined ? {} : { previewImage }),
  };
}

function adaptCardDraftCommitBody(value: unknown): { id: string } {
  const id = requestRecord(value).id;
  if (typeof id !== 'string' || !ULID_PATTERN.test(id.trim())) {
    throw new AppError('id must be a valid ULID.', 400);
  }

  return { id: id.trim().toUpperCase() };
}

function adaptCardUpdateBody(value: unknown): Record<string, unknown> {
  return adaptStudyCardPayloads(value);
}

function adaptCardActionBody(value: unknown): Record<string, unknown> {
  const body = requestRecord(value);
  const action = typeof body.action === 'string' ? body.action.trim().toLowerCase() : '';
  if (!STUDY_CARD_ACTIONS.has(action)) {
    throw new AppError('action must be suspend, unsuspend, forget, or set_due.', 400);
  }

  const currentOverview = adaptOptionalOverview(body);
  if (action !== 'set_due') {
    return {
      action,
      ...(currentOverview === undefined ? {} : { currentOverview }),
    };
  }

  const mode = typeof body.mode === 'string' ? body.mode.trim().toLowerCase() : '';
  if (!STUDY_CARD_SET_DUE_MODES.has(mode)) {
    throw new AppError('mode must be now, tomorrow, or custom_date for set_due.', 400);
  }

  const dueAt = body.dueAt;
  if (
    mode === 'custom_date' &&
    (typeof dueAt !== 'string' ||
      !STRICT_ISO_DATETIME_PATTERN.test(dueAt.trim()) ||
      Number.isNaN(Date.parse(dueAt)))
  ) {
    throw new AppError('dueAt must be a valid ISO-8601 datetime for custom_date.', 400);
  }
  if (mode === 'custom_date') {
    const maxDueAt = new Date();
    maxDueAt.setFullYear(maxDueAt.getFullYear() + MAX_STUDY_SET_DUE_FUTURE_YEARS);
    if (Date.parse(dueAt as string) > maxDueAt.getTime()) {
      throw new AppError(
        `dueAt must be within ${String(MAX_STUDY_SET_DUE_FUTURE_YEARS)} years.`,
        400
      );
    }
  }

  const timeZone = adaptOptionalTimeZone(body);
  if (mode === 'tomorrow' && timeZone === undefined) {
    throw new AppError('timeZone must be a valid IANA timezone for tomorrow.', 400);
  }

  return {
    action,
    mode,
    ...(mode === 'custom_date' ? { dueAt: (dueAt as string).trim() } : {}),
    ...(timeZone === undefined ? {} : { timeZone }),
    ...(currentOverview === undefined ? {} : { currentOverview }),
  };
}

function adaptAnswerAudioRegenerateBody(value: unknown): Record<string, unknown> {
  const body = requestRecord(value);
  const allowedKeys = new Set(['answerAudioVoiceId', 'answerAudioTextOverride']);
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
    throw new AppError('Answer audio regeneration contains an unsupported field.', 400);
  }

  const voiceId = body.answerAudioVoiceId;
  const trimmedVoiceId = typeof voiceId === 'string' ? voiceId.trim() : null;
  const normalizedVoiceId =
    trimmedVoiceId !== null && STUDY_ANSWER_AUDIO_FISH_VOICE_IDS.has(trimmedVoiceId)
      ? trimmedVoiceId
      : (STUDY_ANSWER_AUDIO_LEGACY_VOICE_MIGRATIONS.get(trimmedVoiceId ?? '') ?? null);
  if (voiceId !== undefined && voiceId !== null && normalizedVoiceId === null) {
    throw new AppError('answerAudioVoiceId is not supported.', 400);
  }

  const textOverride = body.answerAudioTextOverride;
  if (
    textOverride !== undefined &&
    textOverride !== null &&
    (typeof textOverride !== 'string' ||
      Array.from(textOverride).length > MAX_STUDY_ANSWER_AUDIO_TEXT_LENGTH)
  ) {
    throw new AppError(
      `answerAudioTextOverride must be a string no longer than ${String(MAX_STUDY_ANSWER_AUDIO_TEXT_LENGTH)} characters.`,
      400
    );
  }

  return {
    ...(voiceId === undefined
      ? {}
      : { answerAudioVoiceId: voiceId === null ? null : normalizedVoiceId }),
    ...(textOverride === undefined ? {} : { answerAudioTextOverride: textOverride }),
  };
}

function adaptImageRegenerateBody(value: unknown): {
  imagePrompt: string;
  imageRole: 'prompt' | 'answer' | 'both';
} {
  const body = requestRecord(value);
  const allowedKeys = new Set(['imagePrompt', 'imageRole']);
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
    throw new AppError('Image regeneration contains an unsupported field.', 400);
  }

  const imagePrompt = typeof body.imagePrompt === 'string' ? body.imagePrompt.trim() : '';
  if (
    imagePrompt.length < 1 ||
    Array.from(imagePrompt).length > STUDY_CANDIDATE_IMAGE_PROMPT_MAX_LENGTH
  ) {
    throw new AppError(
      `imagePrompt must be a non-empty string no longer than ${String(STUDY_CANDIDATE_IMAGE_PROMPT_MAX_LENGTH)} characters.`,
      400
    );
  }
  if (body.imageRole !== 'prompt' && body.imageRole !== 'answer' && body.imageRole !== 'both') {
    throw new AppError('imageRole must be prompt, answer, or both.', 400);
  }

  return {
    imagePrompt,
    imageRole: body.imageRole,
  };
}

function adaptSettingsWriteBody(value: unknown): { new_cards_per_day: number } {
  const body = requestRecord(value);
  const newCardsPerDay = body.newCardsPerDay;

  if (
    !Number.isInteger(newCardsPerDay) ||
    (newCardsPerDay as number) < 0 ||
    (newCardsPerDay as number) > 1000
  ) {
    throw new AppError('newCardsPerDay must be an integer between 0 and 1000.', 400);
  }

  return { new_cards_per_day: newCardsPerDay as number };
}

function adaptNewQueueWriteBody(value: unknown): { cardIds: string[] } {
  const cardIds = requestRecord(value).cardIds;
  if (
    !Array.isArray(cardIds) ||
    cardIds.length < 1 ||
    cardIds.length > MAX_NEW_QUEUE_REORDER_SIZE
  ) {
    throw new AppError(
      `cardIds must include between 1 and ${MAX_NEW_QUEUE_REORDER_SIZE} cards.`,
      400
    );
  }

  const normalizedCardIds = cardIds.map((cardId) => {
    if (typeof cardId !== 'string' || !ULID_PATTERN.test(cardId)) {
      throw new AppError('Each cardId must be a valid ULID.', 400);
    }

    return cardId.toUpperCase();
  });

  if (new Set(normalizedCardIds).size !== normalizedCardIds.length) {
    throw new AppError('cardIds must not contain duplicates.', 400);
  }

  return { cardIds: normalizedCardIds };
}

function adaptKnownKanjiManualBody(value: unknown): { kanji: string; known: boolean } {
  const body = requestRecord(value);
  const kanji = body.kanji;
  const known = body.known;

  if (typeof kanji !== 'string' || !/^[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]$/u.test(kanji)) {
    throw new AppError('kanji must be exactly one kanji character.', 400);
  }
  if (typeof known !== 'boolean') {
    throw new AppError('known must be a boolean.', 400);
  }

  return { kanji, known };
}

function adaptWaniKaniConnectionBody(value: unknown): { apiToken: string } {
  const apiToken = requestRecord(value).apiToken;
  if (typeof apiToken !== 'string' || apiToken.trim().length < 1 || apiToken.trim().length > 512) {
    throw new AppError('apiToken must be a non-empty string no longer than 512 characters.', 400);
  }

  return { apiToken: apiToken.trim() };
}

function adaptOptionalTimeZone(body: Record<string, unknown>): string | undefined {
  const timeZone = body.timeZone;
  if (timeZone === undefined || timeZone === null || timeZone === '') {
    return undefined;
  }
  if (typeof timeZone !== 'string') {
    throw new AppError('timeZone must be a valid IANA timezone.', 400);
  }

  const normalized = timeZone.trim();
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: normalized }).format(new Date());
  } catch {
    throw new AppError('timeZone must be a valid IANA timezone.', 400);
  }

  return normalized;
}

function adaptOptionalOverview(body: Record<string, unknown>): Record<string, unknown> | undefined {
  const currentOverview = body.currentOverview;
  if (currentOverview === undefined || currentOverview === null) {
    return undefined;
  }

  return requestRecord(currentOverview);
}

function adaptSessionBody(value: unknown): { time_zone?: string } {
  if (value === undefined) {
    return {};
  }

  const body = requestRecord(value);
  const timeZone = adaptOptionalTimeZone(body);

  return timeZone === undefined ? {} : { time_zone: timeZone };
}

function adaptReviewBody(value: unknown): Record<string, unknown> {
  const body = requestRecord(value);
  const cardId = body.cardId;
  const grade = body.grade;

  if (typeof cardId !== 'string' || (!UUID_PATTERN.test(cardId) && !ULID_PATTERN.test(cardId))) {
    throw new AppError('cardId must be a valid Study card id.', 400);
  }
  if (typeof grade !== 'string' || !['again', 'hard', 'good', 'easy'].includes(grade)) {
    throw new AppError('grade must be again, hard, good, or easy.', 400);
  }

  const durationMs = body.durationMs;
  const normalizedDuration =
    typeof durationMs === 'number' && Number.isFinite(durationMs)
      ? Math.max(0, Math.min(MAX_STUDY_REVIEW_DURATION_MS, Math.trunc(durationMs)))
      : undefined;
  const timeZone = adaptOptionalTimeZone(body);
  const currentOverview = adaptOptionalOverview(body);
  const normalizedCardId = ULID_PATTERN.test(cardId) ? cardId.toUpperCase() : cardId;

  return {
    cardId: normalizedCardId,
    grade,
    ...(normalizedDuration === undefined ? {} : { durationMs: normalizedDuration }),
    ...(timeZone === undefined ? {} : { timeZone }),
    ...(currentOverview === undefined ? {} : { currentOverview }),
  };
}

function adaptReviewUndoBody(value: unknown): Record<string, unknown> {
  const body = requestRecord(value);
  const reviewLogId = body.reviewLogId;

  if (typeof reviewLogId !== 'string' || !ULID_PATTERN.test(reviewLogId.trim())) {
    throw new AppError('reviewLogId must be a valid ULID.', 400);
  }

  const timeZone = adaptOptionalTimeZone(body);
  const currentOverview = adaptOptionalOverview(body);

  return {
    reviewLogId: reviewLogId.trim().toUpperCase(),
    ...(timeZone === undefined ? {} : { timeZone }),
    ...(currentOverview === undefined ? {} : { currentOverview }),
  };
}

function adaptImportCreateBody(value: unknown): { filename: string; content_type?: string } {
  const body = requestRecord(value);
  const filename = body.filename;
  const contentType = body.contentType;
  const normalizedFilename = typeof filename === 'string' ? filename.trim() : '';
  const normalizedContentType =
    typeof contentType === 'string' ? contentType.trim().toLowerCase() : undefined;

  if (
    normalizedFilename.length < 1 ||
    normalizedFilename.length > 255 ||
    /[\\/]/.test(normalizedFilename) ||
    !normalizedFilename.toLowerCase().endsWith('.colpkg')
  ) {
    throw new AppError('filename must be a valid .colpkg filename.', 400);
  }
  if (
    contentType !== undefined &&
    (normalizedContentType === undefined || !STUDY_IMPORT_CONTENT_TYPES.has(normalizedContentType))
  ) {
    throw new AppError('contentType must be a supported archive content type.', 400);
  }

  return {
    filename: normalizedFilename,
    ...(normalizedContentType === undefined ? {} : { content_type: normalizedContentType }),
  };
}

function adaptDailyAudioCreateBody(value: unknown): Record<string, unknown> {
  if (value === undefined) {
    return {};
  }

  const body = requestRecord(value);
  const allowedKeys = new Set(['timeZone', 'targetDurationMinutes']);
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
    throw new AppError('Daily Audio request contains unsupported fields.', 400);
  }

  const timeZone = adaptOptionalTimeZone(body);
  if (timeZone !== undefined && timeZone.length > 64) {
    throw new AppError('timeZone must be a valid IANA timezone no longer than 64 characters.', 400);
  }
  const targetDurationMinutes = body.targetDurationMinutes;
  if (
    targetDurationMinutes !== undefined &&
    targetDurationMinutes !== null &&
    (!Number.isInteger(targetDurationMinutes) ||
      (targetDurationMinutes as number) < 5 ||
      (targetDurationMinutes as number) > 60)
  ) {
    throw new AppError('targetDurationMinutes must be an integer from 5 to 60.', 400);
  }

  return {
    ...(timeZone === undefined ? {} : { timeZone }),
    ...(targetDurationMinutes === undefined || targetDurationMinutes === null
      ? {}
      : { targetDurationMinutes }),
  };
}

function adaptWriteBody(route: StudyProxyRoute, value: unknown): unknown {
  if (route.writeBody === 'empty') {
    return adaptEmptyBody(value);
  }
  if (route.writeBody === 'cardCreate') {
    return adaptCardCreateBody(value);
  }
  if (route.writeBody === 'cardUpdate') {
    return adaptCardUpdateBody(value);
  }
  if (route.writeBody === 'cardAction') {
    return adaptCardActionBody(value);
  }
  if (route.writeBody === 'answerAudioRegenerate') {
    return adaptAnswerAudioRegenerateBody(value);
  }
  if (route.writeBody === 'imageRegenerate') {
    return adaptImageRegenerateBody(value);
  }
  if (route.writeBody === 'vocabBundleDraftCreate') {
    return adaptVocabBundleDraftCreateBody(value);
  }
  if (route.writeBody === 'cardDraftCreate') {
    return adaptCardDraftCreateBody(value);
  }
  if (route.writeBody === 'cardDraftUpdate') {
    return adaptCardDraftUpdateBody(value);
  }
  if (route.writeBody === 'cardDraftCommit') {
    return adaptCardDraftCommitBody(value);
  }
  if (route.writeBody === 'settings') {
    return adaptSettingsWriteBody(value);
  }
  if (route.writeBody === 'newQueue') {
    return adaptNewQueueWriteBody(value);
  }
  if (route.writeBody === 'knownKanjiManual') {
    return adaptKnownKanjiManualBody(value);
  }
  if (route.writeBody === 'wanikaniConnection') {
    return adaptWaniKaniConnectionBody(value);
  }
  if (route.writeBody === 'session') {
    return adaptSessionBody(value);
  }
  if (route.writeBody === 'review') {
    return adaptReviewBody(value);
  }
  if (route.writeBody === 'reviewUndo') {
    return adaptReviewUndoBody(value);
  }
  if (route.writeBody === 'importCreate') {
    return adaptImportCreateBody(value);
  }
  if (route.writeBody === 'dailyAudioCreate') {
    return adaptDailyAudioCreateBody(value);
  }

  return undefined;
}

function rateLimitLearningOsStudyRoute(req: AuthRequest, res: Response, next: NextFunction) {
  const route = getStudyProxyRoute(req.method, req.path);
  if (!route) {
    next();
    return;
  }

  if (route.mediaResponse) {
    learningOsStudyMediaRateLimit(req, res, next);
  } else if (route.rateLimitCategory === 'import') {
    learningOsStudyImportRateLimit(req, res, next);
  } else if (route.writeFeature === 'settingsWrite') {
    learningOsSettingsWriteRateLimit(req, res, next);
  } else if (route.writeFeature === 'newQueueWrite') {
    learningOsNewQueueWriteRateLimit(req, res, next);
  } else if (route.reviewOperation === 'session') {
    learningOsStudySessionRateLimit(req, res, next);
  } else if (route.reviewOperation === 'write') {
    learningOsReviewWriteRateLimit(req, res, next);
  } else if (route.writeFeature === 'cardCreate') {
    learningOsCardCreateRateLimit(req, res, next);
  } else if (route.writeFeature === 'cardUpdate') {
    learningOsCardUpdateRateLimit(req, res, next);
  } else if (route.writeFeature === 'cardDelete') {
    learningOsCardDeleteRateLimit(req, res, next);
  } else if (route.writeFeature === 'cardAction') {
    learningOsCardActionRateLimit(req, res, next);
  } else if (route.writeFeature === 'cardAnswerAudio') {
    learningOsCardAnswerAudioRateLimit(req, res, next);
  } else if (route.writeFeature === 'cardImage') {
    learningOsCardImageRateLimit(req, res, next);
  } else if (route.writeFeature === 'cardPitchAccent') {
    learningOsCardPitchAccentRateLimit(req, res, next);
  } else if (route.writeFeature === 'vocabBundleDraftCreate') {
    learningOsVocabBundleDraftCreateRateLimit(req, res, next);
  } else if (route.writeFeature === 'cardDraftCreate') {
    learningOsCardDraftCreateRateLimit(req, res, next);
  } else if (route.writeFeature === 'cardDraftUpdate') {
    learningOsCardDraftUpdateRateLimit(req, res, next);
  } else if (route.writeFeature === 'cardDraftRetry') {
    learningOsCardDraftRetryRateLimit(req, res, next);
  } else if (route.writeFeature === 'cardDraftCommit') {
    learningOsCardDraftCommitRateLimit(req, res, next);
  } else if (route.writeFeature === 'cardDraftDelete') {
    learningOsCardDraftDeleteRateLimit(req, res, next);
  } else if (route.writeFeature === 'cardDraftPreviewMedia') {
    learningOsCardDraftPreviewMediaRateLimit(req, res, next);
  } else if (route.writeFeature === 'dailyAudioCreate') {
    learningOsDailyAudioGenerationRateLimit(req, res, next);
  } else {
    learningOsStudyReadRateLimit(req, res, next);
  }
}

function mediaRequestHeaders(req: AuthRequest): Record<string, string> {
  const accept = req.header('Accept')?.trim();
  const range = req.header('Range')?.trim();

  if (range !== undefined && (range.length > 100 || !/^bytes=(?:\d+-\d*|-\d+)$/.test(range))) {
    throw new AppError('Invalid Study media byte range.', 400);
  }

  return {
    // Accept is advisory, so malformed or oversized values use the neutral media fallback.
    Accept: accept && accept.length <= 1024 && !/[\r\n]/.test(accept) ? accept : '*/*',
    ...(range === undefined ? {} : { Range: range }),
  };
}

function importUploadHeaders(req: AuthRequest): Record<string, string> {
  const contentType = req.header('Content-Type')?.trim().toLowerCase();
  if (!contentType || !STUDY_IMPORT_CONTENT_TYPES.has(contentType)) {
    throw new AppError('Only .colpkg Anki collection backups are accepted.', 400);
  }

  const contentLength = req.header('Content-Length')?.trim();
  if (contentLength !== undefined) {
    const normalizedLength = contentLength.replace(/^0+(?=\d)/, '');
    const maxLength = String(MAX_STUDY_IMPORT_UPLOAD_BYTES);
    if (
      !/^\d+$/.test(contentLength) ||
      normalizedLength.length > maxLength.length ||
      (normalizedLength.length === maxLength.length && normalizedLength > maxLength)
    ) {
      throw new AppError(
        `Study import upload must not exceed ${String(MAX_STUDY_IMPORT_UPLOAD_BYTES)} bytes.`,
        400
      );
    }
  }

  return {
    'Content-Type': contentType,
    ...(contentLength === undefined ? {} : { 'Content-Length': contentLength }),
  };
}

async function fetchLearningOsStudyImportUpload(
  upstreamUrl: URL,
  apiToken: string,
  user: LearningOsProxyUser,
  req: AuthRequest
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LEARNING_OS_IMPORT_UPLOAD_TIMEOUT_MS);
  const abortUpstream = () => controller.abort();
  req.once('aborted', abortUpstream);

  try {
    const requestInit = {
      method: 'PUT',
      signal: controller.signal,
      headers: learningOsProxyHeaders(apiToken, user, importUploadHeaders(req)),
      body: req,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' };

    return await fetch(upstreamUrl, requestInit);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new AppError('Learning OS Study import upload timed out or was interrupted.', 504);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
    req.off('aborted', abortUpstream);
  }
}

function adaptStudyRouteResponse(
  route: StudyProxyRoute,
  value: unknown,
  pathname: string
): unknown {
  if (route.responseAdapter?.startsWith('dailyAudio:')) {
    return adaptDailyAudioResponse(
      route.responseAdapter.slice('dailyAudio:'.length) as DailyAudioResponse,
      value
    );
  }
  if (route.responseAdapter === 'card') {
    return rewriteStudyCardMediaUrls(value);
  }
  if (route.responseAdapter === 'cardAction') {
    const response = upstreamResponseRecord(value, 'card action');
    return {
      ...response,
      card: rewriteStudyCardMediaUrls(response.card),
    };
  }
  if (route.responseAdapter === 'cardDraft') {
    assertCardDraftResponse(value);
    return rewriteStudyCardDraftMediaUrls(value);
  }
  if (route.responseAdapter === 'cardDraftPreviewAudio') {
    const response = upstreamResponseRecord(value, 'card draft preview audio');
    if (
      Object.keys(response).some((key) => key !== 'previewAudio' && key !== 'previewAudioRole') ||
      !validGeneratedPreviewMediaRef(response.previewAudio, 'audio') ||
      (response.previewAudioRole !== 'prompt' && response.previewAudioRole !== 'answer')
    ) {
      throw new AppError(
        'Learning OS Study API returned an invalid card draft preview audio response.',
        502
      );
    }

    return {
      previewAudio: normalizeGeneratedPreviewMediaRef(response.previewAudio),
      previewAudioRole: response.previewAudioRole,
    };
  }
  if (route.responseAdapter === 'cardDraftPreviewImage') {
    const response = upstreamResponseRecord(value, 'card draft preview image');
    if (
      Object.keys(response).some(
        (key) => key !== 'imagePrompt' && key !== 'imagePlacement' && key !== 'previewImage'
      ) ||
      typeof response.imagePrompt !== 'string' ||
      response.imagePrompt.trim().length === 0 ||
      response.imagePrompt.length > MAX_STUDY_DRAFT_IMAGE_PROMPT_LENGTH ||
      typeof response.imagePlacement !== 'string' ||
      !STUDY_CARD_IMAGE_PLACEMENTS.has(response.imagePlacement) ||
      response.imagePlacement === 'none' ||
      !validGeneratedPreviewMediaRef(response.previewImage, 'image')
    ) {
      throw new AppError(
        'Learning OS Study API returned an invalid card draft preview image response.',
        502
      );
    }

    return {
      imagePrompt: response.imagePrompt,
      imagePlacement: response.imagePlacement,
      previewImage: normalizeGeneratedPreviewMediaRef(response.previewImage),
    };
  }
  if (route.responseAdapter === 'cardDraftList') {
    const response = upstreamResponseRecord(value, 'card draft list');
    if (
      !Array.isArray(response.drafts) ||
      !response.drafts.every((draft) => {
        try {
          assertCardDraftResponse(draft);
          return true;
        } catch {
          return false;
        }
      }) ||
      (response.total !== null &&
        (typeof response.total !== 'number' ||
          !Number.isInteger(response.total) ||
          response.total < 0)) ||
      typeof response.limit !== 'number' ||
      !Number.isInteger(response.limit) ||
      response.limit < 1 ||
      response.limit > 2000 ||
      (response.nextCursor !== null && typeof response.nextCursor !== 'string')
    ) {
      throw new AppError(
        'Learning OS Study API returned an invalid card draft list response.',
        502
      );
    }

    return {
      ...response,
      drafts: response.drafts.map(rewriteStudyCardDraftMediaUrls),
    };
  }
  if (route.responseAdapter === 'vocabBundleDraftCreate') {
    const response = upstreamResponseRecord(value, 'vocab bundle draft create');
    const groupId = response.groupId;
    if (typeof groupId !== 'string' || !ULID_PATTERN.test(groupId)) {
      throw new AppError(
        'Learning OS Study API returned an invalid vocab bundle draft response.',
        502
      );
    }

    const normalizedGroupId = groupId.toUpperCase();
    const drafts = response.drafts;
    if (!Array.isArray(drafts)) {
      throw new AppError(
        'Learning OS Study API returned an invalid vocab bundle draft response.',
        502
      );
    }

    const stageCounts = new Map<number, number>();
    const validDrafts =
      drafts.length === STUDY_VOCAB_BUNDLE_CARD_COUNT &&
      drafts.every((draft) => {
        try {
          assertCardDraftResponse(draft);
          const record = draft as Record<string, unknown>;
          const stage = record.variantStage;
          const expectedKind =
            typeof stage === 'number' ? STUDY_VOCAB_VARIANT_KINDS_BY_STAGE[stage] : undefined;
          const expectedStatus = stage === 1 ? 'available' : 'locked';
          const usesSentence = stage === 1 || stage === 2 || stage === 5;
          const valid =
            Number.isInteger(stage) &&
            expectedKind !== undefined &&
            record.variantKind === expectedKind &&
            record.variantStatus === expectedStatus &&
            typeof record.variantGroupId === 'string' &&
            record.variantGroupId.toUpperCase() === normalizedGroupId &&
            (usesSentence
              ? typeof record.variantSentenceId === 'string' &&
                ULID_PATTERN.test(record.variantSentenceId)
              : record.variantSentenceId === null) &&
            (stage === 1
              ? validTimestamp(record.variantUnlockedAt)
              : record.variantUnlockedAt === null);

          if (valid && typeof stage === 'number') {
            stageCounts.set(stage, (stageCounts.get(stage) ?? 0) + 1);
          }
          return valid;
        } catch {
          return false;
        }
      });
    const validStageCounts =
      stageCounts.get(1) === 3 &&
      stageCounts.get(2) === 3 &&
      stageCounts.get(3) === 1 &&
      stageCounts.get(4) === 1 &&
      stageCounts.get(5) === 3;

    if (!validDrafts || !validStageCounts) {
      throw new AppError(
        'Learning OS Study API returned an invalid vocab bundle draft response.',
        502
      );
    }

    return {
      ...response,
      groupId: normalizedGroupId,
      drafts: drafts.map(rewriteStudyCardDraftMediaUrls),
    };
  }
  if (route.responseAdapter === 'cardDraftCommit') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new AppError(
        'Learning OS Study API returned an invalid card draft commit response.',
        502
      );
    }
    const card = value as Record<string, unknown>;
    if (
      typeof card.id !== 'string' ||
      !ULID_PATTERN.test(card.id) ||
      typeof card.cardType !== 'string' ||
      !STUDY_CARD_TYPES.has(card.cardType)
    ) {
      throw new AppError(
        'Learning OS Study API returned an invalid card draft commit response.',
        502
      );
    }
    const match = pathname.match(
      new RegExp(`^/card-drafts/(${STUDY_ULID_SEGMENT})/create-card$`, 'i')
    );
    if (!match?.[1]) {
      throw new AppError(
        'Learning OS Study API returned an invalid card draft commit response.',
        502
      );
    }

    return {
      card: rewriteStudyCardMediaUrls(card),
      draftId: match[1].toUpperCase(),
    };
  }

  return route.responseFeature
    ? adaptLearningOsStudyReadResponse(route.responseFeature, value)
    : value;
}

const FORWARDED_MEDIA_RESPONSE_HEADERS = [
  'accept-ranges',
  'cache-control',
  'content-disposition',
  'content-length',
  'content-range',
  'content-type',
  'etag',
  'last-modified',
] as const;

function safeMediaResponseHeader(name: string, value: string): boolean {
  if (value.length === 0 || value.length > 1024 || /[\r\n]/.test(value)) {
    return false;
  }

  return name !== 'content-length' || /^\d+$/.test(value);
}

async function streamLearningOsStudyMedia(
  upstreamResponse: globalThis.Response,
  res: Response
): Promise<void> {
  const contentType = upstreamResponse.headers.get('content-type');
  if (
    !contentType ||
    !safeMediaResponseHeader('content-type', contentType) ||
    /^image\/svg\+xml(?:\s*;|$)/i.test(contentType) ||
    (!/^(?:audio|image|video)\//i.test(contentType) &&
      !/^application\/octet-stream(?:\s*;|$)/i.test(contentType))
  ) {
    throw new AppError('Learning OS Study API returned invalid media headers.', 502);
  }

  for (const name of FORWARDED_MEDIA_RESPONSE_HEADERS) {
    const value = upstreamResponse.headers.get(name);
    if (value !== null && safeMediaResponseHeader(name, value)) {
      res.setHeader(name, value);
    }
  }
  res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.status(upstreamResponse.status);

  if (!upstreamResponse.body) {
    res.end();
    return;
  }

  await pipeline(
    Readable.fromWeb(upstreamResponse.body as Parameters<typeof Readable.fromWeb>[0]),
    res
  );
}

function upstreamResponseRecord(value: unknown, feature: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AppError(`Learning OS Study API returned an invalid ${feature} response.`, 502);
  }

  return value as Record<string, unknown>;
}

function validCardDraftMediaRef(value: unknown, mediaKind: 'audio' | 'image'): boolean {
  if (value === null) {
    return true;
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const media = value as Record<string, unknown>;
  return (
    typeof media.filename === 'string' &&
    media.filename.length > 0 &&
    media.mediaKind === mediaKind &&
    typeof media.source === 'string' &&
    STUDY_CARD_DRAFT_MEDIA_SOURCES.has(media.source) &&
    (media.id === undefined || media.id === null || typeof media.id === 'string') &&
    (media.url === undefined || media.url === null || typeof media.url === 'string')
  );
}

function validGeneratedPreviewMediaRef(value: unknown, mediaKind: 'audio' | 'image'): boolean {
  if (!validCardDraftMediaRef(value, mediaKind) || value === null) {
    return false;
  }
  const media = value as Record<string, unknown>;
  const allowedKeys = new Set(['id', 'filename', 'url', 'mediaKind', 'source']);
  // Learning OS explicitly requests MP3/WebP output; provider model selection does not vary it.
  const expectedExtension = mediaKind === 'audio' ? '.mp3' : '.webp';

  return (
    !Object.keys(media).some((key) => !allowedKeys.has(key)) &&
    typeof media.id === 'string' &&
    ULID_PATTERN.test(media.id) &&
    typeof media.url === 'string' &&
    media.url.length > 0 &&
    media.url.length <= MAX_STUDY_DRAFT_MEDIA_URL_LENGTH &&
    media.url.toUpperCase() === `/API/STUDY/MEDIA/${media.id.toUpperCase()}` &&
    typeof media.filename === 'string' &&
    media.filename.length <= MAX_STUDY_DRAFT_MEDIA_FILENAME_LENGTH &&
    !/[\\/\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(media.filename) &&
    media.filename.toLowerCase().endsWith(expectedExtension) &&
    media.source === 'generated'
  );
}

function normalizeGeneratedPreviewMediaRef(value: unknown): Record<string, unknown> {
  const media = value as Record<string, unknown>;
  return {
    ...media,
    id: (media.id as string).toUpperCase(),
    url: rewriteLearningOsStudyMediaUrl(media.url as string),
  };
}

function validNullableString(value: unknown): boolean {
  return value === null || typeof value === 'string';
}

function validTimestamp(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    STRICT_ISO_DATETIME_PATTERN.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function assertCardDraftResponse(value: unknown): void {
  const draft = upstreamResponseRecord(value, 'card draft');
  const creationKind = typeof draft.creationKind === 'string' ? draft.creationKind : '';
  const expectedCardType = STUDY_CARD_CREATION_KINDS.has(creationKind as StudyCardCreationKind)
    ? cardTypeForStudyCardCreationKind(creationKind as StudyCardCreationKind)
    : null;
  if (
    typeof draft.id !== 'string' ||
    !ULID_PATTERN.test(draft.id) ||
    typeof draft.status !== 'string' ||
    !['generating', 'ready', 'error'].includes(draft.status) ||
    expectedCardType === null ||
    draft.cardType !== expectedCardType ||
    typeof draft.prompt !== 'object' ||
    draft.prompt === null ||
    Array.isArray(draft.prompt) ||
    typeof draft.answer !== 'object' ||
    draft.answer === null ||
    Array.isArray(draft.answer) ||
    typeof draft.imagePlacement !== 'string' ||
    !STUDY_CARD_IMAGE_PLACEMENTS.has(draft.imagePlacement) ||
    !validNullableString(draft.imagePrompt) ||
    !validCardDraftMediaRef(draft.previewAudio, 'audio') ||
    (draft.previewAudioRole !== null &&
      (typeof draft.previewAudioRole !== 'string' ||
        !STUDY_CARD_DRAFT_AUDIO_ROLES.has(draft.previewAudioRole))) ||
    !validCardDraftMediaRef(draft.previewImage, 'image') ||
    !validNullableString(draft.errorMessage) ||
    !validTimestamp(draft.createdAt) ||
    !validTimestamp(draft.updatedAt)
  ) {
    throw new AppError('Learning OS Study API returned an invalid card draft response.', 502);
  }
}

function extractNewQueueValidationMessage(responseBody: string): string | null {
  let response: unknown;
  try {
    response = JSON.parse(responseBody);
  } catch {
    return null;
  }

  if (typeof response !== 'object' || response === null || Array.isArray(response)) {
    return null;
  }

  const errors = (response as Record<string, unknown>).errors;
  if (typeof errors !== 'object' || errors === null || Array.isArray(errors)) {
    return null;
  }

  for (const [key, messages] of Object.entries(errors)) {
    if (!/^cardIds(?:\.\d+)?$/.test(key) || !Array.isArray(messages)) {
      continue;
    }

    const message = messages.find(
      (value): value is string =>
        typeof value === 'string' &&
        value.trim().length > 0 &&
        value.length <= MAX_UPSTREAM_VALIDATION_MESSAGE_LENGTH &&
        !/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(value)
    );
    if (message) {
      return message.trim();
    }
  }

  return null;
}

router.all(
  '/*',
  learningOsStudyIpRateLimit,
  requireAuth,
  rateLimitLearningOsStudyRoute,
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId) {
        throw new AppError('Authentication required', 401);
      }

      const route = getStudyProxyRoute(req.method, req.path);
      if (!route) {
        throw new AppError('Learning OS Study API route is not allowed.', 404);
      }

      const {
        config: { apiUrl, apiToken },
        user,
      } = await resolveLearningOsProxyContext(req.userId, 'Learning OS Study API');

      const upstreamPath = route.normalizeUlidPath
        ? normalizeStudyProxyPath(req.path)
        : route.normalizeUuidPath
          ? normalizeUuidProxyPath(req.path)
          : req.path;
      const upstreamUrl = new URL(
        `${apiUrl}${route.upstreamApiPrefix ?? '/api/study'}${upstreamPath}`
      );
      appendQueryParams(upstreamUrl, req.query, route);
      const body = route.importUpload ? undefined : adaptWriteBody(route, req.body);
      const upstreamResponse = route.importUpload
        ? await fetchLearningOsStudyImportUpload(upstreamUrl, apiToken, user, req)
        : await fetchLearningOsProxy({
            upstreamUrl,
            apiToken,
            user,
            method: route.method,
            body,
            additionalHeaders: route.mediaResponse ? mediaRequestHeaders(req) : undefined,
            timeoutMs: route.timeoutMs ?? LEARNING_OS_FETCH_TIMEOUT_MS,
            timeoutMessage: 'Learning OS Study API request timed out.',
          });

      if (!upstreamResponse.ok) {
        const statusCode =
          upstreamResponse.status === 401 || upstreamResponse.status >= 500
            ? 502
            : upstreamResponse.status;
        const validationMessage =
          upstreamResponse.status === 422 && route.writeFeature === 'newQueueWrite'
            ? extractNewQueueValidationMessage(await upstreamResponse.text())
            : null;
        throw new AppError(
          validationMessage ?? 'Learning OS Study API request failed.',
          statusCode
        );
      }

      if (route.mediaResponse) {
        await streamLearningOsStudyMedia(upstreamResponse, res);
        return;
      }

      const responseBody = await upstreamResponse.text();
      let responseJson: unknown;
      try {
        responseJson = responseBody.length > 0 ? JSON.parse(responseBody) : null;
      } catch {
        throw new AppError('Learning OS Study API returned an invalid JSON response.', 502);
      }

      res
        .status(upstreamResponse.status)
        .json(adaptStudyRouteResponse(route, responseJson, upstreamPath));
    } catch (error) {
      if (res.headersSent) {
        res.destroy(error instanceof Error ? error : undefined);
        return;
      }
      next(error);
    }
  }
);

export default router;
