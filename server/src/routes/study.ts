import path from 'path';

import { TTS_VOICES } from '@languageflow/shared/src/constants-new.js';
import { STUDY_CANDIDATE_IMAGE_PROMPT_MAX_LENGTH } from '@languageflow/shared/src/studyConstants.js';
import type {
  JapanesePitchAccentResolvedBy,
  JapanesePitchAccentUnresolvedReason,
  StudyAnswerPayload,
  StudyCardCreationKind,
  StudyCardImagePlacement,
  StudyManualCardDraftCreateRequest,
  StudyManualCardDraftUpdateRequest,
  StudyCardType,
  StudyMediaRef,
  StudyPromptPayload,
  StudyVocabBundleGenerateRequest,
} from '@languageflow/shared/src/types.js';
import { Router } from 'express';

import { enqueueStudyManualCardDraftJob } from '../jobs/studyManualCardDraftQueue.js';
import { enqueueStudyVocabBundleDraftJob } from '../jobs/studyVocabBundleDraftQueue.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireFeatureFlag } from '../middleware/featureFlags.js';
import { rateLimitStudyRoute } from '../middleware/studyRateLimit.js';
import { assertStudyCardPayloadContract } from '../services/study/cardPayloadContract.js';
import {
  cardTypeForStudyCardCreationKind,
  STUDY_CARD_CREATION_KINDS,
  STUDY_CARD_IMAGE_PLACEMENTS,
} from '../services/study/shared.js';
import {
  cancelStudyImportUpload,
  completeStudyImportUpload,
  createStudyImportUploadSession,
  getCurrentStudyImportJob,
  getStudyMediaAccess,
  getStudyImportJob,
  getStudyImportUploadReadiness,
  createStudyVocabBundleDrafts,
  createManualCardDraft,
  createStudyCardFromManualDraft,
  deleteManualCardDraft,
  listManualCardDrafts,
  markManualCardDraftError,
  markManualCardDraftsForVariantGroupError,
  resetManualCardDraftForRetry,
  updateManualCardDraft,
} from '../services/studyService.js';
import { triggerWorkerJob } from '../services/workerTrigger.js';

const router = Router();
const ANSWER_AUDIO_TEXT_OVERRIDE_MAX_LENGTH = 500;
const STUDY_QUERY_PARAM_MAX_LENGTH = 200;
const MANUAL_DRAFT_ENQUEUE_ERROR_MESSAGE =
  'Could not queue draft generation. Please retry this draft.';
const VOCAB_BUNDLE_DRAFT_ENQUEUE_ERROR_MESSAGE =
  'Could not queue vocab bundle generation. Please retry these drafts.';

async function enqueueOrMarkDraftError<T>(input: {
  enqueue: () => Promise<unknown>;
  markError: () => Promise<T>;
  enqueueLogMessage: string;
  markErrorLogMessage: string;
}): Promise<{ queued: true } | { queued: false; result: T }> {
  try {
    await input.enqueue();
    return { queued: true };
  } catch (error) {
    console.error(input.enqueueLogMessage, error);
    try {
      return { queued: false, result: await input.markError() };
    } catch (markError) {
      console.error(input.markErrorLogMessage, markError);
      throw markError;
    }
  }
}

const STUDY_CARD_TYPES = new Set<StudyCardType>(['recognition', 'production', 'cloze']);
const STUDY_CARD_CANDIDATE_PREVIEW_ROLES = new Set(['prompt', 'answer']);
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
const PITCH_ACCENT_RESOLVED_BY = new Set<JapanesePitchAccentResolvedBy>([
  'single-candidate',
  'local-reading',
  'llm',
]);
const PITCH_ACCENT_UNRESOLVED_REASONS = new Set<JapanesePitchAccentUnresolvedReason>([
  'not-japanese',
  'no-expression',
  'not-found',
  'ambiguous-reading',
]);
const PITCH_ACCENT_PATTERN_MAX_LENGTH = 64;
const PITCH_ACCENT_PATTERN_NAME_MAX_LENGTH = 64;
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
  'pitchAccent',
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

  if (trimmed.length > STUDY_QUERY_PARAM_MAX_LENGTH) {
    throw new AppError(
      `${name} must be ${String(STUDY_QUERY_PARAM_MAX_LENGTH)} characters or fewer.`,
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

function parsePitchAccentPayload(value: unknown): StudyAnswerPayload['pitchAccent'] | undefined {
  if (typeof value === 'undefined') {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (!isPlainObject(value)) {
    throw new AppError('answer.pitchAccent must be an object or null.', 400);
  }

  if (value.status === 'resolved') {
    const expression = parseOptionalNullableStringField(
      'answer.pitchAccent',
      'expression',
      value.expression
    );
    const reading = parseOptionalNullableStringField(
      'answer.pitchAccent',
      'reading',
      value.reading
    );
    if (!expression || !reading) {
      throw new AppError(
        'answer.pitchAccent resolved payload requires expression and reading.',
        400
      );
    }
    if (
      typeof value.pitchNum !== 'number' ||
      !Number.isSafeInteger(value.pitchNum) ||
      value.pitchNum < 0
    ) {
      throw new AppError('answer.pitchAccent.pitchNum must be a non-negative integer.', 400);
    }
    if (value.source !== 'kanjium') {
      throw new AppError('answer.pitchAccent.source is not supported.', 400);
    }
    if (!Array.isArray(value.morae) || !value.morae.every((item) => typeof item === 'string')) {
      throw new AppError('answer.pitchAccent.morae must be an array of strings.', 400);
    }
    if (value.morae.length === 0 || value.morae.length > PITCH_ACCENT_PATTERN_MAX_LENGTH) {
      throw new AppError(
        `answer.pitchAccent.morae must contain 1-${PITCH_ACCENT_PATTERN_MAX_LENGTH.toString()} items.`,
        400
      );
    }
    if (!Array.isArray(value.pattern) || !value.pattern.every((item) => item === 0 || item === 1)) {
      throw new AppError('answer.pitchAccent.pattern must be an array of 0/1 values.', 400);
    }
    if (value.pattern.length !== value.morae.length) {
      throw new AppError('answer.pitchAccent.morae and pattern must have equal length.', 400);
    }

    if (!PITCH_ACCENT_RESOLVED_BY.has(value.resolvedBy as JapanesePitchAccentResolvedBy)) {
      throw new AppError('answer.pitchAccent.resolvedBy is not supported.', 400);
    }

    const patternName =
      parseOptionalNullableStringField('answer.pitchAccent', 'patternName', value.patternName) ??
      '';
    if (patternName.length > PITCH_ACCENT_PATTERN_NAME_MAX_LENGTH) {
      throw new AppError(
        `answer.pitchAccent.patternName must be ${PITCH_ACCENT_PATTERN_NAME_MAX_LENGTH.toString()} characters or fewer.`,
        400
      );
    }

    return {
      status: 'resolved',
      expression,
      reading,
      pitchNum: value.pitchNum,
      morae: value.morae,
      pattern: value.pattern,
      patternName,
      source: 'kanjium',
      resolvedBy: value.resolvedBy as JapanesePitchAccentResolvedBy,
    };
  }

  if (value.status === 'unresolved') {
    const expression =
      parseOptionalNullableStringField('answer.pitchAccent', 'expression', value.expression) ?? '';
    const reason = typeof value.reason === 'string' ? value.reason : '';
    if (value.source !== 'kanjium') {
      throw new AppError('answer.pitchAccent.source is not supported.', 400);
    }
    if (!PITCH_ACCENT_UNRESOLVED_REASONS.has(reason as JapanesePitchAccentUnresolvedReason)) {
      throw new AppError('answer.pitchAccent.reason is not supported.', 400);
    }

    if (
      value.resolvedBy !== 'none' &&
      !PITCH_ACCENT_RESOLVED_BY.has(value.resolvedBy as JapanesePitchAccentResolvedBy)
    ) {
      throw new AppError('answer.pitchAccent.resolvedBy is not supported.', 400);
    }

    return {
      status: 'unresolved',
      expression,
      reason: reason as JapanesePitchAccentUnresolvedReason,
      source: 'kanjium',
      resolvedBy:
        value.resolvedBy === 'none' ? 'none' : (value.resolvedBy as JapanesePitchAccentResolvedBy),
    };
  }

  throw new AppError('answer.pitchAccent.status must be resolved or unresolved.', 400);
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
    pitchAccent: parsePitchAccentPayload(value.pitchAccent),
  };
}

function parseStudyCardPayloads(
  prompt: unknown,
  answer: unknown
): { prompt: StudyPromptPayload; answer: StudyAnswerPayload } {
  const payloads = assertStudyCardPayloadContract(prompt, answer);

  return {
    prompt: parseStudyPromptPayload(payloads.prompt),
    answer: parseStudyAnswerPayload(payloads.answer),
  };
}

function parseStudyCardCreationKind(value: unknown): StudyCardCreationKind {
  if (typeof value !== 'string' || !STUDY_CARD_CREATION_KINDS.has(value as StudyCardCreationKind)) {
    throw new AppError(
      'creationKind must be text-recognition, audio-recognition, production-text, production-image, or cloze.',
      400
    );
  }

  return value as StudyCardCreationKind;
}

function parseStudyCardImagePlacement(value: unknown): StudyCardImagePlacement {
  if (typeof value === 'undefined' || value === null) {
    return 'none';
  }
  if (
    typeof value !== 'string' ||
    !STUDY_CARD_IMAGE_PLACEMENTS.has(value as StudyCardImagePlacement)
  ) {
    throw new AppError('imagePlacement must be none, prompt, answer, or both.', 400);
  }

  return value as StudyCardImagePlacement;
}

function parseStudyManualCardDraftCreateRequest(value: unknown): StudyManualCardDraftCreateRequest {
  if (!isPlainObject(value)) {
    throw new AppError('Study card draft request body must be an object.', 400);
  }

  const creationKind = parseStudyCardCreationKind(value.creationKind);
  const requestedCardType = value.cardType;
  const expectedCardType = cardTypeForStudyCardCreationKind(creationKind);
  if (
    requestedCardType !== expectedCardType ||
    !STUDY_CARD_TYPES.has(requestedCardType as StudyCardType)
  ) {
    throw new AppError('cardType must match creationKind.', 400);
  }
  const cardType = requestedCardType as StudyCardType;

  const payloads = parseStudyCardPayloads(value.prompt, value.answer);
  const imagePrompt = parseOptionalNullableStringField('draft', 'imagePrompt', value.imagePrompt);
  if (
    typeof imagePrompt === 'string' &&
    imagePrompt.length > STUDY_CANDIDATE_IMAGE_PROMPT_MAX_LENGTH
  ) {
    throw new AppError(
      `imagePrompt must be ${String(STUDY_CANDIDATE_IMAGE_PROMPT_MAX_LENGTH)} characters or fewer.`,
      400
    );
  }

  return {
    creationKind,
    cardType,
    prompt: payloads.prompt,
    answer: payloads.answer,
    imagePlacement: parseStudyCardImagePlacement(value.imagePlacement),
    imagePrompt: imagePrompt ?? null,
  };
}

function parseStudyManualCardDraftUpdateRequest(value: unknown): StudyManualCardDraftUpdateRequest {
  if (!isPlainObject(value)) {
    throw new AppError('Study card draft update body must be an object.', 400);
  }

  const request: StudyManualCardDraftUpdateRequest = {};

  if (typeof value.prompt !== 'undefined' || typeof value.answer !== 'undefined') {
    const payloads = parseStudyCardPayloads(value.prompt, value.answer);
    request.prompt = payloads.prompt;
    request.answer = payloads.answer;
  }

  if (typeof value.imagePlacement !== 'undefined') {
    request.imagePlacement = parseStudyCardImagePlacement(value.imagePlacement);
  }

  if (typeof value.imagePrompt !== 'undefined') {
    const imagePrompt = parseOptionalNullableStringField('draft', 'imagePrompt', value.imagePrompt);
    if (
      typeof imagePrompt === 'string' &&
      imagePrompt.length > STUDY_CANDIDATE_IMAGE_PROMPT_MAX_LENGTH
    ) {
      throw new AppError(
        `imagePrompt must be ${String(STUDY_CANDIDATE_IMAGE_PROMPT_MAX_LENGTH)} characters or fewer.`,
        400
      );
    }
    request.imagePrompt = imagePrompt ?? null;
  }

  if (typeof value.previewAudio !== 'undefined') {
    request.previewAudio = parseOptionalStudyMediaRef('draft', 'previewAudio', value.previewAudio);
    if (request.previewAudio?.mediaKind && request.previewAudio.mediaKind !== 'audio') {
      throw new AppError('draft.previewAudio.mediaKind must be audio.', 400);
    }
  }

  if (typeof value.previewAudioRole !== 'undefined') {
    request.previewAudioRole = parseStudyCardCandidatePreviewRole(value.previewAudioRole);
  }

  if (typeof value.previewImage !== 'undefined') {
    request.previewImage = parseOptionalStudyMediaRef('draft', 'previewImage', value.previewImage);
    if (request.previewImage?.mediaKind && request.previewImage.mediaKind !== 'image') {
      throw new AppError('draft.previewImage.mediaKind must be image.', 400);
    }
  }

  return request;
}

function parseStudyCardCandidatePreviewRole(value: unknown): 'prompt' | 'answer' | null {
  if (typeof value === 'undefined' || value === null) {
    return null;
  }
  if (typeof value !== 'string' || !STUDY_CARD_CANDIDATE_PREVIEW_ROLES.has(value)) {
    throw new AppError('previewAudioRole must be prompt or answer.', 400);
  }

  return value as 'prompt' | 'answer';
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

// Candidate routes intentionally rely on the global flashcardsEnabled gate above;
// no separate rollout flag is needed for this flashcards-only surface.
router.post(
  '/card-candidates/vocab-bundle/drafts',
  rateLimitStudyRoute({ key: 'vocab-bundle-drafts', max: 20, windowMs: 60 * 1000 }),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId) {
        throw new AppError('Authenticated user is required.', 401);
      }
      const userId = req.userId;

      const body = req.body as Partial<StudyVocabBundleGenerateRequest>;
      if (typeof body.targetWord !== 'string') {
        throw new AppError('targetWord is required.', 400);
      }
      if (
        typeof body.sourceSentence !== 'undefined' &&
        body.sourceSentence !== null &&
        typeof body.sourceSentence !== 'string'
      ) {
        throw new AppError('sourceSentence must be a string or null.', 400);
      }
      if (
        typeof body.context !== 'undefined' &&
        body.context !== null &&
        typeof body.context !== 'string'
      ) {
        throw new AppError('context must be a string or null.', 400);
      }

      const result = await createStudyVocabBundleDrafts({
        userId,
        request: {
          targetWord: body.targetWord,
          sourceSentence: body.sourceSentence ?? null,
          context: body.context ?? null,
          includeLearnerContext:
            typeof body.includeLearnerContext === 'boolean' ? body.includeLearnerContext : true,
        },
      });
      const enqueueResult = await enqueueOrMarkDraftError({
        enqueue: () => enqueueStudyVocabBundleDraftJob(result.groupId),
        markError: () =>
          markManualCardDraftsForVariantGroupError({
            userId,
            variantGroupId: result.groupId,
            errorMessage: VOCAB_BUNDLE_DRAFT_ENQUEUE_ERROR_MESSAGE,
          }),
        enqueueLogMessage: 'Failed to enqueue study vocab bundle draft job:',
        markErrorLogMessage: 'Failed to mark study vocab bundle drafts as error:',
      });
      if (enqueueResult.queued === false) {
        res.status(201).json({ ...result, drafts: enqueueResult.result });
        return;
      }
      triggerWorkerJob().catch((err) => console.error('Worker trigger failed:', err));

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/card-drafts',
  rateLimitStudyRoute({ key: 'manual-card-draft-create', max: 60, windowMs: 60 * 1000 }),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId) {
        throw new AppError('Authenticated user is required.', 401);
      }
      const userId = req.userId;

      const request = parseStudyManualCardDraftCreateRequest(req.body);
      const draft = await createManualCardDraft({
        userId,
        request,
      });
      const enqueueResult = await enqueueOrMarkDraftError({
        enqueue: () => enqueueStudyManualCardDraftJob(draft.id),
        markError: () =>
          markManualCardDraftError({
            userId,
            draftId: draft.id,
            errorMessage: MANUAL_DRAFT_ENQUEUE_ERROR_MESSAGE,
          }),
        enqueueLogMessage: 'Failed to enqueue study manual card draft job:',
        markErrorLogMessage: 'Failed to mark study manual card draft as error:',
      });
      if (enqueueResult.queued === false) {
        res.status(201).json(enqueueResult.result);
        return;
      }
      triggerWorkerJob().catch((err) => console.error('Worker trigger failed:', err));

      res.status(201).json(draft);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/card-drafts',
  rateLimitStudyRoute({ key: 'manual-card-draft-list', max: 120, windowMs: 60 * 1000 }),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId) {
        throw new AppError('Authenticated user is required.', 401);
      }

      res.json(
        await listManualCardDrafts({
          userId: req.userId,
          cursor: parseBoundedStringQueryParam('cursor', req.query.cursor),
          limit: parsePaginationLimit(req.query.limit, 200, 2000),
        })
      );
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  '/card-drafts/:draftId',
  rateLimitStudyRoute({ key: 'manual-card-draft-update', max: 120, windowMs: 60 * 1000 }),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId) {
        throw new AppError('Authenticated user is required.', 401);
      }

      const request = parseStudyManualCardDraftUpdateRequest(req.body);
      const draft = await updateManualCardDraft({
        userId: req.userId,
        draftId: req.params.draftId,
        request,
      });
      res.json(draft);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/card-drafts/:draftId/retry',
  rateLimitStudyRoute({ key: 'manual-card-draft-retry', max: 30, windowMs: 60 * 1000 }),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId) {
        throw new AppError('Authenticated user is required.', 401);
      }
      const userId = req.userId;

      const draft = await resetManualCardDraftForRetry({
        userId,
        draftId: req.params.draftId,
      });
      const enqueueResult = await enqueueOrMarkDraftError({
        enqueue: () => enqueueStudyManualCardDraftJob(draft.id),
        markError: () =>
          markManualCardDraftError({
            userId,
            draftId: draft.id,
            errorMessage: MANUAL_DRAFT_ENQUEUE_ERROR_MESSAGE,
          }),
        enqueueLogMessage: 'Failed to enqueue study manual card draft retry job:',
        markErrorLogMessage: 'Failed to mark retried study manual card draft as error:',
      });
      if (enqueueResult.queued === false) {
        res.json(enqueueResult.result);
        return;
      }
      triggerWorkerJob().catch((err) => console.error('Worker trigger failed:', err));

      res.json(draft);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/card-drafts/:draftId/create-card',
  rateLimitStudyRoute({ key: 'manual-card-draft-create-card', max: 60, windowMs: 60 * 1000 }),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId) {
        throw new AppError('Authenticated user is required.', 401);
      }

      const result = await createStudyCardFromManualDraft({
        userId: req.userId,
        draftId: req.params.draftId,
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/card-drafts/:draftId',
  rateLimitStudyRoute({ key: 'manual-card-draft-delete', max: 60, windowMs: 60 * 1000 }),
  async (req: AuthRequest, res, next) => {
    try {
      if (!req.userId) {
        throw new AppError('Authenticated user is required.', 401);
      }

      await deleteManualCardDraft({
        userId: req.userId,
        draftId: req.params.draftId,
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

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
          // Study media URLs contain the immutable media row ID. Regenerated audio creates
          // a new media row and URL, so cached `/api/study/media/:id` responses stay valid.
          'Cache-Control': 'private, max-age=15552000, immutable',
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

export default router;
