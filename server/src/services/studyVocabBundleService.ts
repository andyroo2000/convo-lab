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
  StudyVocabBundleGenerateRequest,
  StudyVocabBundleGenerateResponse,
  StudyVocabBundleSentence,
} from '@languageflow/shared/src/types.js';

import { prisma } from '../db/client.js';
import { AppError } from '../middleware/errorHandler.js';

import { generateStudyCardCandidateJson } from './llmClient.js';
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
import { createReadyManualCardDrafts } from './study/manualCardDrafts.js';

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
  const learnerContextSummary = request.includeLearnerContext
    ? await buildLearnerContextSummary(input.userId)
    : null;
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
  const variants = [];
  for (const variant of bundle.variants) {
    variants.push({
      ...variant,
      candidate: await addPreviewAudio(input.userId, variant.candidate),
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

  const resolvedItems: Array<
    ResolvedStudyCardCandidateCommitItem & {
      stage: number;
      variantKind: StudyVocabBundleCommitVariant['variantKind'];
      variantSentenceOrdinal: number | null;
    }
  > = [];
  for (const variant of input.request.variants) {
    resolvedItems.push({
      ...(await resolveStudyCardCandidateCommitItem({
        userId: input.userId,
        item: variant.candidate,
      })),
      stage: variant.stage,
      variantKind: variant.variantKind,
      variantSentenceOrdinal: variant.variantSentenceOrdinal ?? null,
    });
  }

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

  const group = await prisma.studyVariantGroup.create({
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

  const drafts = await createReadyManualCardDrafts({
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

  return {
    groupId: group.id,
    drafts,
  };
}
