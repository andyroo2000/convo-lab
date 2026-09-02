import type {
  StudyAnswerPayload,
  StudyCardSummary,
  StudyPromptPayload,
} from '@languageflow/shared/src/types';
import {
  useCallback,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';

import { getNextCardIndex } from './studyReviewSessionUtils';

interface StudyCurrentCardMutationsOptions {
  autoRefreshEmptySessionRef: MutableRefObject<boolean>;
  cardsLength: number;
  currentCardRef: MutableRefObject<StudyCardSummary | null>;
  deleteCard: (cardId: string) => Promise<void>;
  mergeCardIntoSession: (card: StudyCardSummary) => void;
  regenerateAnswerAudio: (payload: {
    cardId: string;
    answerAudioVoiceId: string | null;
    answerAudioTextOverride: string | null;
  }) => Promise<StudyCardSummary>;
  removeCardFromSession: (cardId: string) => void;
  resetAudioAutoplayForCard: (cardId: string) => void;
  sessionEpochRef: MutableRefObject<number>;
  setAnsweredCardIds: Dispatch<SetStateAction<string[]>>;
  setCurrentIndex: Dispatch<SetStateAction<number>>;
  setEditing: Dispatch<SetStateAction<boolean>>;
  setRevealed: Dispatch<SetStateAction<boolean>>;
  setSessionError: Dispatch<SetStateAction<string | null>>;
  stopAllAudio: () => void;
  updateCard: (payload: {
    cardId: string;
    expectedRevision: number;
    prompt: StudyPromptPayload;
    answer: StudyAnswerPayload;
  }) => Promise<StudyCardSummary>;
}

const resetSavedCardInteraction = (options: StudyCurrentCardMutationsOptions, cardId: string) => {
  options.resetAudioAutoplayForCard(cardId);
  options.setEditing(false);
  options.setRevealed(false);
  options.setSessionError(null);
};

const saveCurrentCard = async (
  options: StudyCurrentCardMutationsOptions,
  payload: { prompt: StudyPromptPayload; answer: StudyAnswerPayload }
) => {
  const card = options.currentCardRef.current;
  if (!card) return;
  const expectedEpoch = options.sessionEpochRef.current;

  options.stopAllAudio();
  const updatedCard = await options.updateCard({
    cardId: card.id,
    expectedRevision: card.revision ?? 0,
    prompt: payload.prompt,
    answer: payload.answer,
  });
  if (options.sessionEpochRef.current !== expectedEpoch) return;

  options.mergeCardIntoSession(updatedCard);
  resetSavedCardInteraction(options, card.id);
};

const regenerateCurrentCardAudio = async (
  options: StudyCurrentCardMutationsOptions,
  payload: { answerAudioVoiceId: string | null; answerAudioTextOverride: string | null }
) => {
  const card = options.currentCardRef.current;
  if (!card) return undefined;
  const expectedEpoch = options.sessionEpochRef.current;

  options.stopAllAudio();
  const updatedCard = await options.regenerateAnswerAudio({ cardId: card.id, ...payload });
  if (options.sessionEpochRef.current !== expectedEpoch) return undefined;

  options.mergeCardIntoSession(updatedCard);
  options.resetAudioAutoplayForCard(card.id);
  options.setSessionError(null);
  return updatedCard;
};

const deleteCurrentCard = async (options: StudyCurrentCardMutationsOptions) => {
  const card = options.currentCardRef.current;
  if (!card) return;
  const expectedEpoch = options.sessionEpochRef.current;

  options.stopAllAudio();
  try {
    await options.deleteCard(card.id);
    if (options.sessionEpochRef.current !== expectedEpoch) return;

    const { autoRefreshEmptySessionRef } = options;
    autoRefreshEmptySessionRef.current = false;
    options.setAnsweredCardIds((current) => current.filter((cardId) => cardId !== card.id));
    options.removeCardFromSession(card.id);
    const nextLength = Math.max(options.cardsLength - 1, 0);
    options.setCurrentIndex((current) => getNextCardIndex(current, nextLength));
    options.setEditing(false);
    options.setRevealed(false);
    options.setSessionError(null);
  } catch (error) {
    if (options.sessionEpochRef.current !== expectedEpoch) return;
    options.setSessionError(error instanceof Error ? error.message : 'Unable to delete card.');
    throw error;
  }
};

const useStudyCurrentCardMutations = (options: StudyCurrentCardMutationsOptions) => {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  return {
    saveCurrentCard: useCallback(
      (payload: { prompt: StudyPromptPayload; answer: StudyAnswerPayload }) =>
        saveCurrentCard(optionsRef.current, payload),
      []
    ),
    regenerateCurrentCardAudio: useCallback(
      (payload: { answerAudioVoiceId: string | null; answerAudioTextOverride: string | null }) =>
        regenerateCurrentCardAudio(optionsRef.current, payload),
      []
    ),
    deleteCurrentCard: useCallback(() => deleteCurrentCard(optionsRef.current), []),
  };
};

export default useStudyCurrentCardMutations;
