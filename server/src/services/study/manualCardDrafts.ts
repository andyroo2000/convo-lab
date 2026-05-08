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
} from '@languageflow/shared/src/types.js';

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
const MAX_MANUAL_CARD_DRAFTS_PER_USER = 50;
// Keep the read limit higher than the creation cap so older over-limit queues remain visible.
const MANUAL_CARD_DRAFT_LIST_LIMIT = 100;
const STALE_GENERATING_DRAFT_RETRY_AFTER_MS = 10 * 60 * 1000;

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
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

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
    errorMessage: record.errorMessage,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
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

export async function listManualCardDrafts(userId: string): Promise<StudyManualCardDraft[]> {
  const drafts = await prisma.studyCardDraft.findMany({
    where: { userId },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: MANUAL_CARD_DRAFT_LIST_LIMIT,
  });
  return drafts.map((draft) => toManualCardDraft(draft as StudyManualCardDraftRecord));
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
