import { STUDY_CANDIDATE_COMMIT_MAX_COUNT } from '@languageflow/shared/src/studyConstants.js';
import type {
  StudyAnswerPayload,
  StudyCardCandidateCommitItem,
  StudyCardCandidateCommitResponse,
  StudyPromptPayload,
} from '@languageflow/shared/src/types.js';

import { AppError } from '../../../middleware/errorHandler.js';
import { createStudyCard } from '../../studySchedulerService.js';
import { cardTypeForStudyCardCandidateKind, STUDY_CARD_CANDIDATE_KINDS } from '../shared.js';

import {
  getCandidatePreviewAudioText,
  getOwnedPreviewMediaIds,
  synthesizeCandidatePreviewAudio,
} from './previewMedia.js';

type ResolvedStudyCardCandidateCommitItem = {
  item: StudyCardCandidateCommitItem;
  prompt: StudyPromptPayload;
  answer: StudyAnswerPayload;
  previewAudioId: string | null;
  previewAudioRole: 'prompt' | 'answer' | null;
  previewImageId: string | null;
};

async function resolveStudyCardCandidateCommitItem(input: {
  userId: string;
  item: StudyCardCandidateCommitItem;
}): Promise<ResolvedStudyCardCandidateCommitItem> {
  const { item } = input;
  if (!STUDY_CARD_CANDIDATE_KINDS.has(item.candidateKind)) {
    throw new AppError('candidateKind must be a supported generated card kind.', 400);
  }

  const expectedCardType = cardTypeForStudyCardCandidateKind(item.candidateKind);
  if (item.cardType !== expectedCardType) {
    throw new AppError('cardType does not match candidateKind.', 400);
  }

  let resolvedPrompt = item.prompt;
  let resolvedAnswer = item.answer;
  let resolvedPreviewAudio = item.previewAudio ?? null;
  let resolvedPreviewAudioRole = item.previewAudioRole;
  if (!resolvedPreviewAudio && getCandidatePreviewAudioText(item)) {
    const regeneratedPreview = await synthesizeCandidatePreviewAudio(input.userId, {
      clientId: item.clientId,
      candidateKind: item.candidateKind,
      cardType: item.cardType,
      prompt: resolvedPrompt,
      answer: resolvedAnswer,
      rationale:
        item.candidateKind === 'audio-recognition'
          ? 'Regenerated listening prompt audio.'
          : 'Regenerated answer audio.',
    });
    resolvedPreviewAudio = regeneratedPreview;
    resolvedPreviewAudioRole = item.candidateKind === 'audio-recognition' ? 'prompt' : 'answer';
    if (regeneratedPreview) {
      if (item.candidateKind === 'audio-recognition') {
        resolvedPrompt = { ...resolvedPrompt, cueAudio: regeneratedPreview };
      } else {
        resolvedAnswer = { ...resolvedAnswer, answerAudio: regeneratedPreview };
      }
    }
  }

  return {
    item,
    prompt: resolvedPrompt,
    answer: resolvedAnswer,
    previewAudioId: resolvedPreviewAudio?.id ?? null,
    previewAudioRole: resolvedPreviewAudioRole ?? null,
    previewImageId: item.previewImage?.id ?? item.prompt.cueImage?.id ?? null,
  };
}

export async function commitStudyCardCandidates(input: {
  userId: string;
  candidates: StudyCardCandidateCommitItem[];
}): Promise<StudyCardCandidateCommitResponse> {
  if (!Array.isArray(input.candidates) || input.candidates.length === 0) {
    throw new AppError('At least one candidate is required.', 400);
  }
  if (input.candidates.length > STUDY_CANDIDATE_COMMIT_MAX_COUNT) {
    throw new AppError(
      `A maximum of ${String(STUDY_CANDIDATE_COMMIT_MAX_COUNT)} candidates can be added at once.`,
      400
    );
  }

  const resolvedItems = [];
  for (const item of input.candidates) {
    // Keep this sequential so a commit cannot fan out several missing-preview TTS calls at once.
    resolvedItems.push(await resolveStudyCardCandidateCommitItem({ userId: input.userId, item }));
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

  const cards = [];
  for (const resolved of resolvedItems) {
    const previewMediaId =
      resolved.previewAudioId && ownedPreviewAudioIds.has(resolved.previewAudioId)
        ? resolved.previewAudioId
        : null;
    const imageMediaId =
      resolved.previewImageId && ownedPreviewImageIds.has(resolved.previewImageId)
        ? resolved.previewImageId
        : null;
    const promptAudioMediaId =
      resolved.previewAudioRole === 'prompt' || resolved.item.candidateKind === 'audio-recognition'
        ? previewMediaId
        : null;
    // Listening cards intentionally reuse the same synthesized Japanese audio for the
    // front cue and answer replay, while keeping the JSON payload answer free of cue-audio refs.
    const answerAudioMediaId =
      resolved.previewAudioRole === 'answer' || resolved.item.candidateKind === 'audio-recognition'
        ? previewMediaId
        : null;
    const card = await createStudyCard({
      userId: input.userId,
      cardType: resolved.item.cardType,
      prompt: resolved.prompt,
      answer: resolved.answer,
      promptAudioMediaId,
      answerAudioMediaId,
      imageMediaId,
    });
    cards.push(card);
  }

  return { cards };
}
