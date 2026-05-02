import { STUDY_CANDIDATE_IMAGE_PROMPT_MAX_LENGTH } from '@languageflow/shared/src/studyConstants.js';
import type {
  StudyCardCandidateCommitItem,
  StudyCardCandidateGenerateRequest,
  StudyCardCandidateGenerateResponse,
  StudyCardCandidatePreviewAudioResponse,
  StudyCardCandidatePreviewImageResponse,
} from '@languageflow/shared/src/types.js';

import { AppError } from '../middleware/errorHandler.js';

import { generateStudyCardCandidateJson } from './llmClient.js';
import { commitStudyCardCandidates as commitStudyCardCandidatesImpl } from './study/candidates/candidateCommit.js';
import {
  enrichCandidateReadings,
  normalizeGenerateRequest,
  parseCandidateResponse,
} from './study/candidates/candidateParser.js';
import { buildLearnerContextSummary } from './study/candidates/learnerContext.js';
import { scheduleStudyCandidatePreviewMediaCleanup } from './study/candidates/mediaCleanup.js';
import {
  addPreviewAudio,
  generateCandidatePreviewImage,
  synthesizeCandidatePreviewAudio,
} from './study/candidates/previewMedia.js';
import {
  buildCandidateSystemInstruction,
  buildCandidateUserPrompt,
} from './study/candidates/promptBuilder.js';
import { cardTypeForStudyCardCandidateKind, STUDY_CARD_CANDIDATE_KINDS } from './study/shared.js';

export const commitStudyCardCandidates = commitStudyCardCandidatesImpl;

export async function generateStudyCardCandidates(input: {
  userId: string;
  request: StudyCardCandidateGenerateRequest;
}): Promise<StudyCardCandidateGenerateResponse> {
  const request = normalizeGenerateRequest(input.request);
  void scheduleStudyCandidatePreviewMediaCleanup(input.userId);
  const learnerContextSummary = request.includeLearnerContext
    ? await buildLearnerContextSummary(input.userId)
    : null;

  const rawResponse = await generateStudyCardCandidateJson(
    buildCandidateUserPrompt({
      targetText: request.targetText,
      context: request.context,
      learnerContextSummary,
    }),
    buildCandidateSystemInstruction()
  );

  const candidates = await Promise.all(
    parseCandidateResponse(rawResponse).map((candidate) => enrichCandidateReadings(candidate))
  );
  const withPreviewAudio = await Promise.all(
    candidates.map((candidate) => addPreviewAudio(input.userId, candidate))
  );

  return {
    candidates: withPreviewAudio,
    learnerContextSummary,
  };
}

export async function regenerateStudyCardCandidatePreviewAudio(input: {
  userId: string;
  candidate: StudyCardCandidateCommitItem;
}): Promise<StudyCardCandidatePreviewAudioResponse> {
  const item = input.candidate;
  if (!STUDY_CARD_CANDIDATE_KINDS.has(item.candidateKind)) {
    throw new AppError('candidateKind must be a supported generated card kind.', 400);
  }

  const expectedCardType = cardTypeForStudyCardCandidateKind(item.candidateKind);
  if (item.cardType !== expectedCardType) {
    throw new AppError('cardType does not match candidateKind.', 400);
  }

  const generated = await synthesizeCandidatePreviewAudio(input.userId, {
    clientId: item.clientId,
    candidateKind: item.candidateKind,
    cardType: item.cardType,
    prompt: item.prompt,
    answer: item.answer,
    rationale: 'Regenerated candidate preview audio.',
  });

  const previewAudioRole = item.candidateKind === 'audio-recognition' ? 'prompt' : 'answer';
  const prompt =
    item.candidateKind === 'audio-recognition'
      ? {
          ...item.prompt,
          cueAudio: generated,
        }
      : item.prompt;
  const answer = {
    ...item.answer,
    ...(previewAudioRole === 'answer' ? { answerAudio: generated } : {}),
  };

  return {
    prompt,
    answer,
    previewAudio: generated,
    previewAudioRole,
  };
}

export async function regenerateStudyCardCandidatePreviewImage(input: {
  userId: string;
  candidate: StudyCardCandidateCommitItem;
  imagePrompt: string;
}): Promise<StudyCardCandidatePreviewImageResponse> {
  const item = input.candidate;
  if (item.candidateKind !== 'production' || item.cardType !== 'production') {
    throw new AppError('Only production candidates can regenerate prompt images.', 400);
  }

  const imagePrompt = input.imagePrompt;
  if (imagePrompt.length > STUDY_CANDIDATE_IMAGE_PROMPT_MAX_LENGTH) {
    throw new AppError(
      `imagePrompt must be ${String(STUDY_CANDIDATE_IMAGE_PROMPT_MAX_LENGTH)} characters or fewer.`,
      400
    );
  }

  const previewImage = await generateCandidatePreviewImage({
    userId: input.userId,
    clientId: item.clientId,
    imagePrompt,
  });

  return {
    prompt: {
      ...item.prompt,
      cueText: null,
      cueImage: previewImage,
    },
    previewImage,
    imagePrompt,
  };
}
