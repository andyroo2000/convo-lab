import type {
  StudyCardActionName,
  StudyCardCreationKind,
  StudyCardSetDueMode,
  StudyCardType,
  StudyOverview,
  StudyAnswerPayload,
  StudyPromptPayload,
  StudyVocabVariantKind,
  StudyVocabVariantStatus,
} from '@languageflow/shared/src/types.js';
import { Prisma } from '@prisma/client';

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

export interface CreateStudyCardInput {
  userId: string;
  cardType: StudyCardType;
  prompt: StudyPromptPayload;
  answer: StudyAnswerPayload;
  creationKind?: StudyCardCreationKind | null;
  noteTypeName?: string | null;
  rawFields?: JsonRecord | null;
  canonicalFields?: JsonRecord | null;
  sourceTemplateName?: string | null;
  promptAudioMediaId?: string | null;
  answerAudioMediaId?: string | null;
  imageMediaId?: string | null;
  variantGroupId?: string | null;
  variantSentenceId?: string | null;
  variantKind?: StudyVocabVariantKind | null;
  variantStage?: number | null;
  variantStatus?: StudyVocabVariantStatus | null;
  variantUnlockedAt?: Date | null;
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
