import type { StudyCardSummary, StudyMasteryLevel } from '@languageflow/shared/src/types';

import { JsonRequestError } from '../lib/apiClient';
import StudyReviewIdentityMismatchError from '../lib/studyReviewIdentityMismatch';
import { normalizeStudyMasteryLevel } from '../components/study/studyMastery';
import { getStudyCardMasteryLabel } from '../components/study/studyCardUtils';
import type { StudySessionGrade } from '../components/study/studySessionWrapUpModel';
import type { StudyReviewRequest } from './useStudy';
import { getCardsAfterReview } from './studyReviewSessionUtils';

export interface StudyMasteryAnimation {
  id: string;
  card: StudyCardSummary;
  label: string;
  fromLevel: StudyMasteryLevel;
  toLevel: StudyMasteryLevel;
  passed: boolean;
}

interface ReviewSubmissionBlockers {
  editing: boolean;
  hasCurrentCard: boolean;
  masteryAnimationActive: boolean;
  requestBusy: boolean;
  reviewPending: boolean;
  undoPending: boolean;
}

export const isReviewSubmissionBlocked = ({
  editing,
  hasCurrentCard,
  masteryAnimationActive,
  requestBusy,
  reviewPending,
  undoPending,
}: ReviewSubmissionBlockers) =>
  !hasCurrentCard ||
  requestBusy ||
  reviewPending ||
  undoPending ||
  editing ||
  masteryAnimationActive;

export const getPracticeCardsAfterGrade = (
  cards: StudyCardSummary[] | null,
  grade: StudySessionGrade
) => {
  if (!cards || cards.length === 0) return cards;

  const [reviewedCard, ...remaining] = cards;
  return grade === 'again' ? [...remaining, reviewedCard] : remaining;
};

export const getLessonCardsAfterAgain = (
  cards: StudyCardSummary[],
  currentIndex: number,
  currentCard: StudyCardSummary
) => [...cards.slice(currentIndex + 1), ...cards.slice(0, currentIndex), currentCard];

export const pendingReviewDoesNotMatch = (
  pendingRequest: Pick<StudyReviewRequest, 'cardId' | 'grade'> | null,
  cardId: string,
  grade: StudySessionGrade
) =>
  pendingRequest !== null && (pendingRequest.cardId !== cardId || pendingRequest.grade !== grade);

export const getCardsAfterCommittedReview = (
  cards: StudyCardSummary[],
  currentCardId: string,
  updatedCard: StudyCardSummary | null,
  grade: StudySessionGrade
) =>
  updatedCard
    ? getCardsAfterReview(cards, updatedCard, grade)
    : cards.filter((card) => card.id !== currentCardId);

export const createStudyMasteryAnimation = ({
  cardBefore,
  cardAfter,
  grade,
  reviewLogId,
}: {
  cardBefore: StudyCardSummary;
  cardAfter: StudyCardSummary | null;
  grade: StudySessionGrade;
  reviewLogId: string;
}): StudyMasteryAnimation => {
  const previousLevel = cardBefore.masteryLevel ?? 'apprentice';
  const nextLevel = cardAfter?.masteryLevel ?? previousLevel;
  const normalizedPreviousLevel = normalizeStudyMasteryLevel(previousLevel);
  const normalizedNextLevel = normalizeStudyMasteryLevel(nextLevel, normalizedPreviousLevel);
  const reviewedCard = cardAfter ?? cardBefore;

  return {
    id: reviewLogId,
    card: cardBefore,
    label: getStudyCardMasteryLabel(reviewedCard, 'This item'),
    fromLevel: normalizedPreviousLevel,
    toLevel: normalizedNextLevel,
    passed: grade !== 'again',
  };
};

export const getNextReviewCardIndex = (currentIndex: number, nextLength: number) => {
  if (nextLength === 0) return 0;
  return Math.min(currentIndex, nextLength - 1);
};

export const isReviewConflictError = (error: unknown) =>
  error instanceof StudyReviewIdentityMismatchError ||
  (error instanceof JsonRequestError && error.status === 409);

export const isAmbiguousReviewError = (error: unknown) =>
  error instanceof TypeError ||
  (error instanceof JsonRequestError &&
    (error.status === 408 || error.status === 429 || error.status >= 500));

export const getStudyReviewErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Review failed.';
