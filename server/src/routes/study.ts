import path from 'path';

import { TTS_VOICES } from '@languageflow/shared/src/constants-new.js';
import {
  STUDY_BROWSER_PAGE_SIZE_DEFAULT,
  STUDY_BROWSER_PAGE_SIZE_MAX,
  STUDY_EXPORT_PAGE_SIZE_DEFAULT,
  STUDY_EXPORT_PAGE_SIZE_MAX,
  STUDY_NEW_CARD_QUEUE_PAGE_SIZE_DEFAULT,
  STUDY_NEW_CARD_QUEUE_PAGE_SIZE_MAX,
} from '@languageflow/shared/src/studyConstants.js';
import type {
  StudyAnswerPayload,
  StudyCardType,
  StudyMediaRef,
  StudyPromptPayload,
  StudyQueueState,
} from '@languageflow/shared/src/types.js';
import { Router } from 'express';

import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireFeatureFlag } from '../middleware/featureFlags.js';
import { rateLimitStudyRoute } from '../middleware/studyRateLimit.js';
import { parseOptionalStudyOverview } from '../services/study/shared.js';
import {
  cancelStudyImportUpload,
  completeStudyImportUpload,
  createStudyCard,
  createStudyImportUploadSession,
  exportStudyData,
  exportStudyCardsSection,
  exportStudyImportsSection,
  exportStudyMediaSection,
  exportStudyReviewLogsSection,
  getStudyBrowserList,
  getStudyBrowserNoteDetail,
  getCurrentStudyImportJob,
  getStudyNewCardQueue,
  getStudyMediaAccess,
  getStudyImportJob,
  getStudyImportUploadReadiness,
  getStudyOverview,
  getStudySettings,
  performStudyCardAction,
  prepareStudyCardAnswerAudio,
  regenerateStudyCardAnswerAudio,
  recordStudyReview,
  reorderStudyNewCardQueue,
  startStudySession,
  undoStudyReview,
  updateStudySettings,
  updateStudyCard,
} from '../services/studyService.js';

const router = Router();
const MAX_STUDY_CARD_PAYLOAD_BYTES = 64 * 1024;
const MAX_STUDY_CARD_PAYLOAD_DEPTH = 8;
const MAX_STUDY_REVIEW_DURATION_MS = 60 * 60 * 1000;
const ANSWER_AUDIO_TEXT_OVERRIDE_MAX_LENGTH = 500;
const STUDY_BROWSER_QUERY_MAX_LENGTH = 200;
const STUDY_CURSOR_QUERY_MAX_LENGTH = 1000;
const MAX_STUDY_SET_DUE_FUTURE_YEARS = 10;

function isValidIanaTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}
const STUDY_CARD_TYPES = new Set<StudyCardType>(['recognition', 'production', 'cloze']);
const STUDY_QUEUE_STATES = new Set<StudyQueueState>([
  'new',
  'learning',
  'review',
  'relearning',
  'suspended',
  'buried',
]);
const STUDY_IMPORT_MIME_TYPES = new Set([
  '',
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream',
  'multipart/x-zip',
]);
const STUDY_MEDIA_KINDS = new Set<StudyMediaRef['mediaKind']>(['audio', 'image', 'other']);
const STUDY_MEDIA_SOURCES = new Set<StudyMediaRef['source']>([
  'imported',
  'generated',
  'missing',
  'imported_image',
  'imported_other',
]);
const STUDY_MEDIA_REF_ALLOWED_KEYS = new Set(['id', 'filename', 'url', 'mediaKind', 'source']);
const STUDY_PROMPT_ALLOWED_KEYS = new Set([
  'cueText',
  'cueReading',
  'cueMeaning',
  'cueAudio',
  'cueImage',
  'clozeText',
  'clozeDisplayText',
  'clozeAnswerText',
  'clozeHint',
  'clozeResolvedHint',
]);
const STUDY_ANSWER_ALLOWED_KEYS = new Set([
  'expression',
  'expressionReading',
  'meaning',
  'notes',
  'sentenceJp',
  'sentenceJpKana',
  'sentenceEn',
  'restoredText',
  'restoredTextReading',
  'answerAudioVoiceId',
  'answerAudioTextOverride',
  'answerAudio',
  'answerImage',
]);
// Study card TTS is Japanese-only until card language becomes a first-class setting.
// Keep this route validation in sync with the form voice picker when multi-language cards arrive.
// This module-load whitelist intentionally updates on deploy/server restart with shared constants.
const STUDY_JA_TTS_VOICE_IDS = new Set<string>(TTS_VOICES.ja.voices.map((voice) => voice.id));
function parsePositiveIntegerQueryParam(name: string, value: unknown): number | undefined {
  if (typeof value === 'undefined') {
    return undefined;
  }

  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new AppError(`${name} must be a positive integer.`, 400);
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new AppError(`${name} must be a positive integer.`, 400);
  }

  return parsed;
}

function parseStudyImportCreateRequest(body: unknown): {
  filename: string;
  contentType?: string;
} {
  if (!isPlainObject(body)) {
    throw new AppError('Study import request body must be an object.', 400);
  }

  const { filename, contentType } = body;
  if (typeof filename !== 'string' || filename.trim().length === 0) {
    throw new AppError('filename is required.', 400);
  }
  if (!filename.trim().toLowerCase().endsWith('.colpkg')) {
    throw new AppError('Only .colpkg Anki collection backups are accepted.', 400);
  }

  if (typeof contentType !== 'undefined' && typeof contentType !== 'string') {
    throw new AppError('contentType must be a string when provided.', 400);
  }

  const normalizedContentType = typeof contentType === 'string' ? contentType.toLowerCase() : '';
  if (typeof contentType === 'string' && !STUDY_IMPORT_MIME_TYPES.has(normalizedContentType)) {
    throw new AppError('Only .colpkg Anki collection backups are accepted.', 400);
  }

  return {
    filename: filename.trim(),
    contentType: typeof contentType === 'string' ? normalizedContentType : undefined,
  };
}

function parsePaginationLimit(value: unknown, defaultSize: number, maxSize: number): number {
  if (typeof value === 'undefined') {
    return defaultSize;
  }

  const parsed = parsePositiveIntegerQueryParam('limit', value);
  if (typeof parsed === 'undefined') {
    return defaultSize;
  }

  if (parsed > maxSize) {
    throw new AppError(`limit must be ${String(maxSize)} or fewer.`, 400);
  }

  return parsed;
}

function parseOptionalTimeZone(value: unknown): string | undefined {
  if (typeof value === 'undefined') {
    return undefined;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppError('timeZone must be a valid IANA timezone.', 400);
  }

  const trimmed = value.trim();
  if (!isValidIanaTimeZone(trimmed)) {
    throw new AppError('timeZone must be a valid IANA timezone.', 400);
  }

  return trimmed;
}

function parseBoundedStringQueryParam(name: string, value: unknown): string | undefined {
  if (typeof value === 'undefined') {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new AppError(`${name} must be a string.`, 400);
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  if (trimmed.length > STUDY_BROWSER_QUERY_MAX_LENGTH) {
    throw new AppError(
      `${name} must be ${String(STUDY_BROWSER_QUERY_MAX_LENGTH)} characters or fewer.`,
      400
    );
  }

  return trimmed;
}

function sanitizeDownloadFilename(filename: string): string {
  const basename = path.basename(filename);
  const sanitized = basename.replace(/[^A-Za-z0-9._-]/g, '_');
  return sanitized.length > 0 ? sanitized : 'study-media';
}

function toSafeContentDisposition(
  contentDisposition: 'inline' | 'attachment',
  filename: string
): string {
  const disposition = contentDisposition === 'attachment' ? 'attachment' : 'inline';
  return `${disposition}; filename="${sanitizeDownloadFilename(filename)}"`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertKnownKeys(label: string, value: Record<string, unknown>, allowedKeys: Set<string>) {
  const unexpectedKeys = Object.keys(value).filter((key) => !allowedKeys.has(key));
  if (unexpectedKeys.length > 0) {
    throw new AppError(`${label} contains unsupported field "${unexpectedKeys[0]}".`, 400);
  }
}

function parseOptionalNullableStringField(
  label: string,
  fieldName: string,
  value: unknown
): string | null | undefined {
  if (typeof value === 'undefined') {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  throw new AppError(`${label}.${fieldName} must be a string or null.`, 400);
}

function parseOptionalAnswerAudioVoiceId(value: unknown): string | null | undefined {
  const voiceId = parseOptionalNullableStringField('answer', 'answerAudioVoiceId', value);
  if (typeof voiceId === 'string' && !STUDY_JA_TTS_VOICE_IDS.has(voiceId)) {
    throw new AppError('answer.answerAudioVoiceId must be a known TTS voice ID.', 400);
  }

  return voiceId;
}

function parseOptionalAnswerAudioTextOverride(value: unknown): string | null | undefined {
  const text = parseOptionalNullableStringField('answer', 'answerAudioTextOverride', value);
  if (typeof text === 'string' && text.length > ANSWER_AUDIO_TEXT_OVERRIDE_MAX_LENGTH) {
    throw new AppError(
      `answer.answerAudioTextOverride must be ${ANSWER_AUDIO_TEXT_OVERRIDE_MAX_LENGTH} characters or fewer.`,
      400
    );
  }

  return text;
}

function parseOptionalStudyMediaRef(
  label: string,
  fieldName: string,
  value: unknown
): StudyMediaRef | null | undefined {
  if (typeof value === 'undefined') {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (!isPlainObject(value)) {
    throw new AppError(`${label}.${fieldName} must be a media reference object or null.`, 400);
  }

  assertKnownKeys(`${label}.${fieldName}`, value, STUDY_MEDIA_REF_ALLOWED_KEYS);

  if (typeof value.filename !== 'string' || value.filename.trim().length === 0) {
    throw new AppError(`${label}.${fieldName}.filename is required.`, 400);
  }

  if (
    typeof value.mediaKind !== 'string' ||
    !STUDY_MEDIA_KINDS.has(value.mediaKind as StudyMediaRef['mediaKind'])
  ) {
    throw new AppError(`${label}.${fieldName}.mediaKind must be audio, image, or other.`, 400);
  }

  if (
    typeof value.source !== 'string' ||
    !STUDY_MEDIA_SOURCES.has(value.source as StudyMediaRef['source'])
  ) {
    throw new AppError(
      `${label}.${fieldName}.source must be imported, generated, missing, imported_image, or imported_other.`,
      400
    );
  }

  const id = parseOptionalNullableStringField(`${label}.${fieldName}`, 'id', value.id);
  const url = parseOptionalNullableStringField(`${label}.${fieldName}`, 'url', value.url);

  return {
    ...(typeof id !== 'undefined' ? { id: id ?? undefined } : {}),
    filename: value.filename,
    ...(typeof url !== 'undefined' ? { url } : {}),
    mediaKind: value.mediaKind as StudyMediaRef['mediaKind'],
    source: value.source as StudyMediaRef['source'],
  };
}

function parseStudyPromptPayload(value: Record<string, unknown>): StudyPromptPayload {
  assertKnownKeys('prompt', value, STUDY_PROMPT_ALLOWED_KEYS);

  return {
    cueText: parseOptionalNullableStringField('prompt', 'cueText', value.cueText),
    cueReading: parseOptionalNullableStringField('prompt', 'cueReading', value.cueReading),
    cueMeaning: parseOptionalNullableStringField('prompt', 'cueMeaning', value.cueMeaning),
    cueAudio: parseOptionalStudyMediaRef('prompt', 'cueAudio', value.cueAudio),
    cueImage: parseOptionalStudyMediaRef('prompt', 'cueImage', value.cueImage),
    clozeText: parseOptionalNullableStringField('prompt', 'clozeText', value.clozeText),
    clozeDisplayText: parseOptionalNullableStringField(
      'prompt',
      'clozeDisplayText',
      value.clozeDisplayText
    ),
    clozeAnswerText: parseOptionalNullableStringField(
      'prompt',
      'clozeAnswerText',
      value.clozeAnswerText
    ),
    clozeHint: parseOptionalNullableStringField('prompt', 'clozeHint', value.clozeHint),
    clozeResolvedHint: parseOptionalNullableStringField(
      'prompt',
      'clozeResolvedHint',
      value.clozeResolvedHint
    ),
  };
}

function parseStudyAnswerPayload(value: Record<string, unknown>): StudyAnswerPayload {
  assertKnownKeys('answer', value, STUDY_ANSWER_ALLOWED_KEYS);

  return {
    expression: parseOptionalNullableStringField('answer', 'expression', value.expression),
    expressionReading: parseOptionalNullableStringField(
      'answer',
      'expressionReading',
      value.expressionReading
    ),
    meaning: parseOptionalNullableStringField('answer', 'meaning', value.meaning),
    notes: parseOptionalNullableStringField('answer', 'notes', value.notes),
    sentenceJp: parseOptionalNullableStringField('answer', 'sentenceJp', value.sentenceJp),
    sentenceJpKana: parseOptionalNullableStringField(
      'answer',
      'sentenceJpKana',
      value.sentenceJpKana
    ),
    sentenceEn: parseOptionalNullableStringField('answer', 'sentenceEn', value.sentenceEn),
    restoredText: parseOptionalNullableStringField('answer', 'restoredText', value.restoredText),
    restoredTextReading: parseOptionalNullableStringField(
      'answer',
      'restoredTextReading',
      value.restoredTextReading
    ),
    answerAudioVoiceId: parseOptionalAnswerAudioVoiceId(value.answerAudioVoiceId),
    answerAudioTextOverride: parseOptionalAnswerAudioTextOverride(value.answerAudioTextOverride),
    answerAudio: parseOptionalStudyMediaRef('answer', 'answerAudio', value.answerAudio),
    answerImage: parseOptionalStudyMediaRef('answer', 'answerImage', value.answerImage),
  };
}

function parseCursorQueryParam(name: string, value: unknown): string | undefined {
  if (typeof value === 'undefined') {
    return undefined;
  }

  if (typeof value !== 'string' || value.length === 0) {
    throw new AppError(`${name} must be a non-empty string.`, 400);
  }

  if (value.length > STUDY_CURSOR_QUERY_MAX_LENGTH) {
    throw new AppError(
      `${name} must be ${String(STUDY_CURSOR_QUERY_MAX_LENGTH)} characters or fewer.`,
      400
    );
  }

  return value;
}

function isStrictIsoDateTime(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value);
}

function exceedsMaxJsonDepth(
  value: unknown,
  maxDepth: number,
  currentDepth: number = 1,
  seen: WeakSet<object> = new WeakSet()
): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  if (currentDepth > maxDepth) {
    return true;
  }

  if (seen.has(value)) {
    return false;
  }

  seen.add(value);
  const children = Array.isArray(value) ? value : Object.values(value);
  return children.some((child) => exceedsMaxJsonDepth(child, maxDepth, currentDepth + 1, seen));
}

function parseStudyCardPayloads(
  prompt: unknown,
  answer: unknown
): { prompt: StudyPromptPayload; answer: StudyAnswerPayload } {
  if (!isPlainObject(prompt) || !isPlainObject(answer)) {
    throw new AppError('prompt and answer payloads are required.', 400);
  }

  if (
    exceedsMaxJsonDepth(prompt, MAX_STUDY_CARD_PAYLOAD_DEPTH) ||
    exceedsMaxJsonDepth(answer, MAX_STUDY_CARD_PAYLOAD_DEPTH)
  ) {
    throw new AppError(
      `Study card payloads must be ${String(MAX_STUDY_CARD_PAYLOAD_DEPTH)} levels deep or fewer.`,
      400
    );
  }

  const serializedPayload = JSON.stringify({ prompt, answer });
  if (
    typeof serializedPayload !== 'string' ||
    Buffer.byteLength(serializedPayload, 'utf8') > MAX_STUDY_CARD_PAYLOAD_BYTES
  ) {
    throw new AppError(
      `Study card payloads must be ${String(Math.floor(MAX_STUDY_CARD_PAYLOAD_BYTES / 1024))} KB or smaller.`,
      400
    );
  }

  return {
    prompt: parseStudyPromptPayload(prompt),
    answer: parseStudyAnswerPayload(answer),
  };
}

function parseStudyReviewDurationMs(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.max(0, Math.min(MAX_STUDY_REVIEW_DURATION_MS, Math.trunc(value)));
}

router.use(requireAuth);
router.use(requireFeatureFlag('flashcardsEnabled'));

router.post(
  '/imports',
  rateLimitStudyRoute({
    key: 'import',
    max: 3,
    windowMs: 10 * 60 * 1000,
    onBackendError: 'fail-closed',
  }),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId) {
        throw new AppError('Authenticated user is required.', 401);
      }
      const request = parseStudyImportCreateRequest(req.body);
      const result = await createStudyImportUploadSession({
        userId: req.userId,
        filename: request.filename,
        contentType: request.contentType,
      });

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.get('/imports/readiness', async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) {
      throw new AppError('Authenticated user is required.', 401);
    }

    const result = await getStudyImportUploadReadiness();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/imports/current', async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) {
      throw new AppError('Authenticated user is required.', 401);
    }

    const result = await getCurrentStudyImportJob(req.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post(
  '/imports/:id/complete',
  rateLimitStudyRoute({
    key: 'import-complete',
    max: 10,
    windowMs: 10 * 60 * 1000,
    onBackendError: 'fail-closed',
  }),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId) {
        throw new AppError('Authenticated user is required.', 401);
      }

      const result = await completeStudyImportUpload({
        userId: req.userId,
        importJobId: req.params.id,
      });

      res
        .status(result.status === 'pending' || result.status === 'processing' ? 202 : 200)
        .json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/imports/:id/cancel',
  rateLimitStudyRoute({
    key: 'import-cancel',
    max: 20,
    windowMs: 60 * 1000,
    onBackendError: 'fail-closed',
  }),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId) {
        throw new AppError('Authenticated user is required.', 401);
      }

      const result = await cancelStudyImportUpload({
        userId: req.userId,
        importJobId: req.params.id,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.get('/imports/:id', async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) {
      throw new AppError('Authenticated user is required.', 401);
    }
    const result = await getStudyImportJob(req.userId, req.params.id);
    if (!result) {
      res.status(404).json({ message: 'Study import not found.' });
      return;
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/overview', async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) {
      throw new AppError('Authenticated user is required.', 401);
    }
    const overview = await getStudyOverview(req.userId, parseOptionalTimeZone(req.query.timeZone));
    res.json(overview);
  } catch (error) {
    next(error);
  }
});

router.get(
  '/settings',
  rateLimitStudyRoute({ key: 'settings-read', max: 120, windowMs: 60 * 1000 }),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId) {
        throw new AppError('Authenticated user is required.', 401);
      }

      res.json(await getStudySettings(req.userId));
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  '/settings',
  rateLimitStudyRoute({ key: 'settings', max: 60, windowMs: 60 * 1000 }),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId) {
        throw new AppError('Authenticated user is required.', 401);
      }

      const { newCardsPerDay } = req.body as { newCardsPerDay?: unknown };
      res.json(
        await updateStudySettings({
          userId: req.userId,
          newCardsPerDay,
        })
      );
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/new-queue',
  rateLimitStudyRoute({ key: 'new-queue', max: 120, windowMs: 60 * 1000 }),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId) {
        throw new AppError('Authenticated user is required.', 401);
      }

      res.json(
        await getStudyNewCardQueue({
          userId: req.userId,
          cursor: parseBoundedStringQueryParam('cursor', req.query.cursor),
          limit: parsePaginationLimit(
            req.query.limit,
            STUDY_NEW_CARD_QUEUE_PAGE_SIZE_DEFAULT,
            STUDY_NEW_CARD_QUEUE_PAGE_SIZE_MAX
          ),
          q: parseBoundedStringQueryParam('q', req.query.q),
        })
      );
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/new-queue/reorder',
  rateLimitStudyRoute({ key: 'new-queue-reorder', max: 60, windowMs: 60 * 1000 }),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId) {
        throw new AppError('Authenticated user is required.', 401);
      }

      const { cardIds } = req.body as { cardIds?: unknown };
      if (
        !Array.isArray(cardIds) ||
        cardIds.some((cardId) => typeof cardId !== 'string' || cardId.length === 0)
      ) {
        res.status(400).json({ message: 'cardIds must be a non-empty array of card ids.' });
        return;
      }

      res.json(await reorderStudyNewCardQueue({ userId: req.userId, cardIds }));
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/session/start',
  rateLimitStudyRoute({ key: 'session-start', max: 30, windowMs: 60 * 1000 }),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId) {
        throw new AppError('Authenticated user is required.', 401);
      }
      const session = await startStudySession(req.userId, {
        timeZone: parseOptionalTimeZone((req.body as { timeZone?: unknown } | undefined)?.timeZone),
      });
      res.json(session);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/reviews',
  rateLimitStudyRoute({ key: 'reviews', max: 120, windowMs: 60 * 1000 }),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId) {
        throw new AppError('Authenticated user is required.', 401);
      }

      const { cardId, grade, durationMs, timeZone } = req.body as {
        cardId?: unknown;
        grade?: unknown;
        durationMs?: unknown;
        timeZone?: unknown;
      };

      if (typeof cardId !== 'string' || !cardId) {
        res.status(400).json({ message: 'cardId is required.' });
        return;
      }
      if (!['again', 'hard', 'good', 'easy'].includes(String(grade))) {
        res.status(400).json({ message: 'grade must be again, hard, good, or easy.' });
        return;
      }

      const reviewResult = await recordStudyReview({
        userId: req.userId,
        cardId,
        grade: grade as 'again' | 'hard' | 'good' | 'easy',
        durationMs: parseStudyReviewDurationMs(durationMs),
        timeZone: parseOptionalTimeZone(timeZone),
        currentOverview: parseOptionalStudyOverview(
          (req.body as { currentOverview?: unknown }).currentOverview
        ),
      });

      res.json(reviewResult);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/reviews/undo',
  rateLimitStudyRoute({ key: 'review-undo', max: 120, windowMs: 60 * 1000 }),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId) {
        throw new AppError('Authenticated user is required.', 401);
      }

      const { reviewLogId, timeZone } = req.body as {
        reviewLogId?: unknown;
        timeZone?: unknown;
      };

      if (typeof reviewLogId !== 'string' || !reviewLogId) {
        res.status(400).json({ message: 'reviewLogId is required.' });
        return;
      }

      const undoResult = await undoStudyReview({
        userId: req.userId,
        reviewLogId,
        timeZone: parseOptionalTimeZone(timeZone),
        currentOverview: parseOptionalStudyOverview(
          (req.body as { currentOverview?: unknown }).currentOverview
        ),
      });

      res.json(undoResult);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/cards',
  rateLimitStudyRoute({ key: 'card-create', max: 120, windowMs: 60 * 1000 }),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId) {
        throw new AppError('Authenticated user is required.', 401);
      }

      const { cardType, prompt, answer } = req.body as {
        cardType?: unknown;
        prompt?: unknown;
        answer?: unknown;
      };

      if (!['recognition', 'production', 'cloze'].includes(String(cardType))) {
        res.status(400).json({ message: 'cardType must be recognition, production, or cloze.' });
        return;
      }

      const payloads = parseStudyCardPayloads(prompt, answer);

      const createdCard = await createStudyCard({
        userId: req.userId,
        cardType: cardType as StudyCardType,
        prompt: payloads.prompt,
        answer: payloads.answer,
      });

      res.status(201).json(createdCard);
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  '/cards/:cardId',
  rateLimitStudyRoute({ key: 'card-update', max: 120, windowMs: 60 * 1000 }),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId) {
        throw new AppError('Authenticated user is required.', 401);
      }

      const { prompt, answer } = req.body as {
        prompt?: unknown;
        answer?: unknown;
      };

      if (!req.params.cardId) {
        res.status(400).json({ message: 'cardId is required.' });
        return;
      }

      const payloads = parseStudyCardPayloads(prompt, answer);

      const updatedCard = await updateStudyCard({
        userId: req.userId,
        cardId: req.params.cardId,
        prompt: payloads.prompt,
        answer: payloads.answer,
      });

      res.json(updatedCard);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/cards/:cardId/actions',
  rateLimitStudyRoute({ key: 'card-action', max: 120, windowMs: 60 * 1000 }),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId) {
        throw new AppError('Authenticated user is required.', 401);
      }

      const { action, mode, dueAt, timeZone } = req.body as {
        action?: unknown;
        mode?: unknown;
        dueAt?: unknown;
        timeZone?: unknown;
      };

      if (!req.params.cardId) {
        res.status(400).json({ message: 'cardId is required.' });
        return;
      }

      if (!['suspend', 'unsuspend', 'forget', 'set_due'].includes(String(action))) {
        res.status(400).json({ message: 'action must be suspend, unsuspend, forget, or set_due.' });
        return;
      }

      if (action === 'set_due') {
        if (!['now', 'tomorrow', 'custom_date'].includes(String(mode))) {
          res
            .status(400)
            .json({ message: 'mode must be now, tomorrow, or custom_date for set_due.' });
          return;
        }

        if (
          mode === 'custom_date' &&
          (typeof dueAt !== 'string' ||
            !isStrictIsoDateTime(dueAt) ||
            Number.isNaN(Date.parse(dueAt)))
        ) {
          res
            .status(400)
            .json({ message: 'dueAt must be a valid ISO-8601 datetime for custom_date.' });
          return;
        }

        if (typeof dueAt === 'string') {
          const dueAtMs = Date.parse(dueAt);
          const maxDueAt = new Date();
          maxDueAt.setFullYear(maxDueAt.getFullYear() + MAX_STUDY_SET_DUE_FUTURE_YEARS);
          if (dueAtMs > maxDueAt.getTime()) {
            res.status(400).json({
              message: `dueAt must be within ${String(MAX_STUDY_SET_DUE_FUTURE_YEARS)} years.`,
            });
            return;
          }
        }

        if (typeof dueAt !== 'undefined' && typeof dueAt !== 'string') {
          res
            .status(400)
            .json({ message: 'dueAt must be a valid ISO-8601 datetime for custom_date.' });
          return;
        }

        if (
          mode === 'tomorrow' &&
          (typeof timeZone !== 'string' || !isValidIanaTimeZone(timeZone))
        ) {
          res.status(400).json({ message: 'timeZone must be a valid IANA timezone for tomorrow.' });
          return;
        }
      }

      const result = await performStudyCardAction({
        userId: req.userId,
        cardId: req.params.cardId,
        action: action as 'suspend' | 'unsuspend' | 'forget' | 'set_due',
        mode: mode as 'now' | 'tomorrow' | 'custom_date' | undefined,
        dueAt: typeof dueAt === 'string' ? dueAt : undefined,
        timeZone: typeof timeZone === 'string' ? timeZone : undefined,
        currentOverview: parseOptionalStudyOverview(
          (req.body as { currentOverview?: unknown }).currentOverview
        ),
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/cards/:cardId/prepare-answer-audio',
  rateLimitStudyRoute({ key: 'prepare-answer-audio', max: 30, windowMs: 60 * 1000 }),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId) {
        throw new AppError('Authenticated user is required.', 401);
      }

      if (!req.params.cardId) {
        res.status(400).json({ message: 'cardId is required.' });
        return;
      }

      const card = await prepareStudyCardAnswerAudio(req.userId, req.params.cardId);
      res.json(card);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/cards/:cardId/regenerate-answer-audio',
  rateLimitStudyRoute({ key: 'regenerate-answer-audio', max: 30, windowMs: 60 * 1000 }),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId) {
        throw new AppError('Authenticated user is required.', 401);
      }

      const body = isPlainObject(req.body) ? req.body : {};
      const answerAudioVoiceId = parseOptionalAnswerAudioVoiceId(body.answerAudioVoiceId);
      const answerAudioTextOverride = parseOptionalAnswerAudioTextOverride(
        body.answerAudioTextOverride
      );

      const card = await regenerateStudyCardAnswerAudio({
        userId: req.userId,
        cardId: req.params.cardId,
        answerAudioVoiceId,
        answerAudioTextOverride,
      });
      res.json(card);
    } catch (error) {
      next(error);
    }
  }
);

router.get('/browser', async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) {
      throw new AppError('Authenticated user is required.', 401);
    }

    const q = parseBoundedStringQueryParam('q', req.query.q);
    const noteType = parseBoundedStringQueryParam('noteType', req.query.noteType);
    const cursor = parseCursorQueryParam('cursor', req.query.cursor);
    const limit = parsePaginationLimit(
      req.query.limit,
      STUDY_BROWSER_PAGE_SIZE_DEFAULT,
      STUDY_BROWSER_PAGE_SIZE_MAX
    );

    const cardType =
      typeof req.query.cardType === 'undefined' ? undefined : String(req.query.cardType);
    if (typeof cardType !== 'undefined' && !STUDY_CARD_TYPES.has(cardType as StudyCardType)) {
      throw new AppError('cardType must be recognition, production, or cloze.', 400);
    }

    const queueState =
      typeof req.query.queueState === 'undefined' ? undefined : String(req.query.queueState);
    if (
      typeof queueState !== 'undefined' &&
      !STUDY_QUEUE_STATES.has(queueState as StudyQueueState)
    ) {
      throw new AppError(
        'queueState must be new, learning, review, relearning, suspended, or buried.',
        400
      );
    }

    const result = await getStudyBrowserList({
      userId: req.userId,
      q,
      noteType,
      cardType: cardType as StudyCardType | undefined,
      queueState: queueState as StudyQueueState | undefined,
      cursor,
      limit,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/browser/:noteId', async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) {
      throw new AppError('Authenticated user is required.', 401);
    }

    const result = await getStudyBrowserNoteDetail(req.userId, req.params.noteId);
    if (!result) {
      res.status(404).json({ message: 'Study note not found.' });
      return;
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get(
  '/media/:mediaId',
  rateLimitStudyRoute({ key: 'media-read', max: 240, windowMs: 60 * 1000 }),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId) {
        throw new AppError('Authenticated user is required.', 401);
      }

      const mediaAccess = await getStudyMediaAccess(req.userId, req.params.mediaId);
      if (!mediaAccess) {
        throw new AppError('Study media not found.', 404);
      }

      if (mediaAccess.type === 'redirect') {
        res.redirect(302, mediaAccess.redirectUrl as string);
        return;
      }

      res.type(mediaAccess.contentType);
      res.sendFile(mediaAccess.absolutePath as string, {
        headers: {
          'Cache-Control': 'private, max-age=60',
          'Content-Disposition': toSafeContentDisposition(
            mediaAccess.contentDisposition,
            mediaAccess.filename
          ),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/export', async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) {
      throw new AppError('Authenticated user is required.', 401);
    }
    const manifest = await exportStudyData(req.userId);
    res.json(manifest);
  } catch (error) {
    next(error);
  }
});

router.get('/export/cards', async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) {
      throw new AppError('Authenticated user is required.', 401);
    }

    const result = await exportStudyCardsSection({
      userId: req.userId,
      cursor: parseCursorQueryParam('cursor', req.query.cursor),
      limit: parsePaginationLimit(
        req.query.limit,
        STUDY_EXPORT_PAGE_SIZE_DEFAULT,
        STUDY_EXPORT_PAGE_SIZE_MAX
      ),
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/export/review-logs', async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) {
      throw new AppError('Authenticated user is required.', 401);
    }

    const result = await exportStudyReviewLogsSection({
      userId: req.userId,
      cursor: parseCursorQueryParam('cursor', req.query.cursor),
      limit: parsePaginationLimit(
        req.query.limit,
        STUDY_EXPORT_PAGE_SIZE_DEFAULT,
        STUDY_EXPORT_PAGE_SIZE_MAX
      ),
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/export/media', async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) {
      throw new AppError('Authenticated user is required.', 401);
    }

    const result = await exportStudyMediaSection({
      userId: req.userId,
      cursor: parseCursorQueryParam('cursor', req.query.cursor),
      limit: parsePaginationLimit(
        req.query.limit,
        STUDY_EXPORT_PAGE_SIZE_DEFAULT,
        STUDY_EXPORT_PAGE_SIZE_MAX
      ),
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/export/imports', async (req: AuthRequest, res, next) => {
  try {
    if (!req.userId) {
      throw new AppError('Authenticated user is required.', 401);
    }

    const result = await exportStudyImportsSection({
      userId: req.userId,
      cursor: parseCursorQueryParam('cursor', req.query.cursor),
      limit: parsePaginationLimit(
        req.query.limit,
        STUDY_EXPORT_PAGE_SIZE_DEFAULT,
        STUDY_EXPORT_PAGE_SIZE_MAX
      ),
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
