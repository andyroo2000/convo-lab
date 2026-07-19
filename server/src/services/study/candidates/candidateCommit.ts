import type {
  StudyAnswerPayload,
  StudyCardCandidateCommitItem,
  StudyPromptPayload,
} from '@languageflow/shared/src/types.js';

import { AppError } from '../../../middleware/errorHandler.js';
import { cardTypeForStudyCardCandidateKind, STUDY_CARD_CANDIDATE_KINDS } from '../shared.js';

import { getCandidatePreviewAudioText, synthesizeCandidatePreviewAudio } from './previewMedia.js';

export type ResolvedStudyCardCandidateCommitItem = {
  item: StudyCardCandidateCommitItem;
  prompt: StudyPromptPayload;
  answer: StudyAnswerPayload;
  previewAudioId: string | null;
  previewAudioRole: 'prompt' | 'answer' | null;
  previewImageId: string | null;
};

export async function resolveStudyCardCandidateCommitItem(input: {
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
