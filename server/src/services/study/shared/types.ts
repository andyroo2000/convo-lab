import type {
  StudyCardActionName,
  StudyCardSetDueMode,
  StudyCardType,
  StudyImportPreview,
  StudyOverview,
  StudyQueueState,
  StudyAnswerPayload,
  StudyAudioSource,
  StudyFsrsState,
  StudyPromptPayload,
} from '@languageflow/shared/src/types.js';
import { Prisma } from '@prisma/client';

import { AppError } from '../../../middleware/errorHandler.js';

export type JsonRecord = Record<string, unknown>;
export type StudyMediaRecord = Prisma.StudyMediaGetPayload<Prisma.StudyMediaDefaultArgs>;
export type StudyImportJobRecord =
  Prisma.StudyImportJobGetPayload<Prisma.StudyImportJobDefaultArgs>;
export type StudyReviewLogRecord =
  Prisma.StudyReviewLogGetPayload<Prisma.StudyReviewLogDefaultArgs>;
export type StudyCardWithRelations = Prisma.StudyCardGetPayload<{
  include: {
    note: true;
    promptAudioMedia: true;
    answerAudioMedia: true;
    imageMedia: true;
  };
}>;
export type StudyBrowserListCardRecord = Prisma.StudyCardGetPayload<{
  select: {
    id: true;
    cardType: true;
    queueState: true;
    promptJson: true;
    answerJson: true;
    updatedAt: true;
  };
}>;
export type StudyBrowserListNoteRecord = Prisma.StudyNoteGetPayload<{
  include: {
    cards: {
      select: {
        id: true;
        cardType: true;
        queueState: true;
        promptJson: true;
        answerJson: true;
        updatedAt: true;
      };
    };
  };
}>;
export type StudyBrowserDetailNoteRecord = Prisma.StudyNoteGetPayload<{
  include: {
    cards: {
      include: {
        note: true;
        promptAudioMedia: true;
        answerAudioMedia: true;
        imageMedia: true;
      };
    };
  };
}>;

export interface QueryRow {
  [key: string]: string | number | Uint8Array | null;
}

export interface ParsedAnkiMediaRecord {
  id: string;
  sourceMediaKey: string | null;
  filename: string;
  mediaKind: 'audio' | 'image' | 'other';
  contentType: string;
  publicUrl: string | null;
  storagePath: string | null;
}

export interface PersistedStudyMediaRecord {
  id: string;
  userId: string;
  importJobId?: string | null;
  sourceKind?: string | null;
  normalizedFilename?: string | null;
  sourceFilename?: string | null;
  mediaKind?: string | null;
  storagePath?: string | null;
  publicUrl?: string | null;
}

export interface ParsedCardRow {
  cardId: number;
  noteId: number;
  deckId: number;
  ord: number;
  queue: number;
  type: number;
  due: number;
  ivl: number;
  factor: number;
  reps: number;
  lapses: number;
  left: number;
  odue: number;
  odid: number;
  data: string;
  noteGuid: string;
  noteTypeId: number;
  noteFields: string;
  noteTags: string;
  notetypeName: string;
  templateName: string | null;
}

export interface ParsedReviewLogRow {
  reviewId: number;
  cardId: number;
  ease: number;
  ivl: number;
  lastIvl: number;
  factor: number;
  time: number;
  type: number;
}

export interface ParsedImportDataset {
  collectionCreatedAtSeconds: number;
  preview: StudyImportPreview;
  mediaByFilename: Map<string, ParsedAnkiMediaRecord>;
  persistedMediaStoragePaths: string[];
  notes: Array<{
    createId: string;
    sourceNoteId: number;
    sourceGuid: string;
    sourceDeckId: number;
    sourceNotetypeId: number;
    sourceNotetypeName: string;
    rawFields: JsonRecord;
    canonical: JsonRecord;
  }>;
  cards: Array<{
    createId: string;
    noteCreateId: string;
    sourceCardId: number;
    sourceDeckId: number;
    sourceTemplateOrd: number;
    sourceTemplateName: string | null;
    sourceQueue: number;
    sourceCardType: number;
    sourceDue: number;
    sourceInterval: number;
    sourceFactor: number;
    sourceReps: number;
    sourceLapses: number;
    sourceLeft: number;
    sourceOriginalDue: number;
    sourceOriginalDeckId: number;
    sourceFsrs: JsonRecord | null;
    cardType: StudyCardType;
    queueState: StudyQueueState;
    dueAt: Date | null;
    lastReviewedAt: Date | null;
    prompt: StudyPromptPayload;
    answer: StudyAnswerPayload;
    schedulerState: StudyFsrsState;
    answerAudioSource: StudyAudioSource;
    promptAudioMediaFilename: string | null;
    answerAudioMediaFilename: string | null;
    imageMediaFilename: string | null;
  }>;
  reviewLogs: Array<{
    createId: string;
    sourceReviewId: number;
    sourceCardId: number;
    reviewedAt: Date;
    rating: number;
    sourceEase: number;
    sourceInterval: number;
    sourceLastInterval: number;
    sourceFactor: number;
    sourceTimeMs: number;
    sourceReviewType: number;
  }>;
  media: ParsedAnkiMediaRecord[];
}

export interface StudyImportWarningAccumulator {
  skippedMediaCount: number;
  warnings: string[];
}

export interface StudyExportCursor {
  timestamp: string;
  id: string;
}

export type StudyImportErrorWithMedia = AppError & {
  persistedMediaStoragePaths?: string[];
};

export interface CreateStudyCardInput {
  userId: string;
  cardType: StudyCardType;
  prompt: StudyPromptPayload;
  answer: StudyAnswerPayload;
  promptAudioMediaId?: string | null;
  answerAudioMediaId?: string | null;
  imageMediaId?: string | null;
}

export interface UpdateStudyCardInput {
  userId: string;
  cardId: string;
  prompt: StudyPromptPayload;
  answer: StudyAnswerPayload;
}

export interface RegenerateStudyCardAnswerAudioInput {
  userId: string;
  cardId: string;
  answerAudioVoiceId?: string | null;
  answerAudioTextOverride?: string | null;
}

export interface PerformStudyCardActionInput {
  userId: string;
  cardId: string;
  action: StudyCardActionName;
  mode?: StudyCardSetDueMode;
  dueAt?: string;
  timeZone?: string;
  currentOverview?: StudyOverview;
}

export interface StudyBrowserCursor {
  updatedAt: string;
  id: string;
}

export interface CachedStudyMediaRedirect {
  url: string;
  expiresAtMs: number;
}

export interface StudyMediaAccessResult {
  type: 'local' | 'redirect';
  absolutePath?: string;
  redirectUrl?: string;
  contentType: string;
  contentDisposition: 'inline' | 'attachment';
  filename: string;
}

export interface LegacyDeckConfig {
  id?: number;
  name?: string;
}

export interface LegacyFieldConfig {
  ord?: number;
  name?: string;
}

export interface LegacyTemplateConfig {
  ord?: number;
  name?: string;
}

export interface LegacyModelConfig {
  id?: number;
  name?: string;
  flds?: LegacyFieldConfig[];
  tmpls?: LegacyTemplateConfig[];
}
