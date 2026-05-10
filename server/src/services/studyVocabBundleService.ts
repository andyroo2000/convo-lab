import { selectManualStudyCardDefaultVoiceId } from '@languageflow/shared/src/constants-new.js';
import {
  STUDY_CANDIDATE_CONTEXT_MAX_LENGTH,
  STUDY_CANDIDATE_TARGET_MAX_LENGTH,
} from '@languageflow/shared/src/studyConstants.js';
import type {
  StudyCardCandidate,
  StudyCardCreationKind,
  StudyMediaRef,
  StudyVocabBundleDraftCreateResponse,
  StudyVocabBundleGenerateRequest,
  StudyVocabBundleGenerateResponse,
  StudyVocabVariantKind,
  StudyVocabVariantStatus,
} from '@languageflow/shared/src/types.js';
import { type StudyCardDraft as PrismaStudyCardDraft } from '@prisma/client';

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
import {
  addPreviewAudio,
  generateCandidatePreviewImage,
  getOwnedPreviewMediaIds,
} from './study/candidates/previewMedia.js';
import {
  normalizeVocabBundleGenerateRequest,
  parseVocabBundleResponse,
} from './study/candidates/vocab/parser.js';
import {
  buildVocabBundleSystemInstruction,
  buildVocabBundleUserPrompt,
} from './study/candidates/vocab/promptBuilder.js';
import { createGeneratingManualCardDraftsInTransaction } from './study/manualCardDrafts.js';
import { toNullablePrismaJson, toPrismaJson } from './study/shared.js';
import { STUDY_VOCAB_VARIANT_STAGES } from './study/variants/constants.js';

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

function userFacingVocabBundleDraftErrorMessage(error: unknown): string {
  if (error instanceof AppError && error.statusCode < 500) {
    return error.message;
  }
  return VOCAB_BUNDLE_DRAFT_GENERATION_ERROR;
}

async function addVocabBundlePreviewImage(
  userId: string,
  candidate: StudyCardCandidate
): Promise<StudyCardCandidate> {
  if (candidate.candidateKind !== 'cloze' || !candidate.imagePrompt?.trim()) {
    return candidate;
  }

  try {
    return {
      ...candidate,
      previewImage: await generateCandidatePreviewImage({
        userId,
        clientId: candidate.clientId,
        imagePrompt: candidate.imagePrompt,
      }),
    };
  } catch (error) {
    logger.warn('[StudyVocabBundle] Failed to generate cloze preview image.', {
      error,
      clientId: candidate.clientId,
      userId,
    });
    return candidate;
  }
}

async function generateStudyVocabBundle(input: {
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
  const variantsWithAudio = await Promise.all(
    bundle.variants.map(async (variant) => ({
      ...variant,
      candidate: await addPreviewAudio(input.userId, variant.candidate),
    }))
  );
  const variants: typeof variantsWithAudio = [];
  for (const variant of variantsWithAudio) {
    // Keep the TTS previews parallel above, but serialize image generation to avoid
    // fanning out several heavier image requests from one vocab bundle job.
    variants.push({
      ...variant,
      candidate: await addVocabBundlePreviewImage(input.userId, variant.candidate),
    });
  }

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
    { isolationLevel: 'Serializable' }
  );

  return {
    groupId: group.id,
    drafts,
  };
}

/**
 * Queue callers pass markDraftsOnError=false until the final BullMQ attempt.
 * Direct calls default to writing draft errors immediately so failures are visible.
 */
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
      for (const sentence of bundle.sentences) {
        const sentenceId = sentenceIdsByOrdinal.get(sentence.ordinal);
        if (!sentenceId) continue;
        await tx.studyVariantSentence.update({
          where: { id: sentenceId },
          data: {
            sentenceJp: sentence.sentenceJp,
            sentenceReading: sentence.sentenceReading ?? null,
            sentenceEn: sentence.sentenceEn,
            notes: sentence.notes ?? null,
          },
        });
      }

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
        // Draft-key checks above catch duplicate placeholders; this catches duplicate generated items.
        if (seenResolvedKeys.has(key)) {
          throw new VocabBundleDraftMismatchError();
        }
        seenResolvedKeys.add(key);
        return { key, resolved };
      });
      const updated: PrismaStudyCardDraft[] = [];
      for (const { key, resolved } of resolvedDraftInputs) {
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
        const clozeImagePrompt =
          resolved.item.cardType === 'cloze' ? (resolved.item.imagePrompt?.trim() ?? null) : null;
        const imagePlacement =
          resolved.item.cardType === 'cloze' && (previewImage || clozeImagePrompt)
            ? 'both'
            : previewImage
              ? 'prompt'
              : 'none';
        // Cloze drafts keep a prompt even if auto-generation failed so users can retry manually.
        // Other card types keep the historical behavior: only persist a prompt alongside an image.
        const imagePrompt = clozeImagePrompt
          ? clozeImagePrompt
          : previewImage
            ? (resolved.item.imagePrompt ?? null)
            : null;
        const variantStatus = resolved.stage === 1 ? 'available' : 'locked';

        updated.push(
          await tx.studyCardDraft.update({
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
          })
        );
      }

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
      // Mismatches throw inside the interactive transaction; Prisma rolls that back before this
      // catch runs, so draft errors are intentionally written in a separate update.
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
