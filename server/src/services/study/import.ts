import { mkdtemp, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';

import {
  MAX_STUDY_ASYNC_IMPORT_BYTES,
  MAX_STUDY_IMPORT_BYTES,
  STUDY_IMPORT_UPLOAD_SESSION_TTL_MS,
} from '@languageflow/shared/src/studyConstants.js';
import type {
  StudyImportPreview,
  StudyImportResult,
  StudyImportUploadReadiness,
  StudyImportUploadSession,
} from '@languageflow/shared/src/types.js';
import { Prisma } from '@prisma/client';

import { getClientOrigin } from '../../config/browserRuntime.js';
import { prisma } from '../../db/client.js';
import { enqueueStudyImportJob } from '../../jobs/studyImportQueue.js';
import { AppError } from '../../middleware/errorHandler.js';
import {
  createResumableUploadSession,
  deleteFromGCSPath,
  downloadFromGCSPath,
  getGcsBucketCorsConfiguration,
  getGcsObjectMetadata,
  readGCSObjectPrefix,
  type GcsBucketCorsRule,
} from '../storageClient.js';

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
const STUDY_IMPORT_STALE_PENDING_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const STUDY_IMPORT_WRITE_BATCH_SIZE = 250;
const STUDY_IMPORT_UPLOAD_FOLDER = 'study/imports';
const STUDY_IMPORT_CORS_READINESS_CACHE_MS = 5 * 60 * 1000;
const STUDY_IMPORT_CONTENT_TYPES = new Set([
  '',
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream',
  'multipart/x-zip',
]);

let uploadCorsReadinessCache: {
  checkedAt: number;
  clientOrigin: string;
  result: StudyImportUploadReadiness;
} | null = null;

function createEmptyStudyImportPreview(): StudyImportPreview {
  return {
    deckName: ANKI_DECK_NAME,
    cardCount: 0,
    noteCount: 0,
    reviewLogCount: 0,
    mediaReferenceCount: 0,
    skippedMediaCount: 0,
    warnings: [],
    noteTypeBreakdown: [],
  };
}

function toStudyImportResult(job: StudyImportJobRecord): StudyImportResult {
  const sourceSizeBytes =
    typeof job.sourceSizeBytes === 'bigint' ? Number(job.sourceSizeBytes) : null;

  return {
    id: job.id,
    status: parseStudyImportStatus(job.status),
    sourceFilename: job.sourceFilename,
    deckName: job.deckName,
    preview: toStudyImportPreview(job.previewJson),
    uploadedAt: job.uploadedAt instanceof Date ? job.uploadedAt.toISOString() : null,
    uploadExpiresAt: job.uploadExpiresAt instanceof Date ? job.uploadExpiresAt.toISOString() : null,
    sourceSizeBytes,
    importedAt: job.completedAt instanceof Date ? job.completedAt.toISOString() : null,
    errorMessage: typeof job.errorMessage === 'string' ? job.errorMessage : null,
  };
}

function buildStudyImportObjectPath(userId: string, importJobId: string, filename: string): string {
  const normalizedFilename = normalizeFilename(filename) || 'import.colpkg';
  return `${STUDY_IMPORT_UPLOAD_FOLDER}/${userId}/${importJobId}/${normalizedFilename}`;
}

function assertValidStudyImportFilename(filename: string): string {
  const sanitizedFilename = sanitizeText(filename)?.trim() ?? '';
  if (!sanitizedFilename.toLowerCase().endsWith('.colpkg')) {
    throw new AppError('Only .colpkg Anki collection backups are accepted.', 400);
  }

  return sanitizedFilename;
}

function assertValidStudyImportContentType(contentType: string | undefined): string {
  const normalized = (contentType ?? '').trim().toLowerCase();
  if (!STUDY_IMPORT_CONTENT_TYPES.has(normalized)) {
    throw new AppError('Only .colpkg Anki collection backups are accepted.', 400);
  }

  return normalized || 'application/octet-stream';
}

function buildStudyImportTooLargeMessage(limitBytes: number): string {
  return `Study import files must be ${String(Math.floor(limitBytes / (1024 * 1024)))} MB or smaller.`;
}

function buildUploadExpiredMessage(): string {
  return 'This study import upload session expired. Please start the import again.';
}

function corsRuleContains(values: string[] | undefined, requiredValue: string): boolean {
  if (!Array.isArray(values)) return false;
  const normalizedRequired = requiredValue.toLowerCase();
  return values.some((value) => value === '*' || value.toLowerCase() === normalizedRequired);
}

function corsRuleAllowsStudyImportUpload(rule: GcsBucketCorsRule, clientOrigin: string): boolean {
  return (
    corsRuleContains(rule.origin, clientOrigin) &&
    corsRuleContains(rule.method, 'PUT') &&
    corsRuleContains(rule.method, 'OPTIONS') &&
    corsRuleContains(rule.responseHeader, 'Content-Type')
  );
}

export function evaluateStudyImportUploadCorsReadiness(params: {
  clientOrigin: string;
  corsRules: GcsBucketCorsRule[];
}): StudyImportUploadReadiness {
  const allowed = params.corsRules.some((rule) =>
    corsRuleAllowsStudyImportUpload(rule, params.clientOrigin)
  );

  if (allowed) {
    return { ready: true, message: null };
  }

  return {
    ready: false,
    message:
      'Study import uploads are not configured for this app origin. Configure the storage bucket CORS policy to allow PUT and OPTIONS with the Content-Type header.',
  };
}

export function resetStudyImportUploadReadinessCacheForTests(): void {
  uploadCorsReadinessCache = null;
}

export async function getStudyImportUploadReadiness(): Promise<StudyImportUploadReadiness> {
  const clientOrigin = getClientOrigin();
  const now = Date.now();
  if (
    uploadCorsReadinessCache &&
    uploadCorsReadinessCache.clientOrigin === clientOrigin &&
    now - uploadCorsReadinessCache.checkedAt < STUDY_IMPORT_CORS_READINESS_CACHE_MS
  ) {
    return uploadCorsReadinessCache.result;
  }

  let result: StudyImportUploadReadiness;
  try {
    const corsRules = await getGcsBucketCorsConfiguration();
    result = evaluateStudyImportUploadCorsReadiness({ clientOrigin, corsRules });
  } catch (error) {
    console.warn('[Study] Failed to verify study import upload CORS readiness:', error);
    result = {
      ready: false,
      message:
        'Study import uploads are temporarily unavailable because storage readiness could not be verified.',
    };
  }

  uploadCorsReadinessCache = {
    checkedAt: now,
    clientOrigin,
    result,
  };
  return result;
}

async function assertStudyImportUploadReadiness(): Promise<void> {
  const readiness = await getStudyImportUploadReadiness();
  if (!readiness.ready) {
    throw new AppError(
      readiness.message ??
        'Study import uploads are temporarily unavailable because storage is not ready.',
      503
    );
  }
}

async function ensureNoActiveStudyImport(
  userId: string,
  excludedImportJobId?: string
): Promise<void> {
  const activeImportJob = await prisma.studyImportJob.findFirst({
    where: {
      userId,
      status: 'processing',
      ...(excludedImportJobId
        ? {
            id: {
              not: excludedImportJobId,
            },
          }
        : {}),
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (activeImportJob) {
    throw new AppError(`A study import is already running (${activeImportJob.id}).`, 409);
  }
}

async function cleanupStalePendingStudyImportJobs(userId: string): Promise<void> {
  const staleThreshold = new Date(Date.now() - STUDY_IMPORT_STALE_PENDING_MAX_AGE_MS);
  const staleJobs = await prisma.studyImportJob.findMany({
    where: {
      userId,
      status: 'pending',
      createdAt: {
        lt: staleThreshold,
      },
    },
    select: {
      id: true,
      sourceObjectPath: true,
    },
  });

  if (staleJobs.length === 0) {
    return;
  }

  await Promise.allSettled(
    staleJobs
      .map((job) => job.sourceObjectPath)
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .map((storagePath) => deleteFromGCSPath(storagePath))
  );

  await prisma.studyImportJob.updateMany({
    where: {
      id: {
        in: staleJobs.map((job) => job.id),
      },
      status: 'pending',
    },
    data: {
      status: 'failed',
      errorMessage: 'Upload was abandoned before import started.',
      completedAt: new Date(),
    },
  });
}

async function cleanupStaleProcessingStudyImportJobs(userId: string): Promise<void> {
  const staleThreshold = new Date(Date.now() - STUDY_IMPORT_STALE_JOB_MAX_AGE_MS);
  await prisma.studyImportJob.updateMany({
    where: {
      userId,
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
}

function scheduleStalePendingStudyImportCleanup(userId: string): void {
  void cleanupStalePendingStudyImportJobs(userId).catch((error) => {
    console.warn('[Study] Failed to clean up stale pending study imports:', error);
  });
}

export async function cleanupStaleStudyImportJobs(userId: string): Promise<void> {
  await cleanupStaleProcessingStudyImportJobs(userId);
  await cleanupStalePendingStudyImportJobs(userId);
}

async function createManyInBatches<T>(
  items: T[],
  createMany: (batch: T[]) => Promise<unknown>,
  batchSize: number = STUDY_IMPORT_WRITE_BATCH_SIZE
): Promise<void> {
  for (let start = 0; start < items.length; start += batchSize) {
    await createMany(items.slice(start, start + batchSize));
  }
}

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

async function runStudyImportTransaction(params: {
  userId: string;
  importJob: StudyImportJobRecord;
  sourceFilename: string;
  archiveFilePath: string;
}): Promise<StudyImportResult> {
  const { userId, importJob, sourceFilename, archiveFilePath } = params;
  let parsedDataset: ParsedImportDataset | undefined;

  try {
    try {
      parsedDataset = await parseColpkgUpload({
        archiveFilePath,
        filename: sourceFilename,
        userId,
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
          userId,
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
    const completedAt = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.studyReviewLog.deleteMany({
        where: {
          userId,
          source: 'anki_import',
        },
      });
      await tx.studyCard.deleteMany({
        where: {
          userId,
          sourceKind: 'anki_import',
        },
      });
      await tx.studyNote.deleteMany({
        where: {
          userId,
          sourceKind: 'anki_import',
        },
      });
      await tx.studyMedia.deleteMany({
        where: {
          userId,
          sourceKind: 'anki_import',
        },
      });

      await tx.studyImportJob.update({
        where: { id: importJob.id },
        data: {
          previewJson: toPrismaJson(parsed.preview),
        },
      });

      await createManyInBatches(parsed.notes, async (batch) => {
        await tx.studyNote.createMany({
          data: batch.map((note) => ({
            id: note.createId,
            userId,
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
      });

      await createManyInBatches(parsed.media, async (batch) => {
        await tx.studyMedia.createMany({
          data: batch.map((media) => ({
            id: media.id,
            userId,
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
      });

      await createManyInBatches(parsed.cards, async (batch) => {
        await tx.studyCard.createMany({
          data: batch.map((card) => ({
            id: card.createId,
            userId,
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
            imageMediaId: mediaByFilenameToRecordId(
              parsed.mediaByFilename,
              card.imageMediaFilename
            ),
          })),
        });
      });

      await createManyInBatches(reviewLogsToCreate, async (batch) => {
        await tx.studyReviewLog.createMany({
          data: batch,
        });
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
          completedAt,
        },
      });
    });

    return {
      id: importJob.id,
      status: 'completed',
      sourceFilename: sanitizeText(sourceFilename) ?? 'import.colpkg',
      deckName: ANKI_DECK_NAME,
      preview: parsed.preview,
      uploadedAt: importJob.uploadedAt instanceof Date ? importJob.uploadedAt.toISOString() : null,
      sourceSizeBytes:
        typeof importJob.sourceSizeBytes === 'bigint' ? Number(importJob.sourceSizeBytes) : null,
      importedAt: completedAt.toISOString(),
      errorMessage: null,
    };
  } catch (error) {
    const safeImportError = toSafeStudyImportError(error);

    await prisma
      .$transaction(async (tx) => {
        await tx.studyReviewLog.deleteMany({
          where: { userId, importJobId: importJob.id },
        });
        await tx.studyCard.deleteMany({
          where: { userId, importJobId: importJob.id },
        });
        await tx.studyNote.deleteMany({
          where: { userId, importJobId: importJob.id },
        });
        await tx.studyMedia.deleteMany({
          where: { userId, importJobId: importJob.id },
        });
      })
      .catch((cleanupError) => {
        console.warn('[Study] Failed to clean up partial import rows:', cleanupError);
      });

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

export async function createStudyImportUploadSession(params: {
  userId: string;
  filename: string;
  contentType?: string;
}): Promise<StudyImportUploadSession> {
  const sourceFilename = assertValidStudyImportFilename(params.filename);
  const sourceContentType = assertValidStudyImportContentType(params.contentType);
  await assertStudyImportUploadReadiness();
  await cleanupStaleProcessingStudyImportJobs(params.userId);
  scheduleStalePendingStudyImportCleanup(params.userId);
  await ensureNoActiveStudyImport(params.userId);
  const uploadExpiresAt = new Date(Date.now() + STUDY_IMPORT_UPLOAD_SESSION_TTL_MS);

  const importJob = await prisma.studyImportJob.create({
    data: {
      userId: params.userId,
      status: 'pending',
      sourceFilename,
      sourceContentType,
      deckName: ANKI_DECK_NAME,
      previewJson: toPrismaJson(createEmptyStudyImportPreview()),
      uploadExpiresAt,
    },
  });

  const sourceObjectPath = buildStudyImportObjectPath(params.userId, importJob.id, sourceFilename);
  const uploadSession = await createResumableUploadSession({
    destinationPath: sourceObjectPath,
    contentType: sourceContentType,
    origin: getClientOrigin(),
    metadata: {
      importJobId: importJob.id,
      userId: params.userId,
    },
  });

  const updatedJob = await prisma.studyImportJob.update({
    where: { id: importJob.id },
    data: {
      sourceObjectPath: uploadSession.filePath,
      sourceContentType,
    },
  });

  return {
    importJob: toStudyImportResult(updatedJob),
    upload: {
      method: 'PUT',
      url: uploadSession.url,
      headers: {
        'Content-Type': sourceContentType,
      },
    },
  };
}

export async function completeStudyImportUpload(params: {
  userId: string;
  importJobId: string;
}): Promise<StudyImportResult> {
  await cleanupStaleProcessingStudyImportJobs(params.userId);
  scheduleStalePendingStudyImportCleanup(params.userId);
  await ensureNoActiveStudyImport(params.userId, params.importJobId);

  const importJob = await prisma.studyImportJob.findFirst({
    where: {
      id: params.importJobId,
      userId: params.userId,
    },
  });

  if (!importJob) {
    throw new AppError('Study import not found.', 404);
  }

  if (importJob.status !== 'pending') {
    return toStudyImportResult(importJob);
  }

  if (!importJob.sourceObjectPath) {
    throw new AppError('Study import upload target is missing.', 400);
  }

  if (
    importJob.uploadExpiresAt instanceof Date &&
    importJob.uploadExpiresAt.getTime() < Date.now()
  ) {
    await Promise.allSettled([
      prisma.studyImportJob.update({
        where: { id: importJob.id },
        data: {
          status: 'failed',
          errorMessage: buildUploadExpiredMessage(),
          completedAt: new Date(),
        },
      }),
      deleteFromGCSPath(importJob.sourceObjectPath),
    ]);

    throw new AppError(buildUploadExpiredMessage(), 410);
  }

  const objectMetadata = await getGcsObjectMetadata(importJob.sourceObjectPath);
  if (!objectMetadata) {
    throw new AppError(
      'Upload has not finished yet. Please wait for the file upload to complete.',
      409
    );
  }

  if (
    typeof objectMetadata.sizeBytes === 'number' &&
    Number.isFinite(objectMetadata.sizeBytes) &&
    objectMetadata.sizeBytes > MAX_STUDY_ASYNC_IMPORT_BYTES
  ) {
    await Promise.allSettled([
      prisma.studyImportJob.update({
        where: { id: importJob.id },
        data: {
          status: 'failed',
          errorMessage: buildStudyImportTooLargeMessage(MAX_STUDY_ASYNC_IMPORT_BYTES),
          completedAt: new Date(),
        },
      }),
      deleteFromGCSPath(importJob.sourceObjectPath),
    ]);

    throw new AppError(buildStudyImportTooLargeMessage(MAX_STUDY_ASYNC_IMPORT_BYTES), 413);
  }

  const prefix = await readGCSObjectPrefix({
    filePath: importJob.sourceObjectPath,
    byteCount: 2,
  });

  if (prefix.length < 2 || prefix.toString('utf8') !== 'PK') {
    await Promise.allSettled([
      prisma.studyImportJob.update({
        where: { id: importJob.id },
        data: {
          status: 'failed',
          errorMessage: 'The uploaded file is not a valid ZIP-based .colpkg archive.',
          completedAt: new Date(),
        },
      }),
      deleteFromGCSPath(importJob.sourceObjectPath),
    ]);

    throw new AppError('The uploaded file is not a valid ZIP-based .colpkg archive.', 400);
  }

  const updatedJob = await prisma.studyImportJob.update({
    where: { id: importJob.id },
    data: {
      sourceContentType: objectMetadata.contentType ?? importJob.sourceContentType,
      sourceSizeBytes:
        typeof objectMetadata.sizeBytes === 'number' && Number.isFinite(objectMetadata.sizeBytes)
          ? BigInt(objectMetadata.sizeBytes)
          : importJob.sourceSizeBytes,
      uploadedAt: new Date(),
      errorMessage: null,
      completedAt: null,
    },
  });

  await enqueueStudyImportJob(updatedJob.id);
  return toStudyImportResult(updatedJob);
}

export async function cancelStudyImportUpload(params: {
  userId: string;
  importJobId: string;
}): Promise<StudyImportResult> {
  const importJob = await prisma.studyImportJob.findFirst({
    where: {
      id: params.importJobId,
      userId: params.userId,
    },
  });

  if (!importJob) {
    throw new AppError('Study import not found.', 404);
  }

  if (importJob.status === 'processing') {
    throw new AppError('Study import is already processing and cannot be cancelled.', 409);
  }

  if (importJob.status !== 'pending') {
    return toStudyImportResult(importJob);
  }

  const [updatedJob] = await Promise.all([
    prisma.studyImportJob.update({
      where: { id: importJob.id },
      data: {
        status: 'failed',
        errorMessage: 'Study import upload was cancelled.',
        completedAt: new Date(),
      },
    }),
    importJob.sourceObjectPath
      ? deleteFromGCSPath(importJob.sourceObjectPath).catch((error) => {
          console.warn('[Study] Failed to delete cancelled import archive:', error);
        })
      : Promise.resolve(),
  ]);

  return toStudyImportResult(updatedJob);
}

function isActiveProcessingImportLockViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false;
  }

  // Prisma cannot represent this partial unique index in schema.prisma; migration
  // 20260421233000_add_study_search_text_and_export_indexes creates it directly.
  const target = error.meta?.target;
  if (typeof target === 'string') {
    return target === 'study_import_jobs_userId_processing_unique';
  }

  if (Array.isArray(target)) {
    return target.includes('userId');
  }

  return false;
}

export async function processStudyImportJob(
  importJobId: string
): Promise<StudyImportResult | null> {
  const existingJob = await prisma.studyImportJob.findUnique({
    where: { id: importJobId },
  });

  if (!existingJob) {
    return null;
  }

  if (existingJob.status === 'completed' || existingJob.status === 'failed') {
    return toStudyImportResult(existingJob);
  }

  if (!existingJob.sourceObjectPath) {
    throw new AppError('Study import upload target is missing.', 400);
  }
  const sourceObjectPath = existingJob.sourceObjectPath;

  let processingJob: StudyImportJobRecord;
  try {
    processingJob = await prisma.studyImportJob.update({
      where: { id: importJobId },
      data: {
        status: 'processing',
        startedAt: new Date(),
        errorMessage: null,
      },
    });
  } catch (error) {
    if (isActiveProcessingImportLockViolation(error)) {
      const activeJob = await prisma.studyImportJob.findUnique({
        where: { id: importJobId },
      });
      return activeJob ? toStudyImportResult(activeJob) : null;
    }

    throw error;
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'study-import-'));
  const archiveFilePath = path.join(
    tempDir,
    normalizeFilename(processingJob.sourceFilename) || 'import.colpkg'
  );

  try {
    await downloadFromGCSPath({
      filePath: sourceObjectPath,
      destinationPath: archiveFilePath,
    });

    const result = await runStudyImportTransaction({
      userId: processingJob.userId,
      importJob: processingJob,
      sourceFilename: processingJob.sourceFilename,
      archiveFilePath,
    });

    await deleteFromGCSPath(sourceObjectPath).catch((error) => {
      console.warn('[Study] Failed to delete staged import archive after success:', error);
    });

    return result;
  } catch (error) {
    await deleteFromGCSPath(sourceObjectPath).catch((cleanupError) => {
      console.warn('[Study] Failed to delete staged import archive after failure:', cleanupError);
    });
    throw error;
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function importJapaneseStudyColpkg(params: {
  userId: string;
  fileBuffer: Buffer;
  filename: string;
}): Promise<StudyImportResult> {
  // Legacy sync entrypoint kept for tests and local-only callers that still pass an in-memory
  // archive buffer directly. The user-facing route now stages uploads in GCS and processes them
  // asynchronously via BullMQ.
  if (params.fileBuffer.length > MAX_STUDY_IMPORT_BYTES) {
    throw new AppError(buildStudyImportTooLargeMessage(MAX_STUDY_IMPORT_BYTES), 413);
  }

  if (params.fileBuffer.length < 2 || params.fileBuffer.subarray(0, 2).toString('utf8') !== 'PK') {
    throw new AppError('The uploaded file is not a valid ZIP-based .colpkg archive.', 400);
  }

  const sourceFilename = assertValidStudyImportFilename(params.filename);
  await cleanupStaleStudyImportJobs(params.userId);
  await ensureNoActiveStudyImport(params.userId);

  const importJob = await prisma.studyImportJob.create({
    data: {
      userId: params.userId,
      status: 'processing',
      sourceFilename,
      sourceContentType: 'application/zip',
      sourceSizeBytes: BigInt(params.fileBuffer.length),
      deckName: ANKI_DECK_NAME,
      previewJson: toPrismaJson(createEmptyStudyImportPreview()),
      uploadedAt: new Date(),
      startedAt: new Date(),
    },
  });

  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'study-import-legacy-'));
  const archiveFilePath = path.join(tempDir, normalizeFilename(sourceFilename));

  try {
    await writeFile(archiveFilePath, params.fileBuffer);
    return await runStudyImportTransaction({
      userId: params.userId,
      importJob,
      sourceFilename,
      archiveFilePath,
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function getStudyImportJob(
  userId: string,
  importJobId: string
): Promise<StudyImportResult | null> {
  await cleanupStaleProcessingStudyImportJobs(userId);
  scheduleStalePendingStudyImportCleanup(userId);

  const job: StudyImportJobRecord | null = await prisma.studyImportJob.findFirst({
    where: {
      id: importJobId,
      userId,
    },
  });

  if (!job) return null;

  return toStudyImportResult(job);
}

export async function getCurrentStudyImportJob(userId: string): Promise<StudyImportResult | null> {
  await cleanupStaleProcessingStudyImportJobs(userId);
  scheduleStalePendingStudyImportCleanup(userId);

  const job: StudyImportJobRecord | null = await prisma.studyImportJob.findFirst({
    where: {
      userId,
      status: {
        in: ['pending', 'processing'],
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return job ? toStudyImportResult(job) : null;
}
