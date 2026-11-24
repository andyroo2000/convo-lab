import { useMemo } from 'react';
import type { StudyCardSummary } from '@languageflow/shared/src/types';

import type { StudySessionResponse } from './useStudy';
import { hasPersistedFailure } from './studyReviewSessionUtils';
import { batchQueueCounts } from './studyBatchQueue';
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
  overviewFailedCount: number,
  overviewDueCount = 0
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
  counts.reviewRemaining = Math.max(counts.reviewRemaining, overviewDueCount);
  return counts;
};

const batchProgress = (total: number, remaining: number) => ({
  completed: Math.max(0, total - remaining),
  total: Math.max(total, remaining),
});

export const calculateStudySessionProgress = (
  options: Pick<
    UseStudyReviewSessionDerivedStateOptions,
    | 'answeredCardIds'
    | 'practiceCards'
    | 'practiceInitialCount'
    | 'session'
    | 'sessionCardCount'
    | 'sessionKind'
  >
) => {
  if (options.practiceCards) {
    return batchProgress(options.practiceInitialCount, options.practiceCards.length);
  }
  const cards = options.session?.cards ?? [];
  if (options.sessionKind === 'lessons') {
    return batchProgress(options.sessionCardCount, cards.length);
  }
  // A failed card that is still due belongs on the remaining side of the bar.
  const completedIds = new Set(options.answeredCardIds);
  cards.forEach((card) => completedIds.delete(card.id));
  const overview = options.session?.overview;
  const due = (overview?.dueCount ?? 0) + (overview?.failedDueCount ?? 0);
  const remaining = Math.max(due, cards.length);
  return { completed: completedIds.size, total: completedIds.size + remaining };
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
  const { cards, practiceMode } = practice;
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
  const sessionCounts = useMemo(() => {
    if (options.practiceCards) return batchQueueCounts(options.practiceCards);
    if (options.sessionKind === 'lessons') return batchQueueCounts(cards);
    return deriveStudySessionCounts(
      cards,
      options.answeredCardIds,
      options.session?.overview.failedCount ?? 0,
      options.session?.overview.dueCount ?? 0
    );
  }, [
    cards,
    options.answeredCardIds,
    options.practiceCards,
    options.sessionKind,
    options.session?.overview,
  ]);
  const sessionProgress = calculateStudySessionProgress(options);
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
