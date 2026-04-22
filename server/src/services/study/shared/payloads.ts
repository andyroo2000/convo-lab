import {
  deserializeStudyFsrsCard as deserializeFsrsCard,
  serializeStudyFsrsCard as serializeFsrsCard,
} from '@languageflow/shared/src/studyFsrs.js';
import type { StudyFsrsState, StudyImportPreview } from '@languageflow/shared/src/types.js';
import { Prisma } from '@prisma/client';

import {
  ANKI_DECK_NAME,
  STUDY_IMPORT_WARNING_LIMIT,
  STUDY_REVIEW_RAW_PAYLOAD_MAX_BYTES,
} from './constants.js';
import { isRecord, parseStudyReviewSource } from './guards.js';
import type { JsonRecord, StudyImportWarningAccumulator, StudyReviewLogRecord } from './types.js';

export function toBoundedReviewRawPayload(
  payload: JsonRecord,
  fallback: JsonRecord
): Prisma.InputJsonValue {
  const serialized = JSON.stringify(payload);
  if (Buffer.byteLength(serialized, 'utf8') <= STUDY_REVIEW_RAW_PAYLOAD_MAX_BYTES) {
    return payload as Prisma.InputJsonValue;
  }

  return {
    ...fallback,
    truncated: true,
  } as Prisma.InputJsonValue;
}

export function toImportReviewRawPayload(log: {
  sourceReviewId: number;
  sourceCardId: number;
  sourceEase: number;
  sourceInterval: number;
  sourceLastInterval: number;
  sourceFactor: number;
  sourceTimeMs: number;
  sourceReviewType: number;
}): Prisma.InputJsonValue {
  const payload = {
    reviewId: log.sourceReviewId,
    cardId: log.sourceCardId,
    ease: log.sourceEase,
    ivl: log.sourceInterval,
    lastIvl: log.sourceLastInterval,
    factor: log.sourceFactor,
    time: log.sourceTimeMs,
    type: log.sourceReviewType,
  };

  return toBoundedReviewRawPayload(payload, {
    reviewId: log.sourceReviewId,
    cardId: log.sourceCardId,
  });
}

export function toConvolabReviewRawPayload(params: {
  grade: string;
  beforeQueueState: string;
  beforeDueAt: string | null;
  beforeLastReviewedAt: string | null;
}): Prisma.InputJsonValue {
  const payload = {
    grade: params.grade,
    beforeQueueState: params.beforeQueueState,
    beforeDueAt: params.beforeDueAt,
    beforeLastReviewedAt: params.beforeLastReviewedAt,
  };

  return toBoundedReviewRawPayload(payload, {
    grade: params.grade,
    beforeQueueState: params.beforeQueueState,
  });
}

export function toStudyImportPreview(
  value: Prisma.JsonValue | null | undefined
): StudyImportPreview {
  const fallback: StudyImportPreview = {
    deckName: ANKI_DECK_NAME,
    cardCount: 0,
    noteCount: 0,
    reviewLogCount: 0,
    mediaReferenceCount: 0,
    skippedMediaCount: 0,
    warnings: [],
    noteTypeBreakdown: [],
  };

  if (!isRecord(value)) {
    return fallback;
  }

  return {
    deckName: typeof value.deckName === 'string' ? value.deckName : fallback.deckName,
    cardCount: typeof value.cardCount === 'number' ? value.cardCount : fallback.cardCount,
    noteCount: typeof value.noteCount === 'number' ? value.noteCount : fallback.noteCount,
    reviewLogCount:
      typeof value.reviewLogCount === 'number' ? value.reviewLogCount : fallback.reviewLogCount,
    mediaReferenceCount:
      typeof value.mediaReferenceCount === 'number'
        ? value.mediaReferenceCount
        : fallback.mediaReferenceCount,
    skippedMediaCount:
      typeof value.skippedMediaCount === 'number'
        ? value.skippedMediaCount
        : fallback.skippedMediaCount,
    warnings: Array.isArray(value.warnings)
      ? value.warnings.flatMap((item) => (typeof item === 'string' ? [item] : []))
      : fallback.warnings,
    noteTypeBreakdown: Array.isArray(value.noteTypeBreakdown)
      ? value.noteTypeBreakdown.flatMap((item) => {
          if (!isRecord(item) || typeof item.notetypeName !== 'string') {
            return [];
          }

          return [
            {
              notetypeName: item.notetypeName,
              noteCount: typeof item.noteCount === 'number' ? item.noteCount : 0,
              cardCount: typeof item.cardCount === 'number' ? item.cardCount : 0,
            },
          ];
        })
      : fallback.noteTypeBreakdown,
  };
}

export function createStudyImportWarningAccumulator(): StudyImportWarningAccumulator {
  return {
    skippedMediaCount: 0,
    warnings: [],
  };
}

export function recordStudyImportWarning(
  accumulator: StudyImportWarningAccumulator,
  filename: string,
  reason: string,
  options?: {
    countsAsSkippedMedia?: boolean;
  }
) {
  if (options?.countsAsSkippedMedia ?? true) {
    accumulator.skippedMediaCount += 1;
  }

  if (accumulator.warnings.length >= STUDY_IMPORT_WARNING_LIMIT) {
    return;
  }

  accumulator.warnings.push(`${filename}: ${reason}`);
}

export function toStudyFsrsState(
  value: Prisma.JsonValue | null | undefined
): StudyFsrsState | null {
  const state = deserializeFsrsCard(isRecord(value) ? value : null);
  return state ? serializeFsrsCard(state) : null;
}

export function toStudyReviewEvent(log: StudyReviewLogRecord) {
  return {
    id: log.id,
    cardId: log.cardId,
    source: parseStudyReviewSource(log.source),
    reviewedAt: log.reviewedAt.toISOString(),
    rating: log.rating,
    durationMs: typeof log.durationMs === 'number' ? log.durationMs : null,
    sourceReviewId: typeof log.sourceReviewId === 'bigint' ? String(log.sourceReviewId) : null,
    stateBefore: toStudyFsrsState(log.stateBeforeJson),
    stateAfter: toStudyFsrsState(log.stateAfterJson),
    rawPayload:
      log.rawPayloadJson && typeof log.rawPayloadJson === 'object'
        ? (log.rawPayloadJson as Record<string, unknown>)
        : null,
  };
}
