import { useMemo } from 'react';
import type { StudyCardSummary } from '@languageflow/shared/src/types';

import type { StudySessionResponse } from './useStudy';
import { hasPersistedFailure } from './studyReviewSessionUtils';
import {
  buildStudySessionWrapUp,
  type StudySessionReviewRecord,
} from '../components/study/studySessionWrapUpModel';

interface UseStudyReviewSessionDerivedStateOptions {
  answeredCardIds: string[];
  currentIndex: number;
  focusMode: boolean;
  practiceCards: StudyCardSummary[] | null;
  practiceInitialCount: number;
  regenerateAudioError: unknown;
  session: StudySessionResponse | null;
  sessionCardCount: number;
  sessionKind: 'reviews' | 'lessons';
  sessionReviewRecords: StudySessionReviewRecord[];
  sessionWasEnded: boolean;
  updateCardError: unknown;
}

export interface StudySessionCounts {
  failedDue: number;
  newRemaining: number;
  reviewRemaining: number;
}

export const deriveStudySessionCounts = (
  cards: StudyCardSummary[],
  answeredCardIds: string[],
  overviewFailedCount: number
): StudySessionCounts => {
  const answeredSet = new Set(answeredCardIds);
  const counts: StudySessionCounts = {
    newRemaining: 0,
    failedDue: overviewFailedCount,
    reviewRemaining: 0,
  };
  let loadedFailedCount = 0;

  cards.forEach((card) => {
    if (hasPersistedFailure(card)) {
      loadedFailedCount += 1;
    } else if (!answeredSet.has(card.id)) {
      if (card.state.queueState === 'new') {
        counts.newRemaining += 1;
      } else {
        counts.reviewRemaining += 1;
      }
    }
  });

  counts.failedDue = Math.max(counts.failedDue, loadedFailedCount);
  return counts;
};

export const calculateStudySessionProgress = ({
  answeredCount,
  cardCount,
  remainingCardCount,
  practiceComplete,
  practiceInitialCount,
  practiceMode,
}: {
  answeredCount: number;
  cardCount: number;
  remainingCardCount: number;
  practiceComplete: boolean;
  practiceInitialCount: number;
  practiceMode: boolean;
}) => {
  if (practiceMode && practiceInitialCount > 0) {
    return practiceComplete
      ? 1
      : Math.max(0, (practiceInitialCount - remainingCardCount) / practiceInitialCount);
  }

  if (cardCount === 0) return 0;
  return remainingCardCount === 0 ? 1 : Math.min(0.99, answeredCount / cardCount);
};

const mutationErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  return error ? fallback : null;
};

const getMutationErrorMessage = (audioError: unknown, updateError: unknown) => {
  if (audioError instanceof Error) return audioError.message;
  if (updateError instanceof Error) return updateError.message;
  return (
    mutationErrorMessage(audioError, 'Audio regeneration failed.') ??
    mutationErrorMessage(updateError, 'Card update failed.')
  );
};

const hasReviewQueueWork = (cards: StudyCardSummary[], session: StudySessionResponse | null) => {
  if (cards.length > 0) return true;
  if ((session?.overview.dueCount ?? 0) > 0) return true;
  return (session?.overview.failedCount ?? 0) > 0;
};

const isReviewQueueExhausted = ({
  cards,
  focusMode,
  practiceMode,
  session,
  sessionKind,
  sessionReviewRecords,
}: Pick<
  UseStudyReviewSessionDerivedStateOptions,
  'focusMode' | 'session' | 'sessionKind' | 'sessionReviewRecords'
> & {
  cards: StudyCardSummary[];
  practiceMode: boolean;
}) => {
  if (!focusMode) return false;
  if (sessionKind !== 'reviews') return false;
  if (sessionReviewRecords.length === 0) return false;
  if (practiceMode) return false;
  return !hasReviewQueueWork(cards, session);
};

const getCurrentCard = (
  cards: StudyCardSummary[],
  practiceCards: StudyCardSummary[] | null,
  currentIndex: number
) => {
  if (practiceCards) return practiceCards[0] ?? null;
  return cards[currentIndex] ?? null;
};

const isReviewSessionComplete = (
  practiceMode: boolean,
  reviewQueueExhausted: boolean,
  sessionWasEnded: boolean
) => {
  if (practiceMode) return false;
  return reviewQueueExhausted || sessionWasEnded;
};

const usePracticePresentationState = ({
  currentIndex,
  practiceCards,
  session,
}: Pick<
  UseStudyReviewSessionDerivedStateOptions,
  'currentIndex' | 'practiceCards' | 'session'
>) => {
  const cards = useMemo(() => session?.cards ?? [], [session?.cards]);
  const practiceMode = practiceCards !== null;
  const practiceComplete = practiceMode && practiceCards.length === 0;
  const presentedCards = practiceCards ?? cards;

  return {
    cards,
    currentCard: getCurrentCard(cards, practiceCards, currentIndex),
    practiceComplete,
    practiceMode,
    presentedCards,
  };
};

const useStudyReviewSessionDerivedState = (options: UseStudyReviewSessionDerivedStateOptions) => {
  const practice = usePracticePresentationState(options);
  const { cards, practiceComplete, practiceMode, presentedCards } = practice;
  const sessionWrapUp = useMemo(
    () => buildStudySessionWrapUp(options.sessionReviewRecords),
    [options.sessionReviewRecords]
  );
  const reviewQueueExhausted = isReviewQueueExhausted({
    cards,
    focusMode: options.focusMode,
    practiceMode,
    session: options.session,
    sessionKind: options.sessionKind,
    sessionReviewRecords: options.sessionReviewRecords,
  });
  const reviewSessionComplete = isReviewSessionComplete(
    practiceMode,
    reviewQueueExhausted,
    options.sessionWasEnded
  );
  const sessionCounts = useMemo(
    () =>
      deriveStudySessionCounts(
        cards,
        options.answeredCardIds,
        options.session?.overview.failedCount ?? 0
      ),
    [cards, options.answeredCardIds, options.session?.overview.failedCount]
  );
  const sessionProgress = calculateStudySessionProgress({
    answeredCount: options.answeredCardIds.length,
    cardCount: options.sessionCardCount,
    remainingCardCount: practiceMode ? presentedCards.length : cards.length,
    practiceComplete,
    practiceInitialCount: options.practiceInitialCount,
    practiceMode,
  });
  const updateCardErrorMessage = useMemo(
    () => getMutationErrorMessage(options.regenerateAudioError, options.updateCardError),
    [options.regenerateAudioError, options.updateCardError]
  );

  return {
    ...practice,
    reviewQueueExhausted,
    reviewSessionComplete,
    sessionCounts,
    sessionProgress,
    sessionWrapUp,
    updateCardErrorMessage,
  };
};

export default useStudyReviewSessionDerivedState;
