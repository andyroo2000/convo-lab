import type {
  StudyCardCreationKind,
  StudyCardImagePlacement,
  StudyCardType,
  StudyManualCardDraft,
  StudyManualCardDraftCreateCardResponse,
  StudyManualCardDraftCreateRequest,
  StudyManualCardDraftStatus,
  StudyManualCardDraftUpdateRequest,
  StudyMediaRef,
  StudyVocabVariantKind,
  StudyVocabVariantStatus,
} from '@languageflow/shared/src/types.js';
import { Prisma } from '@prisma/client';

import { prisma } from '../../db/client.js';
import { AppError } from '../../middleware/errorHandler.js';

import { completeManualStudyCardDraft, createManualStudyCard } from './manualCardDraft.js';
import {
  cardTypeForStudyCardCreationKind,
  isRecord,
  STUDY_CARD_CREATION_KINDS,
  STUDY_CARD_IMAGE_PLACEMENTS,
  toNullablePrismaJson,
  toPrismaJson,
} from './shared.js';

const STUDY_MANUAL_CARD_DRAFT_STATUSES = new Set<StudyManualCardDraftStatus>([
  'generating',
  'ready',
  'error',
]);
const MAX_MANUAL_CARD_DRAFTS_PER_USER = 2000;
const DEFAULT_MANUAL_CARD_DRAFT_LIST_LIMIT = 200;
const MANUAL_CARD_DRAFT_LIST_LIMIT_MAX = 2000;
const STALE_GENERATING_DRAFT_RETRY_AFTER_MS = 10 * 60 * 1000;
const STUDY_VOCAB_VARIANT_KINDS = new Set<StudyVocabVariantKind>([
  'sentence_audio_recognition',
  'sentence_text_recognition',
  'word_audio_recognition',
  'word_text_recognition',
  'sentence_cloze',
]);
const STUDY_VOCAB_VARIANT_STATUSES = new Set<StudyVocabVariantStatus>(['available', 'locked']);

type StudyManualCardDraftRecord = {
  id: string;
  userId: string;
  status: string;
  creationKind: string;
  cardType: string;
  promptJson: unknown;
  answerJson: unknown;
  imagePlacement: string;
  imagePrompt: string | null;
  previewAudioJson: unknown;
  previewAudioRole: string | null;
  previewImageJson: unknown;
  variantGroupId: string | null;
  variantSentenceId: string | null;
  variantKind: string | null;
  variantStage: number | null;
  variantStatus: string | null;
  variantUnlockedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface StudyManualCardDraftListInput {
  userId: string;
  cursor?: string | null;
  limit?: number | null;
}

export interface StudyManualCardDraftListResult {
  drafts: StudyManualCardDraft[];
  total: number;
  limit: number;
  nextCursor: string | null;
}

export interface ReadyManualCardDraftInput extends StudyManualCardDraftCreateRequest {
  previewAudio?: StudyMediaRef | null;
  previewAudioRole?: 'prompt' | 'answer' | null;
  previewImage?: StudyMediaRef | null;
  variantGroupId?: string | null;
  variantSentenceId?: string | null;
  variantKind?: StudyVocabVariantKind | null;
  variantStage?: number | null;
  variantStatus?: StudyVocabVariantStatus | null;
  variantUnlockedAt?: Date | null;
}

type ManualCardDraftTx = Prisma.TransactionClient;

function parseDraftStatus(value: string): StudyManualCardDraftStatus {
  if (STUDY_MANUAL_CARD_DRAFT_STATUSES.has(value as StudyManualCardDraftStatus)) {
    return value as StudyManualCardDraftStatus;
  }
  console.warn(`[Study] Unknown manual card draft status "${value}"; displaying as error.`);
  return 'error';
}

function parseCreationKind(value: string): StudyCardCreationKind {
  if (!STUDY_CARD_CREATION_KINDS.has(value as StudyCardCreationKind)) {
    throw new AppError('creationKind is not supported.', 400);
  }
  return value as StudyCardCreationKind;
}

function parseCardType(value: string): StudyCardType {
  if (value === 'recognition' || value === 'production' || value === 'cloze') {
    return value;
  }
  throw new AppError('cardType must be recognition, production, or cloze.', 400);
}

function parseImagePlacement(value: string): StudyCardImagePlacement {
  if (!STUDY_CARD_IMAGE_PLACEMENTS.has(value as StudyCardImagePlacement)) {
    throw new AppError('imagePlacement must be none, prompt, answer, or both.', 400);
  }
  return value as StudyCardImagePlacement;
}

function parsePreviewAudioRole(value: unknown): 'prompt' | 'answer' | null {
  return value === 'prompt' || value === 'answer' ? value : null;
}

function parseVariantKind(value: string | null): StudyVocabVariantKind | null {
  if (!value) return null;
  if (STUDY_VOCAB_VARIANT_KINDS.has(value as StudyVocabVariantKind)) {
    return value as StudyVocabVariantKind;
  }
  console.warn(`[Study] Unknown vocab variant kind "${value}"; omitting from draft payload.`);
  return null;
}

function parseVariantStatus(value: string | null): StudyVocabVariantStatus | null {
  if (!value) return null;
  if (STUDY_VOCAB_VARIANT_STATUSES.has(value as StudyVocabVariantStatus)) {
    return value as StudyVocabVariantStatus;
  }
  console.warn(`[Study] Unknown vocab variant status "${value}"; omitting from draft payload.`);
  return null;
}

function parseMediaRef(value: unknown): StudyMediaRef | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === 'string' ? value.id : null;
  const filename = typeof value.filename === 'string' ? value.filename : null;
  const url = typeof value.url === 'string' ? value.url : null;
  const mediaKind =
    value.mediaKind === 'audio' || value.mediaKind === 'image' || value.mediaKind === 'other'
      ? value.mediaKind
      : null;
  if (!id || !filename || !url || !mediaKind) return null;
  return {
    id,
    filename,
    url,
    mediaKind,
    source: value.source === 'generated' ? 'generated' : 'imported',
  };
}

function isStaleGeneratingDraft(record: StudyManualCardDraftRecord): boolean {
  return (
    record.status === 'generating' &&
    Date.now() - record.updatedAt.getTime() >= STALE_GENERATING_DRAFT_RETRY_AFTER_MS
  );
}

function validateCreationKindAndCardType(input: {
  creationKind: StudyCardCreationKind;
  cardType: StudyCardType;
}): void {
  const expected = cardTypeForStudyCardCreationKind(input.creationKind);
  if (input.cardType !== expected) {
    throw new AppError('cardType must match creationKind.', 400);
  }
}

function toManualCardDraft(record: StudyManualCardDraftRecord): StudyManualCardDraft {
  return {
    id: record.id,
    status: parseDraftStatus(record.status),
    creationKind: parseCreationKind(record.creationKind),
    cardType: parseCardType(record.cardType),
    prompt: isRecord(record.promptJson) ? record.promptJson : {},
    answer: isRecord(record.answerJson) ? record.answerJson : {},
    imagePlacement: parseImagePlacement(record.imagePlacement),
    imagePrompt: record.imagePrompt,
    previewAudio: parseMediaRef(record.previewAudioJson),
    previewAudioRole: parsePreviewAudioRole(record.previewAudioRole),
    previewImage: parseMediaRef(record.previewImageJson),
    variantGroupId: record.variantGroupId,
    variantSentenceId: record.variantSentenceId,
    variantKind: parseVariantKind(record.variantKind),
    variantStage: record.variantStage,
    variantStatus: parseVariantStatus(record.variantStatus),
    variantUnlockedAt: record.variantUnlockedAt?.toISOString() ?? null,
    errorMessage: record.errorMessage,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function normalizeListLimit(limit: number | null | undefined): number {
  if (!Number.isFinite(limit ?? NaN)) return DEFAULT_MANUAL_CARD_DRAFT_LIST_LIMIT;
  return Math.min(Math.max(Math.trunc(limit as number), 1), MANUAL_CARD_DRAFT_LIST_LIMIT_MAX);
}

function encodeDraftCursor(record: StudyManualCardDraftRecord): string {
  return Buffer.from(
    JSON.stringify({
      createdAt: record.createdAt.toISOString(),
      id: record.id,
    }),
    'utf8'
  ).toString('base64url');
}

function decodeDraftCursor(
  cursor: string | null | undefined
): { createdAt: Date; id: string } | null {
  if (!cursor) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new AppError('Invalid draft cursor.', 400);
  }
  if (
    !payload ||
    typeof payload !== 'object' ||
    !('createdAt' in payload) ||
    !('id' in payload) ||
    typeof payload.createdAt !== 'string' ||
    typeof payload.id !== 'string'
  ) {
    throw new AppError('Invalid draft cursor.', 400);
  }
  const createdAt = new Date(payload.createdAt);
  const id = payload.id;
  if (Number.isNaN(createdAt.getTime()) || !id) {
    throw new AppError('Invalid draft cursor.', 400);
  }
  return { createdAt, id };
}

async function findManualCardDraftOrThrow(input: {
  userId: string;
  draftId: string;
}): Promise<StudyManualCardDraftRecord> {
  const draft = await prisma.studyCardDraft.findFirst({
    where: {
      id: input.draftId,
      userId: input.userId,
    },
  });

  if (!draft) {
    throw new AppError('Study card draft not found.', 404);
  }

  return draft as StudyManualCardDraftRecord;
}

export async function listManualCardDrafts(
  input: StudyManualCardDraftListInput
): Promise<StudyManualCardDraftListResult> {
  const limit = normalizeListLimit(input.limit);
  const cursor = decodeDraftCursor(input.cursor);
  const where = {
    userId: input.userId,
    ...(cursor
      ? {
          OR: [
            { createdAt: { gt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { gt: cursor.id } },
          ],
        }
      : {}),
  };
  const [drafts, total] = await Promise.all([
    prisma.studyCardDraft.findMany({
      where,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
    }),
    prisma.studyCardDraft.count({ where: { userId: input.userId } }),
  ]);
  const hasMore = drafts.length > limit;
  const page = hasMore ? drafts.slice(0, limit) : drafts;
  return {
    drafts: page.map((draft) => toManualCardDraft(draft as StudyManualCardDraftRecord)),
    total,
    limit,
    nextCursor: hasMore
      ? encodeDraftCursor(page[page.length - 1] as StudyManualCardDraftRecord)
      : null,
  };
}

async function createReadyManualCardDraftRecords(input: {
  tx: ManualCardDraftTx;
  userId: string;
  drafts: ReadyManualCardDraftInput[];
}): Promise<StudyManualCardDraftRecord[]> {
  if (input.drafts.length === 0) return [];

  const normalizedDrafts = input.drafts.map((requestedDraft) => {
    const creationKind = parseCreationKind(requestedDraft.creationKind);
    const requestedCardType = parseCardType(requestedDraft.cardType);
    const cardType = cardTypeForStudyCardCreationKind(creationKind);
    validateCreationKindAndCardType({ creationKind, cardType: requestedCardType });
    const imagePlacement = parseImagePlacement(requestedDraft.imagePlacement ?? 'none');
    return {
      userId: input.userId,
      status: 'ready',
      creationKind,
      cardType,
      promptJson: toPrismaJson(requestedDraft.prompt),
      answerJson: toPrismaJson(requestedDraft.answer),
      imagePlacement,
      imagePrompt: requestedDraft.imagePrompt?.trim() || null,
      previewAudioJson: toNullablePrismaJson(requestedDraft.previewAudio ?? null),
      previewAudioRole: requestedDraft.previewAudioRole ?? null,
      previewImageJson: toNullablePrismaJson(requestedDraft.previewImage ?? null),
      variantGroupId: requestedDraft.variantGroupId ?? null,
      variantSentenceId: requestedDraft.variantSentenceId ?? null,
      variantKind: requestedDraft.variantKind ?? null,
      variantStage: requestedDraft.variantStage ?? null,
      variantStatus: requestedDraft.variantStatus ?? null,
      variantUnlockedAt: requestedDraft.variantUnlockedAt ?? null,
      errorMessage: null,
    };
  });

  const existingDraftCount = await input.tx.studyCardDraft.count({
    where: { userId: input.userId },
  });
  if (existingDraftCount + normalizedDrafts.length > MAX_MANUAL_CARD_DRAFTS_PER_USER) {
    throw new AppError('Draft queue is full. Delete some drafts before adding more.', 409);
  }

  return Promise.all(
    normalizedDrafts.map(async (data) => {
      const draft = await input.tx.studyCardDraft.create({ data });
      return draft as StudyManualCardDraftRecord;
    })
  );
}

export async function createReadyManualCardDraftsInTransaction(input: {
  tx: ManualCardDraftTx;
  userId: string;
  drafts: ReadyManualCardDraftInput[];
}): Promise<StudyManualCardDraft[]> {
  const created = await createReadyManualCardDraftRecords(input);

  return created.map((draft) => toManualCardDraft(draft));
}

export async function createReadyManualCardDrafts(input: {
  userId: string;
  drafts: ReadyManualCardDraftInput[];
}): Promise<StudyManualCardDraft[]> {
  const created = await prisma.$transaction(
    async (tx) =>
      createReadyManualCardDraftRecords({
        tx,
        userId: input.userId,
        drafts: input.drafts,
      }),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  return created.map((draft) => toManualCardDraft(draft));
}

export async function createManualCardDraft(input: {
  userId: string;
  request: StudyManualCardDraftCreateRequest;
}): Promise<StudyManualCardDraft> {
  const creationKind = parseCreationKind(input.request.creationKind);
  const requestedCardType = parseCardType(input.request.cardType);
  const cardType = cardTypeForStudyCardCreationKind(creationKind);
  validateCreationKindAndCardType({ creationKind, cardType: requestedCardType });
  const imagePlacement = parseImagePlacement(input.request.imagePlacement ?? 'none');
  const existingDraftCount = await prisma.studyCardDraft.count({
    where: { userId: input.userId },
  });
  // This is a UX cap, not a security boundary; concurrent clicks may briefly exceed it.
  if (existingDraftCount >= MAX_MANUAL_CARD_DRAFTS_PER_USER) {
    throw new AppError('Draft queue is full. Delete some drafts before adding more.', 409);
  }

  const draft = await prisma.studyCardDraft.create({
    data: {
      userId: input.userId,
      status: 'generating',
      creationKind,
      cardType,
      promptJson: toPrismaJson(input.request.prompt),
      answerJson: toPrismaJson(input.request.answer),
      imagePlacement,
      imagePrompt: input.request.imagePrompt?.trim() || null,
      previewAudioJson: toNullablePrismaJson(null),
      previewAudioRole: null,
      previewImageJson: toNullablePrismaJson(null),
      errorMessage: null,
    },
  });

  return toManualCardDraft(draft as StudyManualCardDraftRecord);
}

export async function updateManualCardDraft(input: {
  userId: string;
  draftId: string;
  request: StudyManualCardDraftUpdateRequest;
}): Promise<StudyManualCardDraft> {
  const existing = await findManualCardDraftOrThrow(input);
  if (existing.status === 'generating') {
    throw new AppError('Generating drafts cannot be edited yet.', 409);
  }

  const data: Record<string, unknown> = {};

  if (typeof input.request.prompt !== 'undefined') {
    data.promptJson = toPrismaJson(input.request.prompt);
  }
  if (typeof input.request.answer !== 'undefined') {
    data.answerJson = toPrismaJson(input.request.answer);
  }
  if (typeof input.request.imagePlacement !== 'undefined') {
    data.imagePlacement = parseImagePlacement(input.request.imagePlacement);
  }
  if (typeof input.request.imagePrompt !== 'undefined') {
    data.imagePrompt = input.request.imagePrompt?.trim() || null;
  }
  if (typeof input.request.previewAudio !== 'undefined') {
    data.previewAudioJson = toNullablePrismaJson(input.request.previewAudio);
  }
  if (typeof input.request.previewAudioRole !== 'undefined') {
    data.previewAudioRole = input.request.previewAudioRole;
  }
  if (typeof input.request.previewImage !== 'undefined') {
    data.previewImageJson = toNullablePrismaJson(input.request.previewImage);
  }

  const updated = await prisma.studyCardDraft.update({
    where: { id: input.draftId, userId: input.userId },
    data,
  });

  return toManualCardDraft(updated as StudyManualCardDraftRecord);
}

export async function resetManualCardDraftForRetry(input: {
  userId: string;
  draftId: string;
}): Promise<StudyManualCardDraft> {
  const existing = await findManualCardDraftOrThrow(input);
  if (existing.status !== 'error' && !isStaleGeneratingDraft(existing)) {
    throw new AppError('Only failed or stale generating drafts can be retried.', 409);
  }

  const updated = await prisma.studyCardDraft.update({
    where: { id: input.draftId, userId: input.userId },
    data: {
      status: 'generating',
      errorMessage: null,
      previewAudioJson: toNullablePrismaJson(null),
      previewAudioRole: null,
      previewImageJson: toNullablePrismaJson(null),
    },
  });

  return toManualCardDraft(updated as StudyManualCardDraftRecord);
}

export async function deleteManualCardDraft(input: {
  userId: string;
  draftId: string;
}): Promise<void> {
  const result = await prisma.studyCardDraft.deleteMany({
    where: { id: input.draftId, userId: input.userId },
  });
  if (result.count === 0) {
    throw new AppError('Study card draft not found.', 404);
  }
}

export async function createStudyCardFromManualDraft(input: {
  userId: string;
  draftId: string;
}): Promise<StudyManualCardDraftCreateCardResponse> {
  const draft = toManualCardDraft(await findManualCardDraftOrThrow(input));
  if (draft.status === 'generating') {
    throw new AppError('Draft is still generating.', 409);
  }

  // Failed drafts are still editable and can be submitted after the user fills any missing fields.
  const claimed = await prisma.studyCardDraft.updateMany({
    where: {
      id: input.draftId,
      userId: input.userId,
      status: { in: ['ready', 'error'] },
    },
    data: {
      status: 'generating',
      errorMessage: null,
    },
  });
  if (claimed.count === 0) {
    throw new AppError('Draft is already being processed.', 409);
  }

  const prompt =
    draft.creationKind === 'production-image' && draft.prompt.cueImage
      ? { ...draft.prompt, cueText: null }
      : draft.prompt;
  let card: StudyManualCardDraftCreateCardResponse['card'];
  try {
    card = await createManualStudyCard({
      userId: input.userId,
      creationKind: draft.creationKind,
      cardType: draft.cardType,
      prompt,
      answer: draft.answer,
      variantGroupId: draft.variantGroupId ?? null,
      variantSentenceId: draft.variantSentenceId ?? null,
      variantKind: draft.variantKind ?? null,
      variantStage: draft.variantStage ?? null,
      variantStatus: draft.variantStatus ?? null,
      variantUnlockedAt: draft.variantUnlockedAt ? new Date(draft.variantUnlockedAt) : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create study card.';
    await prisma.studyCardDraft.updateMany({
      where: { id: input.draftId, userId: input.userId },
      data: {
        status: 'error',
        errorMessage: message,
      },
    });
    throw error;
  }

  await prisma.studyCardDraft.deleteMany({ where: { id: input.draftId, userId: input.userId } });

  return {
    card,
    draftId: input.draftId,
  };
}

export async function processManualCardDraft(
  draftId: string
): Promise<StudyManualCardDraft | null> {
  // Worker jobs are scoped by draft ID; the draft's stored userId is used for downstream work.
  const existing = await prisma.studyCardDraft.findUnique({ where: { id: draftId } });
  if (!existing) return null;
  const draft = toManualCardDraft(existing as StudyManualCardDraftRecord);
  if (draft.status !== 'generating') return draft;

  try {
    const result = await completeManualStudyCardDraft({
      userId: existing.userId,
      request: {
        creationKind: draft.creationKind,
        cardType: draft.cardType,
        prompt: draft.prompt,
        answer: draft.answer,
        imagePlacement: draft.imagePlacement,
        imagePrompt: draft.imagePrompt,
      },
    });

    const updated = await prisma.studyCardDraft.update({
      where: { id: draft.id },
      data: {
        status: 'ready',
        creationKind: result.creationKind,
        cardType: result.cardType,
        promptJson: toPrismaJson(result.prompt),
        answerJson: toPrismaJson(result.answer),
        imagePlacement: result.imagePlacement,
        imagePrompt: result.imagePrompt,
        previewAudioJson: toNullablePrismaJson(result.previewAudio),
        previewAudioRole: result.previewAudioRole,
        previewImageJson: toNullablePrismaJson(result.previewImage),
        errorMessage: null,
      },
    });

    return toManualCardDraft(updated as StudyManualCardDraftRecord);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not fill the remaining fields.';
    const updated = await prisma.studyCardDraft.update({
      where: { id: draft.id },
      data: {
        status: 'error',
        errorMessage: message,
      },
    });

    return toManualCardDraft(updated as StudyManualCardDraftRecord);
  }
}
