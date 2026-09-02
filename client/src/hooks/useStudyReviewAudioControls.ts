import type { StudyCardSummary } from '@languageflow/shared/src/types';
import { flushSync } from 'react-dom';
import {
  useCallback,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';

import type { AudioPlayerHandle } from '../components/study/StudyAudioPlayer';
import { getStudyCardAudioUrl } from '../components/study/studyCardUtils';
import type { StudyUndoSnapshot } from './studyReviewSessionUtils';
import type useStudyBackgroundTask from './useStudyBackgroundTask';

interface StudyReviewAudioControlsOptions {
  answerAudioRef: MutableRefObject<AudioPlayerHandle | null>;
  autoplayAnswerAudioForCard: (card: StudyCardSummary) => void;
  captureUndoSnapshot: () => StudyUndoSnapshot;
  currentCard: StudyCardSummary | null;
  editing: boolean;
  ensureAnswerAudioPrepared: (cardId: string) => Promise<StudyCardSummary>;
  pushUndo: (action: { kind: 'reveal'; snapshot: StudyUndoSnapshot }) => void;
  reportAsyncSessionError: (message: string) => void;
  revealed: boolean;
  runBackgroundTask: ReturnType<typeof useStudyBackgroundTask>;
  setRevealed: Dispatch<SetStateAction<boolean>>;
  stopAllAudio: () => void;
}

const getRevealableCard = (options: StudyReviewAudioControlsOptions) =>
  [options.revealed, options.editing].some(Boolean) ? null : options.currentCard;

const prepareMissingAnswerAudio = (
  options: StudyReviewAudioControlsOptions,
  card: StudyCardSummary
) => {
  options.runBackgroundTask(() => options.ensureAnswerAudioPrepared(card.id), {
    label: 'Study answer-audio preparation',
    errorMessage: 'Answer audio could not be prepared.',
    onError: options.reportAsyncSessionError,
  });
};

const revealCurrentCard = (options: StudyReviewAudioControlsOptions) => {
  const card = getRevealableCard(options);
  if (!card) return;

  options.pushUndo({ kind: 'reveal', snapshot: options.captureUndoSnapshot() });
  options.stopAllAudio();
  flushSync(() => options.setRevealed(true));

  if (getStudyCardAudioUrl(card)) {
    options.autoplayAnswerAudioForCard(card);
    return;
  }

  // Mobile browsers may reject play() until a user gesture or generated audio propagates.
  prepareMissingAnswerAudio(options, card);
};

const getReplayableAnswerAudio = (options: StudyReviewAudioControlsOptions) =>
  [!options.revealed, options.editing].some(Boolean) ? null : options.answerAudioRef.current;

const toggleAnswerAudio = (options: StudyReviewAudioControlsOptions) => {
  const player = getReplayableAnswerAudio(options);
  if (!player) return false;

  options.runBackgroundTask(player.play(), {
    label: 'Study answer-audio keyboard replay',
  });
  return true;
};

const useStudyReviewAudioControls = (options: StudyReviewAudioControlsOptions) => {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  return {
    revealCurrentCard: useCallback(() => revealCurrentCard(optionsRef.current), []),
    toggleAnswerAudio: useCallback(() => toggleAnswerAudio(optionsRef.current), []),
  };
};

export default useStudyReviewAudioControls;
