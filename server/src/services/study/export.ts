import type {
  StudyExportManifest,
  StudyExportSectionResponse,
  StudyImportResult,
  StudyMediaRef,
  StudyReviewEvent,
  StudyCardSummary,
} from '@languageflow/shared/src/types.js';

import { prisma } from '../../db/client.js';

import type { StudyImportJobRecord, StudyMediaRecord, StudyReviewLogRecord } from './shared.js';
import {
  decodeStudyExportCursor,
  encodeStudyExportCursor,
  parseStudyImportStatus,
  parseStudyMediaKind,
  parseStudyReviewSource,
  toStudyCardSummary,
  toStudyFsrsState,
  toStudyImportPreview,
  getStudyMediaApiPath,
} from './shared.js';

const STUDY_EXPORT_SECTION_LIMIT_DEFAULT = 500;
const STUDY_EXPORT_SECTION_LIMIT_MAX = 1000;

function parseStudyExportSectionLimit(limit?: number): number {
  return Math.max(
    1,
    Math.min(STUDY_EXPORT_SECTION_LIMIT_MAX, limit ?? STUDY_EXPORT_SECTION_LIMIT_DEFAULT)
  );
}

function toStudyReviewEvent(log: StudyReviewLogRecord): StudyReviewEvent {
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

function toStudyExportMediaRef(item: StudyMediaRecord): StudyMediaRef {
  return {
    id: item.id,
    filename: item.sourceFilename,
    url: getStudyMediaApiPath(item.id),
    mediaKind: parseStudyMediaKind(item.mediaKind),
    source:
      item.sourceKind === 'generated'
        ? 'generated'
        : item.mediaKind === 'image'
          ? 'imported_image'
          : item.mediaKind === 'audio'
            ? 'imported'
            : 'imported_other',
  };
}

function toStudyExportImportResult(item: StudyImportJobRecord): StudyImportResult {
  return {
    id: item.id,
    status: parseStudyImportStatus(item.status),
    sourceFilename: item.sourceFilename,
    deckName: item.deckName,
    preview: toStudyImportPreview(item.previewJson),
    importedAt: item.completedAt instanceof Date ? item.completedAt.toISOString() : null,
    errorMessage: typeof item.errorMessage === 'string' ? item.errorMessage : null,
  };
}

export async function exportStudyData(userId: string): Promise<StudyExportManifest> {
  const [cards, reviewLogs, media, imports] = await Promise.all([
    prisma.studyCard.count({ where: { userId } }),
    prisma.studyReviewLog.count({ where: { userId } }),
    prisma.studyMedia.count({ where: { userId } }),
    prisma.studyImportJob.count({ where: { userId } }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    sections: {
      cards: { total: cards },
      reviewLogs: { total: reviewLogs },
      media: { total: media },
      imports: { total: imports },
    },
  };
}

export async function exportStudyCardsSection(input: {
  userId: string;
  cursor?: string;
  limit?: number;
}): Promise<StudyExportSectionResponse<StudyCardSummary>> {
  const limit = parseStudyExportSectionLimit(input.limit);
  const cursor = input.cursor ? decodeStudyExportCursor(input.cursor) : null;
  const cards = await prisma.studyCard.findMany({
    where: {
      userId: input.userId,
      ...(cursor
        ? {
            OR: [
              { updatedAt: { lt: new Date(cursor.timestamp) } },
              {
                updatedAt: new Date(cursor.timestamp),
                id: { lt: cursor.id },
              },
            ],
          }
        : {}),
    },
    include: { note: true, promptAudioMedia: true, answerAudioMedia: true, imageMedia: true },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });

  const hasMore = cards.length > limit;
  const pageCards = hasMore ? cards.slice(0, limit) : cards;
  const items = await Promise.all(pageCards.map((card) => toStudyCardSummary(card)));
  const lastCard = pageCards.at(-1);

  return {
    items,
    nextCursor:
      hasMore && lastCard
        ? encodeStudyExportCursor({
            timestamp: lastCard.updatedAt.toISOString(),
            id: lastCard.id,
          })
        : null,
  };
}

export async function exportStudyReviewLogsSection(input: {
  userId: string;
  cursor?: string;
  limit?: number;
}): Promise<StudyExportSectionResponse<StudyReviewEvent>> {
  const limit = parseStudyExportSectionLimit(input.limit);
  const cursor = input.cursor ? decodeStudyExportCursor(input.cursor) : null;
  const logs = await prisma.studyReviewLog.findMany({
    where: {
      userId: input.userId,
      ...(cursor
        ? {
            OR: [
              { reviewedAt: { lt: new Date(cursor.timestamp) } },
              {
                reviewedAt: new Date(cursor.timestamp),
                id: { lt: cursor.id },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ reviewedAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });

  const hasMore = logs.length > limit;
  const pageLogs = hasMore ? logs.slice(0, limit) : logs;
  const lastLog = pageLogs.at(-1);

  return {
    items: pageLogs.map(toStudyReviewEvent),
    nextCursor:
      hasMore && lastLog
        ? encodeStudyExportCursor({
            timestamp: lastLog.reviewedAt.toISOString(),
            id: lastLog.id,
          })
        : null,
  };
}

export async function exportStudyMediaSection(input: {
  userId: string;
  cursor?: string;
  limit?: number;
}): Promise<StudyExportSectionResponse<StudyMediaRef>> {
  const limit = parseStudyExportSectionLimit(input.limit);
  const cursor = input.cursor ? decodeStudyExportCursor(input.cursor) : null;
  const media = await prisma.studyMedia.findMany({
    where: {
      userId: input.userId,
      ...(cursor
        ? {
            OR: [
              { updatedAt: { lt: new Date(cursor.timestamp) } },
              {
                updatedAt: new Date(cursor.timestamp),
                id: { lt: cursor.id },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });

  const hasMore = media.length > limit;
  const pageMedia = hasMore ? media.slice(0, limit) : media;
  const lastMedia = pageMedia.at(-1);

  return {
    items: pageMedia.map(toStudyExportMediaRef),
    nextCursor:
      hasMore && lastMedia
        ? encodeStudyExportCursor({
            timestamp: lastMedia.updatedAt.toISOString(),
            id: lastMedia.id,
          })
        : null,
  };
}

export async function exportStudyImportsSection(input: {
  userId: string;
  cursor?: string;
  limit?: number;
}): Promise<StudyExportSectionResponse<StudyImportResult>> {
  const limit = parseStudyExportSectionLimit(input.limit);
  const cursor = input.cursor ? decodeStudyExportCursor(input.cursor) : null;
  const imports = await prisma.studyImportJob.findMany({
    where: {
      userId: input.userId,
      ...(cursor
        ? {
            OR: [
              { updatedAt: { lt: new Date(cursor.timestamp) } },
              {
                updatedAt: new Date(cursor.timestamp),
                id: { lt: cursor.id },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });

  const hasMore = imports.length > limit;
  const pageImports = hasMore ? imports.slice(0, limit) : imports;
  const lastImport = pageImports.at(-1);

  return {
    items: pageImports.map(toStudyExportImportResult),
    nextCursor:
      hasMore && lastImport
        ? encodeStudyExportCursor({
            timestamp: lastImport.updatedAt.toISOString(),
            id: lastImport.id,
          })
        : null,
  };
}
