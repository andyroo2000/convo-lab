import type {
  StudyAudioSource,
  StudyCardType,
  StudyImportResult,
  StudyMediaRef,
  StudyOverview,
  StudyQueueState,
  StudyReviewEvent,
} from '@languageflow/shared/src/types.js';
import { Prisma } from '@prisma/client';

import { AppError } from '../../../middleware/errorHandler.js';

import type { JsonRecord } from './types.js';

const STUDY_CARD_TYPES: StudyCardType[] = ['recognition', 'production', 'cloze'];
const STUDY_QUEUE_STATES: StudyQueueState[] = [
  'new',
  'learning',
  'review',
  'relearning',
  'suspended',
  'buried',
];
const STUDY_AUDIO_SOURCES: StudyAudioSource[] = ['imported', 'generated', 'missing'];
const STUDY_IMPORT_STATUSES: StudyImportResult['status'][] = [
  'pending',
  'processing',
  'completed',
  'failed',
];
const STUDY_REVIEW_SOURCES: StudyReviewEvent['source'][] = ['anki_import', 'convolab'];
const STUDY_MEDIA_KINDS: StudyMediaRef['mediaKind'][] = ['audio', 'image', 'other'];
const GENERIC_STUDY_IMPORT_ERROR_MESSAGE =
  'Study import failed. Please verify the .colpkg file and try again.';
const STUDY_IMPORT_PATHLIKE_PATTERN =
  /(^|[\s:(['"])(\/|[A-Za-z]:\\|\.{1,2}[\\/]|file:\/\/|https?:\/\/)[^\s)"']+/i;

function stripNullChars(value: string): string {
  return value.replaceAll('\0', '');
}

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

function isStudyCardType(value: unknown): value is StudyCardType {
  return typeof value === 'string' && STUDY_CARD_TYPES.includes(value as StudyCardType);
}

export function parseStudyCardType(
  value: unknown,
  fallback: StudyCardType = 'recognition'
): StudyCardType {
  return isStudyCardType(value) ? value : fallback;
}

function isStudyQueueState(value: unknown): value is StudyQueueState {
  return typeof value === 'string' && STUDY_QUEUE_STATES.includes(value as StudyQueueState);
}

export function parseStudyQueueState(
  value: unknown,
  fallback: StudyQueueState = 'review'
): StudyQueueState {
  return isStudyQueueState(value) ? value : fallback;
}

function isStudyAudioSource(value: unknown): value is StudyAudioSource {
  return typeof value === 'string' && STUDY_AUDIO_SOURCES.includes(value as StudyAudioSource);
}

export function parseStudyAudioSource(
  value: unknown,
  fallback: StudyAudioSource = 'missing'
): StudyAudioSource {
  return isStudyAudioSource(value) ? value : fallback;
}

function isStudyImportStatus(value: unknown): value is StudyImportResult['status'] {
  return (
    typeof value === 'string' &&
    STUDY_IMPORT_STATUSES.includes(value as StudyImportResult['status'])
  );
}

export function parseStudyImportStatus(
  value: unknown,
  fallback: StudyImportResult['status'] = 'failed'
): StudyImportResult['status'] {
  return isStudyImportStatus(value) ? value : fallback;
}

function isStudyReviewSource(value: unknown): value is StudyReviewEvent['source'] {
  return (
    typeof value === 'string' && STUDY_REVIEW_SOURCES.includes(value as StudyReviewEvent['source'])
  );
}

export function parseStudyReviewSource(
  value: unknown,
  fallback: StudyReviewEvent['source'] = 'convolab'
): StudyReviewEvent['source'] {
  return isStudyReviewSource(value) ? value : fallback;
}

function isStudyMediaKind(value: unknown): value is StudyMediaRef['mediaKind'] {
  return (
    typeof value === 'string' && STUDY_MEDIA_KINDS.includes(value as StudyMediaRef['mediaKind'])
  );
}

export function parseStudyMediaKind(
  value: unknown,
  fallback: StudyMediaRef['mediaKind'] = 'other'
): StudyMediaRef['mediaKind'] {
  return isStudyMediaKind(value) ? value : fallback;
}

export function sanitizeText(value: string | null | undefined): string | null {
  if (value === null || typeof value === 'undefined') return null;
  return stripNullChars(value);
}

function sanitizeStudyImportErrorMessage(message: string | null | undefined): string | null {
  const sanitized = sanitizeText(message)?.trim() ?? null;
  if (!sanitized || STUDY_IMPORT_PATHLIKE_PATTERN.test(sanitized)) {
    return null;
  }

  return sanitized;
}

export function toSafeStudyImportError(error: unknown): AppError {
  if (error instanceof AppError) {
    const safeMessage =
      sanitizeStudyImportErrorMessage(error.message) ?? GENERIC_STUDY_IMPORT_ERROR_MESSAGE;
    if (error.statusCode >= 400 && error.statusCode < 500) {
      return new AppError(safeMessage, error.statusCode, error.metadata);
    }

    return new AppError(GENERIC_STUDY_IMPORT_ERROR_MESSAGE, 500);
  }

  return new AppError(GENERIC_STUDY_IMPORT_ERROR_MESSAGE, 500);
}

function sanitizeJsonValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return stripNullChars(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonValue(item));
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, sanitizeJsonValue(item)])
    );
  }

  return value;
}

export function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return sanitizeJsonValue(value) as Prisma.InputJsonValue;
}

export function toNullablePrismaJson(
  value: unknown
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (typeof value === 'undefined') return undefined;
  if (value === null) return Prisma.JsonNull;
  return sanitizeJsonValue(value) as Prisma.InputJsonValue;
}

export function toBigIntOrNull(value: number | null | undefined): bigint | null {
  return typeof value === 'number' ? BigInt(value) : null;
}

export function parseJsonRecord(raw: string): JsonRecord | null {
  if (!raw || raw === '{}') return null;
  try {
    const parsed = JSON.parse(stripNullChars(raw)) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function parseOptionalStudyOverview(value: unknown): StudyOverview | undefined {
  if (!isRecord(value)) return undefined;

  const readFiniteNumber = (candidate: unknown): number | null =>
    typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : null;
  const dueCount = readFiniteNumber(value.dueCount);
  const newCount = readFiniteNumber(value.newCount);
  const learningCount = readFiniteNumber(value.learningCount);
  const reviewCount = readFiniteNumber(value.reviewCount);
  const suspendedCount = readFiniteNumber(value.suspendedCount);
  const totalCards = readFiniteNumber(value.totalCards);
  const newCardsPerDay = readFiniteNumber(value.newCardsPerDay);
  const newCardsIntroducedToday = readFiniteNumber(value.newCardsIntroducedToday);
  const newCardsAvailableToday = readFiniteNumber(value.newCardsAvailableToday);

  if (
    dueCount === null ||
    newCount === null ||
    learningCount === null ||
    reviewCount === null ||
    suspendedCount === null ||
    totalCards === null
  ) {
    return undefined;
  }

  const nextDueAt: string | null =
    typeof value.nextDueAt === 'string' ? value.nextDueAt : value.nextDueAt === null ? null : null;

  return {
    dueCount,
    newCount,
    learningCount,
    reviewCount,
    suspendedCount,
    totalCards,
    newCardsPerDay: newCardsPerDay ?? undefined,
    newCardsIntroducedToday: newCardsIntroducedToday ?? undefined,
    newCardsAvailableToday: newCardsAvailableToday ?? undefined,
    latestImport: null,
    nextDueAt,
  };
}
