import { MAX_STUDY_IMPORT_BYTES } from '@languageflow/shared/src/studyConstants.js';
import type { StudyImportPreview, StudyImportResult } from '@languageflow/shared/src/types.js';
import { Prisma } from '@prisma/client';

import { prisma } from '../../db/client.js';
import { AppError } from '../../middleware/errorHandler.js';

import type {
  ParsedImportDataset,
  StudyImportErrorWithMedia,
  StudyImportJobRecord,
} from './shared.js';
import {
  ANKI_DECK_NAME,
  buildStudyCardSearchText,
  buildStudyNoteSearchText,
  deletePersistedStudyMediaByStoragePath,
  normalizeFilename,
  parseColpkgUpload,
  parseStudyImportStatus,
  sanitizeText,
  toImportReviewRawPayload,
  toBigIntOrNull,
  toNullablePrismaJson,
  toPrismaJson,
  toSafeStudyImportError,
  toStudyImportPreview,
} from './shared.js';

const STUDY_IMPORT_STALE_JOB_MAX_AGE_MS = 60 * 60 * 1000;

function mediaByFilenameToSourceMediaKey(
  mediaByFilename: Map<string, { sourceMediaKey: string | null }>,
  filename: string
): string | null {
  return mediaByFilename.get(filename)?.sourceMediaKey ?? null;
}

function mediaByFilenameToRecordId(
  mediaByFilename: Map<string, { id: string }>,
  filename: string | null
): string | null {
  if (!filename) return null;
  return mediaByFilename.get(filename)?.id ?? null;
}

export async function importJapaneseStudyColpkg(params: {
  userId: string;
  fileBuffer: Buffer;
  filename: string;
}): Promise<StudyImportResult> {
  if (params.fileBuffer.length > MAX_STUDY_IMPORT_BYTES) {
    throw new AppError(
      `Study import files must be ${String(Math.floor(MAX_STUDY_IMPORT_BYTES / (1024 * 1024)))} MB or smaller.`,
      413
    );
  }

  if (params.fileBuffer.length < 2 || params.fileBuffer.subarray(0, 2).toString('utf8') !== 'PK') {
    throw new AppError('The uploaded file is not a valid ZIP-based .colpkg archive.', 400);
  }

  const staleThreshold = new Date(Date.now() - STUDY_IMPORT_STALE_JOB_MAX_AGE_MS);
  await prisma.studyImportJob.updateMany({
    where: {
      userId: params.userId,
      status: 'processing',
      startedAt: {
        lt: staleThreshold,
      },
    },
    data: {
      status: 'failed',
      errorMessage: 'Import timed out before completion.',
      completedAt: new Date(),
    },
  });

  const initialPreview: StudyImportPreview = {
    deckName: ANKI_DECK_NAME,
    cardCount: 0,
    noteCount: 0,
    reviewLogCount: 0,
    mediaReferenceCount: 0,
    skippedMediaCount: 0,
    warnings: [],
    noteTypeBreakdown: [],
  };

  let importJob: StudyImportJobRecord;
  try {
    importJob = await prisma.studyImportJob.create({
      data: {
        userId: params.userId,
        status: 'processing',
        sourceFilename: sanitizeText(params.filename) ?? 'import.colpkg',
        deckName: ANKI_DECK_NAME,
        previewJson: toPrismaJson(initialPreview),
        startedAt: new Date(),
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const activeImportJob = await prisma.studyImportJob.findFirst({
        where: {
          userId: params.userId,
          status: 'processing',
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      throw new AppError(
        activeImportJob
          ? `A study import is already running (${activeImportJob.id}).`
          : 'A study import is already running.',
        409
      );
    }

    throw error;
  }

  let parsedDataset: ParsedImportDataset | undefined;

  try {
    try {
      parsedDataset = await parseColpkgUpload({
        fileBuffer: params.fileBuffer,
        filename: params.filename,
        userId: params.userId,
        importJobId: importJob.id,
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError('The uploaded .colpkg could not be parsed.', 400);
    }

    if (!parsedDataset) {
      throw new AppError('The uploaded .colpkg could not be parsed.', 400);
    }
    const parsed = parsedDataset;

    await prisma.$transaction(async (tx) => {
      await tx.studyReviewLog.deleteMany({
        where: {
          userId: params.userId,
          source: 'anki_import',
        },
      });
      await tx.studyCard.deleteMany({
        where: {
          userId: params.userId,
          sourceKind: 'anki_import',
        },
      });
      await tx.studyNote.deleteMany({
        where: {
          userId: params.userId,
          sourceKind: 'anki_import',
        },
      });
      await tx.studyMedia.deleteMany({
        where: {
          userId: params.userId,
          sourceKind: 'anki_import',
        },
      });

      await tx.studyImportJob.update({
        where: { id: importJob.id },
        data: {
          previewJson: toPrismaJson(parsed.preview),
        },
      });

      await tx.studyNote.createMany({
        data: parsed.notes.map((note) => ({
          id: note.createId,
          userId: params.userId,
          importJobId: importJob.id,
          sourceKind: 'anki_import',
          sourceNoteId: BigInt(note.sourceNoteId),
          sourceGuid: sanitizeText(note.sourceGuid) ?? '',
          sourceDeckId: BigInt(note.sourceDeckId),
          sourceDeckName: ANKI_DECK_NAME,
          sourceNotetypeId: BigInt(note.sourceNotetypeId),
          sourceNotetypeName: sanitizeText(note.sourceNotetypeName) ?? '',
          rawFieldsJson: toPrismaJson(note.rawFields),
          canonicalJson: toPrismaJson(note.canonical),
          searchText: buildStudyNoteSearchText(note),
        })),
      });

      await tx.studyMedia.createMany({
        data: parsed.media.map((media) => ({
          id: media.id,
          userId: params.userId,
          importJobId: importJob.id,
          sourceKind: 'anki_import',
          sourceMediaKey: sanitizeText(
            mediaByFilenameToSourceMediaKey(parsed.mediaByFilename, media.filename)
          ),
          sourceFilename: sanitizeText(media.filename) ?? '',
          normalizedFilename: normalizeFilename(media.filename),
          mediaKind: media.mediaKind,
          contentType: media.contentType,
          storagePath: media.storagePath,
          publicUrl: media.publicUrl,
        })),
      });

      await tx.studyCard.createMany({
        data: parsed.cards.map((card) => ({
          id: card.createId,
          userId: params.userId,
          noteId: card.noteCreateId,
          importJobId: importJob.id,
          sourceKind: 'anki_import',
          sourceCardId: BigInt(card.sourceCardId),
          sourceDeckId: BigInt(card.sourceDeckId),
          sourceDeckName: ANKI_DECK_NAME,
          sourceTemplateOrd: card.sourceTemplateOrd,
          sourceTemplateName: sanitizeText(card.sourceTemplateName),
          sourceQueue: card.sourceQueue,
          sourceCardType: card.sourceCardType,
          sourceDue: card.sourceDue,
          sourceInterval: card.sourceInterval,
          sourceFactor: card.sourceFactor,
          sourceReps: card.sourceReps,
          sourceLapses: card.sourceLapses,
          sourceLeft: card.sourceLeft,
          sourceOriginalDue: card.sourceOriginalDue,
          sourceOriginalDeckId: toBigIntOrNull(card.sourceOriginalDeckId),
          sourceFsrsJson: toNullablePrismaJson(card.sourceFsrs),
          cardType: card.cardType,
          queueState: card.queueState,
          dueAt: card.dueAt,
          lastReviewedAt: card.lastReviewedAt,
          promptJson: toPrismaJson(card.prompt),
          answerJson: toPrismaJson(card.answer),
          searchText: buildStudyCardSearchText(card),
          schedulerStateJson: toPrismaJson(card.schedulerState),
          answerAudioSource: card.answerAudioSource,
          promptAudioMediaId: mediaByFilenameToRecordId(
            parsed.mediaByFilename,
            card.promptAudioMediaFilename
          ),
          answerAudioMediaId: mediaByFilenameToRecordId(
            parsed.mediaByFilename,
            card.answerAudioMediaFilename
          ),
          imageMediaId: mediaByFilenameToRecordId(parsed.mediaByFilename, card.imageMediaFilename),
        })),
      });

      const createdCardIdBySourceCardId = new Map(
        parsed.cards.map((card) => [card.sourceCardId, card.createId])
      );
      const reviewLogsToCreate = parsed.reviewLogs.flatMap((log) => {
        const cardId = createdCardIdBySourceCardId.get(log.sourceCardId);
        if (!cardId) {
          return [];
        }

        return [
          {
            id: log.createId,
            userId: params.userId,
            cardId,
            importJobId: importJob.id,
            source: 'anki_import' as const,
            sourceReviewId: BigInt(log.sourceReviewId),
            reviewedAt: log.reviewedAt,
            rating: log.rating,
            sourceEase: log.sourceEase,
            sourceInterval: log.sourceInterval,
            sourceLastInterval: log.sourceLastInterval,
            sourceFactor: log.sourceFactor,
            sourceTimeMs: log.sourceTimeMs,
            sourceReviewType: log.sourceReviewType,
            rawPayloadJson: toImportReviewRawPayload(log),
          },
        ];
      });
      await tx.studyReviewLog.createMany({
        data: reviewLogsToCreate,
      });

      await tx.studyImportJob.update({
        where: { id: importJob.id },
        data: {
          status: 'completed',
          previewJson: toPrismaJson(parsed.preview),
          summaryJson: toPrismaJson({
            cardCount: parsed.cards.length,
            noteCount: parsed.notes.length,
            reviewLogCount: parsed.reviewLogs.length,
            mediaCount: parsed.media.length,
          }),
          completedAt: new Date(),
        },
      });
    });

    return {
      id: importJob.id,
      status: 'completed',
      sourceFilename: sanitizeText(params.filename) ?? 'import.colpkg',
      deckName: ANKI_DECK_NAME,
      preview: parsed.preview,
      importedAt: new Date().toISOString(),
      errorMessage: null,
    };
  } catch (error) {
    const safeImportError = toSafeStudyImportError(error);
    await prisma.studyImportJob
      .update({
        where: { id: importJob.id },
        data: {
          status: 'failed',
          errorMessage: safeImportError.message,
          completedAt: new Date(),
        },
      })
      .catch((updateError) => {
        console.warn('[Study] Failed to mark import job as failed:', updateError);
      });

    const importError = error as StudyImportErrorWithMedia;
    const persistedMediaStoragePaths =
      parsedDataset?.persistedMediaStoragePaths ??
      (importError.persistedMediaStoragePaths ?? []).filter(
        (value): value is string => typeof value === 'string' && value.length > 0
      );

    if (persistedMediaStoragePaths.length > 0) {
      await Promise.allSettled(
        persistedMediaStoragePaths.map((storagePath: string) =>
          deletePersistedStudyMediaByStoragePath(storagePath)
        )
      );
    }

    throw safeImportError;
  }
}

export async function getStudyImportJob(
  userId: string,
  importJobId: string
): Promise<StudyImportResult | null> {
  const job: StudyImportJobRecord | null = await prisma.studyImportJob.findFirst({
    where: {
      id: importJobId,
      userId,
    },
  });

  if (!job) return null;

  return {
    id: job.id,
    status: parseStudyImportStatus(job.status),
    sourceFilename: job.sourceFilename,
    deckName: job.deckName,
    preview: toStudyImportPreview(job.previewJson),
    importedAt: job.completedAt instanceof Date ? job.completedAt.toISOString() : null,
    errorMessage: typeof job.errorMessage === 'string' ? job.errorMessage : null,
  };
}
