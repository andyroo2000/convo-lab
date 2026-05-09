import { selectManualStudyCardDefaultVoiceId } from '@languageflow/shared/src/constants-new.js';
import {
  STUDY_CANDIDATE_CONTEXT_MAX_LENGTH,
  STUDY_CANDIDATE_TARGET_MAX_LENGTH,
  STUDY_VOCAB_BUNDLE_CARD_COUNT,
  STUDY_VOCAB_BUNDLE_SENTENCE_COUNT,
} from '@languageflow/shared/src/studyConstants.js';
import type {
  StudyCardCreationKind,
  StudyMediaRef,
  StudyVocabBundleCommitRequest,
  StudyVocabBundleCommitVariant,
  StudyVocabBundleCommitResponse,
  StudyVocabBundleDraftCreateResponse,
  StudyVocabBundleGenerateRequest,
  StudyVocabBundleGenerateResponse,
  StudyVocabBundleSentence,
  StudyVocabVariantKind,
  StudyVocabVariantStatus,
} from '@languageflow/shared/src/types.js';
import { Prisma } from '@prisma/client';

import { prisma } from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';

import { generateStudyCardCandidateJson } from './llmClient.js';
import { logger } from './logger.js';
import {
  resolveStudyCardCandidateCommitItem,
  type ResolvedStudyCardCandidateCommitItem,
} from './study/candidates/candidateCommit.js';
import { buildLearnerContextSummary } from './study/candidates/learnerContext.js';
import { scheduleStudyCandidatePreviewMediaCleanup } from './study/candidates/mediaCleanup.js';
import { addPreviewAudio, getOwnedPreviewMediaIds } from './study/candidates/previewMedia.js';
import {
  normalizeVocabBundleGenerateRequest,
  parseVocabBundleResponse,
} from './study/candidates/vocab/parser.js';
import {
  buildVocabBundleSystemInstruction,
  buildVocabBundleUserPrompt,
} from './study/candidates/vocab/promptBuilder.js';
import {
  createGeneratingManualCardDraftsInTransaction,
  createReadyManualCardDraftsInTransaction,
} from './study/manualCardDrafts.js';
import { toNullablePrismaJson, toPrismaJson } from './study/shared.js';
import {
  STUDY_VOCAB_VARIANT_KINDS_BY_STAGE,
  STUDY_VOCAB_VARIANT_STAGES,
} from './study/variants/constants.js';

const VOCAB_BUNDLE_DRAFT_MISMATCH_ERROR =
  'Generated vocab bundle did not match queued draft placeholders.';
const VOCAB_BUNDLE_DRAFT_GENERATION_ERROR =
  'Could not generate this vocab bundle. Please retry or edit the drafts manually.';

export class VocabBundleDraftMismatchError extends Error {
  constructor() {
    super(VOCAB_BUNDLE_DRAFT_MISMATCH_ERROR);
    this.name = 'VocabBundleDraftMismatchError';
  }
}

function assertBoundedText(name: string, value: string, max: number): void {
  if (!value.trim()) {
    throw new AppError(`${name} is required.`, 400);
  }
  if (value.length > max) {
    throw new AppError(`${name} must be ${String(max)} characters or fewer.`, 400);
  }
}

function validateSentences(sentences: StudyVocabBundleSentence[]): void {
  if (!Array.isArray(sentences) || sentences.length !== STUDY_VOCAB_BUNDLE_SENTENCE_COUNT) {
    throw new AppError('Vocab bundles must include exactly three sentences.', 400);
  }

  const ordinals = new Set(sentences.map((sentence) => sentence.ordinal));
  for (let ordinal = 0; ordinal < STUDY_VOCAB_BUNDLE_SENTENCE_COUNT; ordinal += 1) {
    if (!ordinals.has(ordinal)) {
      throw new AppError('Vocab bundle sentence ordinals must be 0, 1, and 2.', 400);
    }
  }
}

function creationKindForCandidateKind(candidateKind: string): StudyCardCreationKind {
  if (candidateKind === 'audio-recognition') return 'audio-recognition';
  if (candidateKind === 'text-recognition') return 'text-recognition';
  if (candidateKind === 'cloze') return 'cloze';
  return 'production-text';
}

function getResolvedPreviewAudio(
  resolved: ResolvedStudyCardCandidateCommitItem
): StudyMediaRef | null {
  if (resolved.previewAudioRole === 'prompt') {
    return resolved.prompt.cueAudio ?? resolved.answer.answerAudio ?? null;
  }
  if (resolved.previewAudioRole === 'answer') {
    return resolved.answer.answerAudio ?? resolved.prompt.cueAudio ?? null;
  }
  return resolved.prompt.cueAudio ?? resolved.answer.answerAudio ?? null;
}

function getResolvedPreviewImage(
  resolved: ResolvedStudyCardCandidateCommitItem
): StudyMediaRef | null {
  return (
    resolved.item.previewImage ?? resolved.prompt.cueImage ?? resolved.answer.answerImage ?? null
  );
}

function placeholderDraftForVariant(input: {
  targetWord: string;
  stage: number;
  variantKind: StudyVocabVariantKind;
  sentenceId: string | null;
  sentenceOrdinal: number | null;
}) {
  const answerAudioVoiceId = selectManualStudyCardDefaultVoiceId();
  const variantStatus: StudyVocabVariantStatus =
    input.stage === STUDY_VOCAB_VARIANT_STAGES.sentenceAudio ? 'available' : 'locked';
  const suffix =
    typeof input.sentenceOrdinal === 'number' ? ` ${String(input.sentenceOrdinal + 1)}` : '';
  const sentenceLabel = `Generating sentence${suffix} for ${input.targetWord}`;

  if (input.variantKind === 'sentence_audio_recognition') {
    return {
      creationKind: 'audio-recognition' as const,
      cardType: 'recognition' as const,
      prompt: {},
      answer: { expression: sentenceLabel, meaning: '', answerAudioVoiceId },
      imagePlacement: 'none' as const,
      imagePrompt: null,
      variantSentenceId: input.sentenceId,
      variantKind: input.variantKind,
      variantStage: input.stage,
      variantStatus,
      variantUnlockedAt: new Date(),
    };
  }

  if (input.variantKind === 'sentence_text_recognition') {
    return {
      creationKind: 'text-recognition' as const,
      cardType: 'recognition' as const,
      prompt: { cueText: sentenceLabel },
      answer: { expression: sentenceLabel, meaning: '', answerAudioVoiceId },
      imagePlacement: 'none' as const,
      imagePrompt: null,
      variantSentenceId: input.sentenceId,
      variantKind: input.variantKind,
      variantStage: input.stage,
      variantStatus,
      variantUnlockedAt: null,
    };
  }

  if (input.variantKind === 'word_audio_recognition') {
    return {
      creationKind: 'audio-recognition' as const,
      cardType: 'recognition' as const,
      prompt: {},
      answer: { expression: input.targetWord, meaning: '', answerAudioVoiceId },
      imagePlacement: 'none' as const,
      imagePrompt: null,
      variantSentenceId: null,
      variantKind: input.variantKind,
      variantStage: input.stage,
      variantStatus,
      variantUnlockedAt: null,
    };
  }

  if (input.variantKind === 'word_text_recognition') {
    return {
      creationKind: 'text-recognition' as const,
      cardType: 'recognition' as const,
      prompt: { cueText: input.targetWord },
      answer: { expression: input.targetWord, meaning: '', answerAudioVoiceId },
      imagePlacement: 'none' as const,
      imagePrompt: null,
      variantSentenceId: null,
      variantKind: input.variantKind,
      variantStage: input.stage,
      variantStatus,
      variantUnlockedAt: null,
    };
  }

  return {
    creationKind: 'cloze' as const,
    cardType: 'cloze' as const,
    prompt: { clozeText: sentenceLabel, clozeHint: '' },
    answer: { restoredText: sentenceLabel, meaning: '', answerAudioVoiceId },
    imagePlacement: 'none' as const,
    imagePrompt: null,
    variantSentenceId: input.sentenceId,
    variantKind: input.variantKind,
    variantStage: input.stage,
    variantStatus,
    variantUnlockedAt: null,
  };
}

function orderedPlaceholderVariants() {
  return [
    ...[0, 1, 2].map((ordinal) => ({
      stage: STUDY_VOCAB_VARIANT_STAGES.sentenceAudio,
      variantKind: 'sentence_audio_recognition' as const,
      sentenceOrdinal: ordinal,
    })),
    ...[0, 1, 2].map((ordinal) => ({
      stage: STUDY_VOCAB_VARIANT_STAGES.sentenceText,
      variantKind: 'sentence_text_recognition' as const,
      sentenceOrdinal: ordinal,
    })),
    {
      stage: STUDY_VOCAB_VARIANT_STAGES.wordAudio,
      variantKind: 'word_audio_recognition' as const,
      sentenceOrdinal: null,
    },
    {
      stage: STUDY_VOCAB_VARIANT_STAGES.wordText,
      variantKind: 'word_text_recognition' as const,
      sentenceOrdinal: null,
    },
    ...[0, 1, 2].map((ordinal) => ({
      stage: STUDY_VOCAB_VARIANT_STAGES.sentenceCloze,
      variantKind: 'sentence_cloze' as const,
      sentenceOrdinal: ordinal,
    })),
  ];
}

async function buildOptionalLearnerContextSummary(
  userId: string,
  includeLearnerContext: boolean
): Promise<string | null> {
  if (!includeLearnerContext) return null;
  try {
    return await buildLearnerContextSummary(userId);
  } catch (error) {
    logger.warn(
      '[StudyVocabBundle] Failed to build learner context; continuing without it.',
      error
    );
  }
  return null;
}

function expectedCandidateKindForVariant(
  variantKind: StudyVocabBundleCommitVariant['variantKind']
): StudyVocabBundleCommitVariant['candidate']['candidateKind'] {
  if (variantKind === 'sentence_audio_recognition' || variantKind === 'word_audio_recognition') {
    return 'audio-recognition';
  }
  if (variantKind === 'sentence_text_recognition' || variantKind === 'word_text_recognition') {
    return 'text-recognition';
  }
  return 'cloze';
}

function expectedVariantKeys(): Set<string> {
  const keys = new Set<string>();
  for (let ordinal = 0; ordinal < STUDY_VOCAB_BUNDLE_SENTENCE_COUNT; ordinal += 1) {
    keys.add(`${String(STUDY_VOCAB_VARIANT_STAGES.sentenceAudio)}:${String(ordinal)}`);
    keys.add(`${String(STUDY_VOCAB_VARIANT_STAGES.sentenceText)}:${String(ordinal)}`);
    keys.add(`${String(STUDY_VOCAB_VARIANT_STAGES.sentenceCloze)}:${String(ordinal)}`);
  }
  keys.add(`${String(STUDY_VOCAB_VARIANT_STAGES.wordAudio)}:word`);
  keys.add(`${String(STUDY_VOCAB_VARIANT_STAGES.wordText)}:word`);
  return keys;
}

function userFacingVocabBundleDraftErrorMessage(error: unknown): string {
  if (error instanceof AppError && error.statusCode < 500) {
    return error.message;
  }
  return VOCAB_BUNDLE_DRAFT_GENERATION_ERROR;
}

function validateCommitVariants(variants: StudyVocabBundleCommitVariant[]): void {
  const expectedKeys = expectedVariantKeys();
  const seenKeys = new Set<string>();

  for (const variant of variants) {
    if (!Number.isInteger(variant.stage)) {
      throw new AppError('Vocab variant stage must be an integer.', 400);
    }
    const expectedKind = STUDY_VOCAB_VARIANT_KINDS_BY_STAGE[variant.stage];
    if (!expectedKind || variant.variantKind !== expectedKind) {
      throw new AppError('Vocab variant kind does not match its stage.', 400);
    }
    if (variant.candidate.candidateKind !== expectedCandidateKindForVariant(variant.variantKind)) {
      throw new AppError('Vocab variant candidate kind does not match its stage.', 400);
    }

    const isSentenceStage =
      variant.stage === STUDY_VOCAB_VARIANT_STAGES.sentenceAudio ||
      variant.stage === STUDY_VOCAB_VARIANT_STAGES.sentenceText ||
      variant.stage === STUDY_VOCAB_VARIANT_STAGES.sentenceCloze;
    const ordinal = variant.variantSentenceOrdinal ?? null;
    if (isSentenceStage) {
      if (
        typeof ordinal !== 'number' ||
        !Number.isInteger(ordinal) ||
        ordinal < 0 ||
        ordinal >= STUDY_VOCAB_BUNDLE_SENTENCE_COUNT
      ) {
        throw new AppError(
          'Sentence vocab variants must reference sentence ordinal 0, 1, or 2.',
          400
        );
      }
    } else if (ordinal !== null) {
      throw new AppError('Word vocab variants must not reference a sentence ordinal.', 400);
    }

    const key = `${String(variant.stage)}:${isSentenceStage ? String(ordinal) : 'word'}`;
    if (!expectedKeys.has(key) || seenKeys.has(key)) {
      throw new AppError('Vocab bundle variants must contain the expected staged cards once.', 400);
    }
    seenKeys.add(key);
  }

  if (seenKeys.size !== expectedKeys.size) {
    throw new AppError('Vocab bundle variants must contain the expected staged cards once.', 400);
  }
}

export async function generateStudyVocabBundle(input: {
  userId: string;
  request: StudyVocabBundleGenerateRequest;
}): Promise<StudyVocabBundleGenerateResponse> {
  const request = normalizeVocabBundleGenerateRequest(input.request);
  assertBoundedText('targetWord', request.targetWord, STUDY_CANDIDATE_TARGET_MAX_LENGTH);
  if (request.context.length > STUDY_CANDIDATE_CONTEXT_MAX_LENGTH) {
    throw new AppError(
      `context must be ${String(STUDY_CANDIDATE_CONTEXT_MAX_LENGTH)} characters or fewer.`,
      400
    );
  }
  if (request.sourceSentence && request.sourceSentence.length > STUDY_CANDIDATE_TARGET_MAX_LENGTH) {
    throw new AppError(
      `sourceSentence must be ${String(STUDY_CANDIDATE_TARGET_MAX_LENGTH)} characters or fewer.`,
      400
    );
  }

  void scheduleStudyCandidatePreviewMediaCleanup(input.userId);
  const learnerContextSummary = await buildOptionalLearnerContextSummary(
    input.userId,
    request.includeLearnerContext
  );
  const rawResponse = await generateStudyCardCandidateJson(
    buildVocabBundleUserPrompt({
      targetWord: request.targetWord,
      sourceSentence: request.sourceSentence,
      context: request.context,
      learnerContextSummary,
    }),
    buildVocabBundleSystemInstruction()
  );
  const bundle = await parseVocabBundleResponse({
    response: rawResponse,
    targetWord: request.targetWord,
    sourceSentence: request.sourceSentence,
    context: request.context,
  });
  const variants = await Promise.all(
    bundle.variants.map(async (variant) => ({
      ...variant,
      candidate: await addPreviewAudio(input.userId, variant.candidate),
    }))
  );

  return {
    bundle: {
      ...bundle,
      variants,
    },
    learnerContextSummary,
  };
}

export async function createStudyVocabBundleDrafts(input: {
  userId: string;
  request: StudyVocabBundleGenerateRequest;
}): Promise<StudyVocabBundleDraftCreateResponse> {
  const request = normalizeVocabBundleGenerateRequest(input.request);
  assertBoundedText('targetWord', request.targetWord, STUDY_CANDIDATE_TARGET_MAX_LENGTH);
  if (request.context.length > STUDY_CANDIDATE_CONTEXT_MAX_LENGTH) {
    throw new AppError(
      `context must be ${String(STUDY_CANDIDATE_CONTEXT_MAX_LENGTH)} characters or fewer.`,
      400
    );
  }
  if (request.sourceSentence && request.sourceSentence.length > STUDY_CANDIDATE_TARGET_MAX_LENGTH) {
    throw new AppError(
      `sourceSentence must be ${String(STUDY_CANDIDATE_TARGET_MAX_LENGTH)} characters or fewer.`,
      400
    );
  }

  const { group, drafts } = await prisma.$transaction(
    async (tx) => {
      const group = await tx.studyVariantGroup.create({
        data: {
          userId: input.userId,
          targetWord: request.targetWord,
          sourceSentence: request.sourceSentence,
          sourceContext: request.context || null,
          includeLearnerContext: request.includeLearnerContext,
          sentences: {
            create: [0, 1, 2].map((ordinal) => ({
              userId: input.userId,
              ordinal,
              sentenceJp:
                ordinal === 0 && request.sourceSentence
                  ? request.sourceSentence
                  : `Generating sentence ${String(ordinal + 1)} for ${request.targetWord}`,
              sentenceReading: null,
              sentenceEn: '',
              notes: null,
            })),
          },
        },
        include: { sentences: true },
      });
      const sentenceIdsByOrdinal = new Map(
        group.sentences.map((sentence) => [sentence.ordinal, sentence.id])
      );

      const drafts = await createGeneratingManualCardDraftsInTransaction({
        tx,
        userId: input.userId,
        drafts: orderedPlaceholderVariants().map((variant) => {
          const sentenceId =
            typeof variant.sentenceOrdinal === 'number'
              ? (sentenceIdsByOrdinal.get(variant.sentenceOrdinal) ?? null)
              : null;
          return {
            ...placeholderDraftForVariant({
              targetWord: request.targetWord,
              stage: variant.stage,
              variantKind: variant.variantKind,
              sentenceId,
              sentenceOrdinal: variant.sentenceOrdinal,
            }),
            variantGroupId: group.id,
          };
        }),
      });

      return { group, drafts };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  return {
    groupId: group.id,
    drafts,
  };
}

export async function processStudyVocabBundleDrafts(
  groupId: string,
  options: { markDraftsOnError?: boolean } = {}
): Promise<{ groupId: string; completedDraftCount: number } | null> {
  const group = await prisma.studyVariantGroup.findUnique({
    where: { id: groupId },
    include: {
      sentences: true,
      drafts: true,
    },
  });
  if (!group) return null;

  const generatingDrafts = group.drafts.filter((draft) => draft.status === 'generating');
  if (generatingDrafts.length === 0) {
    return {
      groupId: group.id,
      completedDraftCount: 0,
    };
  }

  try {
    const generated = await generateStudyVocabBundle({
      userId: group.userId,
      request: {
        targetWord: group.targetWord,
        sourceSentence: group.sourceSentence,
        context: group.sourceContext,
        includeLearnerContext: group.includeLearnerContext,
      },
    });
    const bundle = generated.bundle;
    const resolvedItems = await Promise.all(
      bundle.variants.map(async (variant) => ({
        ...(await resolveStudyCardCandidateCommitItem({
          userId: group.userId,
          item: variant.candidate,
        })),
        stage: variant.stage,
        variantKind: variant.variantKind,
        variantSentenceOrdinal: variant.variantSentenceOrdinal ?? null,
      }))
    );

    const previewAudioIds = resolvedItems.flatMap((item) =>
      item.previewAudioId ? [item.previewAudioId] : []
    );
    const previewImageIds = resolvedItems.flatMap((item) =>
      item.previewImageId ? [item.previewImageId] : []
    );
    const [ownedPreviewAudioIds, ownedPreviewImageIds] = await Promise.all([
      getOwnedPreviewMediaIds({
        userId: group.userId,
        mediaIds: previewAudioIds,
        mediaKind: 'audio',
        errorMessage: 'Preview audio was not found for this user.',
      }),
      getOwnedPreviewMediaIds({
        userId: group.userId,
        mediaIds: previewImageIds,
        mediaKind: 'image',
        errorMessage: 'Preview image was not found for this user.',
      }),
    ]);

    const updatedDrafts = await prisma.$transaction(async (tx) => {
      await tx.studyVariantGroup.update({
        where: { id: group.id },
        data: {
          targetWord: bundle.targetWord,
          targetReading: bundle.targetReading ?? null,
          targetMeaning: bundle.targetMeaning ?? null,
          sourceSentence: bundle.sourceSentence ?? null,
          sourceContext: bundle.sourceContext ?? null,
        },
      });

      const currentSentences = await tx.studyVariantSentence.findMany({
        where: { variantGroupId: group.id },
      });
      const sentenceIdsByOrdinal = new Map(
        currentSentences.map((sentence) => [sentence.ordinal, sentence.id])
      );
      await Promise.all(
        bundle.sentences.map((sentence) => {
          const sentenceId = sentenceIdsByOrdinal.get(sentence.ordinal);
          if (!sentenceId) return Promise.resolve(null);
          return tx.studyVariantSentence.update({
            where: { id: sentenceId },
            data: {
              sentenceJp: sentence.sentenceJp,
              sentenceReading: sentence.sentenceReading ?? null,
              sentenceEn: sentence.sentenceEn,
              notes: sentence.notes ?? null,
            },
          });
        })
      );

      const currentDrafts = await tx.studyCardDraft.findMany({
        where: { variantGroupId: group.id, userId: group.userId },
      });
      if (resolvedItems.length !== currentDrafts.length) {
        throw new VocabBundleDraftMismatchError();
      }
      const draftsByKey = new Map(
        currentDrafts.map((draft) => [
          `${String(draft.variantStage)}:${draft.variantSentenceId ?? 'word'}`,
          draft,
        ])
      );
      if (draftsByKey.size !== currentDrafts.length) {
        throw new VocabBundleDraftMismatchError();
      }
      const seenResolvedKeys = new Set<string>();
      const resolvedDraftInputs = resolvedItems.map((resolved) => {
        const sentenceId =
          typeof resolved.variantSentenceOrdinal === 'number'
            ? (sentenceIdsByOrdinal.get(resolved.variantSentenceOrdinal) ?? null)
            : null;
        const key = `${String(resolved.stage)}:${sentenceId ?? 'word'}`;
        if (seenResolvedKeys.has(key)) {
          throw new VocabBundleDraftMismatchError();
        }
        seenResolvedKeys.add(key);
        return { key, resolved };
      });
      const updated = await Promise.all(
        resolvedDraftInputs.map(async ({ key, resolved }) => {
          const draft = draftsByKey.get(key);
          if (!draft) {
            throw new VocabBundleDraftMismatchError();
          }

          const previewAudio =
            resolved.previewAudioId && ownedPreviewAudioIds.has(resolved.previewAudioId)
              ? getResolvedPreviewAudio(resolved)
              : null;
          const previewImage =
            resolved.previewImageId && ownedPreviewImageIds.has(resolved.previewImageId)
              ? getResolvedPreviewImage(resolved)
              : null;
          const imagePlacement =
            previewImage && resolved.item.cardType === 'cloze'
              ? 'both'
              : previewImage
                ? 'prompt'
                : 'none';
          const imagePrompt = previewImage ? (resolved.item.imagePrompt ?? null) : null;
          const variantStatus = resolved.stage === 1 ? 'available' : 'locked';

          return tx.studyCardDraft.update({
            where: { id: draft.id },
            data: {
              status: 'ready',
              creationKind: creationKindForCandidateKind(resolved.item.candidateKind),
              cardType: resolved.item.cardType,
              promptJson: toPrismaJson(resolved.prompt),
              answerJson: toPrismaJson(resolved.answer),
              imagePlacement,
              imagePrompt,
              previewAudioJson: toNullablePrismaJson(previewAudio),
              previewAudioRole: resolved.previewAudioRole,
              previewImageJson: toNullablePrismaJson(previewImage),
              variantKind: resolved.variantKind,
              variantStage: resolved.stage,
              variantStatus,
              variantUnlockedAt: variantStatus === 'available' ? new Date() : null,
              errorMessage: null,
            },
          });
        })
      );

      return updated;
    });

    return {
      groupId: group.id,
      completedDraftCount: updatedDrafts.length,
    };
  } catch (error) {
    logger.warn('[StudyVocabBundle] Failed to process vocab bundle drafts.', error);
    // Direct service calls default to persisting final errors; queue retries opt out until the last attempt.
    const shouldMarkDraftsOnError = options.markDraftsOnError ?? true;
    const isNonRetryableDraftMismatch = error instanceof VocabBundleDraftMismatchError;
    if (shouldMarkDraftsOnError || isNonRetryableDraftMismatch) {
      await prisma.studyCardDraft.updateMany({
        where: { variantGroupId: group.id, userId: group.userId, status: 'generating' },
        data: {
          status: 'error',
          errorMessage: userFacingVocabBundleDraftErrorMessage(error),
        },
      });
    }
    throw error;
  }
}

export async function commitStudyVocabBundle(input: {
  userId: string;
  request: StudyVocabBundleCommitRequest;
}): Promise<StudyVocabBundleCommitResponse> {
  assertBoundedText('targetWord', input.request.targetWord, STUDY_CANDIDATE_TARGET_MAX_LENGTH);
  validateSentences(input.request.sentences);
  if (
    !Array.isArray(input.request.variants) ||
    input.request.variants.length !== STUDY_VOCAB_BUNDLE_CARD_COUNT
  ) {
    throw new AppError('Vocab bundles must include eleven card variants.', 400);
  }
  validateCommitVariants(input.request.variants);

  const resolvedItems = await Promise.all(
    input.request.variants.map(async (variant) => ({
      ...(await resolveStudyCardCandidateCommitItem({
        userId: input.userId,
        item: variant.candidate,
      })),
      stage: variant.stage,
      variantKind: variant.variantKind,
      variantSentenceOrdinal: variant.variantSentenceOrdinal ?? null,
    }))
  );

  const previewAudioIds = resolvedItems.flatMap((item) =>
    item.previewAudioId ? [item.previewAudioId] : []
  );
  const previewImageIds = resolvedItems.flatMap((item) =>
    item.previewImageId ? [item.previewImageId] : []
  );
  const [ownedPreviewAudioIds, ownedPreviewImageIds] = await Promise.all([
    getOwnedPreviewMediaIds({
      userId: input.userId,
      mediaIds: previewAudioIds,
      mediaKind: 'audio',
      errorMessage: 'Preview audio was not found for this user.',
    }),
    getOwnedPreviewMediaIds({
      userId: input.userId,
      mediaIds: previewImageIds,
      mediaKind: 'image',
      errorMessage: 'Preview image was not found for this user.',
    }),
  ]);

  const { group, drafts } = await prisma.$transaction(
    async (tx) => {
      const group = await tx.studyVariantGroup.create({
        data: {
          userId: input.userId,
          targetWord: input.request.targetWord,
          targetReading: input.request.targetReading ?? null,
          targetMeaning: input.request.targetMeaning ?? null,
          sourceSentence: input.request.sourceSentence ?? null,
          sourceContext: input.request.sourceContext ?? null,
          sentences: {
            create: input.request.sentences.map((sentence) => ({
              userId: input.userId,
              ordinal: sentence.ordinal,
              sentenceJp: sentence.sentenceJp,
              sentenceReading: sentence.sentenceReading ?? null,
              sentenceEn: sentence.sentenceEn,
              notes: sentence.notes ?? null,
            })),
          },
        },
        include: {
          sentences: true,
        },
      });
      const sentencesByOrdinal = new Map(
        group.sentences.map((sentence) => [sentence.ordinal, sentence.id])
      );

      const drafts = await createReadyManualCardDraftsInTransaction({
        tx,
        userId: input.userId,
        drafts: resolvedItems.map((resolved) => {
          const previewAudio =
            resolved.previewAudioId && ownedPreviewAudioIds.has(resolved.previewAudioId)
              ? getResolvedPreviewAudio(resolved)
              : null;
          const previewImage =
            resolved.previewImageId && ownedPreviewImageIds.has(resolved.previewImageId)
              ? getResolvedPreviewImage(resolved)
              : null;
          const imagePlacement =
            previewImage && resolved.item.cardType === 'cloze'
              ? 'both'
              : previewImage
                ? 'prompt'
                : 'none';
          const imagePrompt = previewImage ? (resolved.item.imagePrompt ?? null) : null;
          const creationKind = creationKindForCandidateKind(resolved.item.candidateKind);
          const sentenceId =
            typeof resolved.variantSentenceOrdinal === 'number'
              ? (sentencesByOrdinal.get(resolved.variantSentenceOrdinal) ?? null)
              : null;
          const variantStatus = resolved.stage === 1 ? 'available' : 'locked';

          return {
            creationKind,
            cardType: resolved.item.cardType,
            prompt: resolved.prompt,
            answer: resolved.answer,
            imagePlacement,
            imagePrompt,
            previewAudio,
            previewAudioRole: resolved.previewAudioRole,
            previewImage,
            variantGroupId: group.id,
            variantSentenceId: sentenceId,
            variantKind: resolved.variantKind,
            variantStage: resolved.stage,
            variantStatus,
            variantUnlockedAt: variantStatus === 'available' ? new Date() : null,
          };
        }),
      });

      return { group, drafts };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  return {
    groupId: group.id,
    drafts,
  };
}
