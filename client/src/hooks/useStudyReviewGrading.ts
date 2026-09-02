import {
  useCallback,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import type { StudyCardSummary } from '@languageflow/shared/src/types';

import type { StudySessionGrade } from '../components/study/studySessionWrapUpModel';
import {
  getLessonCardsAfterAgain,
  getPracticeCardsAfterGrade,
  isReviewSubmissionBlocked,
  pendingReviewDoesNotMatch,
  type StudyMasteryAnimation,
} from './studyReviewSubmissionRules';
import {
  submitStudyReviewOperation,
  type PendingStudyReviewOperation,
  type StudyReviewSubmissionContext,
} from './studyReviewSubmissionFlow';
import type { StudyUndoSnapshot } from './studyReviewSessionUtils';
import { createStudyReviewRequest } from './useStudy';

type SubmissionDependencies = Omit<
  StudyReviewSubmissionContext,
  'currentCard' | 'expectedEpoch' | 'fallbackDurationMs' | 'grade' | 'operation' | 'requestToken'
>;

interface StudyReviewGradingOptions extends SubmissionDependencies {
  cardStartedAtRef: MutableRefObject<number>;
  captureUndoSnapshot: () => StudyUndoSnapshot;
  currentCard: StudyCardSummary | null;
  currentIndex: number;
  editing: boolean;
  masteryAnimation: StudyMasteryAnimation | null;
  practiceMode: boolean;
  reviewPending: boolean;
  setPracticeCards: Dispatch<SetStateAction<StudyCardSummary[] | null>>;
  undoPending: boolean;
}

const gradePracticeCard = (
  options: StudyReviewGradingOptions,
  card: StudyCardSummary,
  grade: StudySessionGrade
) => {
  options.stopAllAudio();
  options.resetStudyAudioAutoplayForCard(card.id);
  options.setPracticeCards((current) => getPracticeCardsAfterGrade(current, grade));
  options.setRevealed(false);
  options.setSessionError(null);
  const { cardStartedAtRef } = options;
  cardStartedAtRef.current = Date.now();
};

const repeatLessonCard = (options: StudyReviewGradingOptions, card: StudyCardSummary) => {
  options.stopAllAudio();
  options.resetStudyAudioAutoplayForCard(card.id);
  const nextCards = getLessonCardsAfterAgain(options.cards, options.currentIndex, card);
  options.setSession((currentSession) =>
    currentSession ? { ...currentSession, cards: nextCards } : currentSession
  );
  options.setCurrentIndex(0);
  options.setRevealed(false);
  options.setSessionError(null);
};

const getPendingReviewOperation = (
  options: StudyReviewGradingOptions,
  card: StudyCardSummary,
  grade: StudySessionGrade,
  durationMs: number
) => {
  const pendingOperation = options.pendingReviewOperationRef.current;
  if (pendingReviewDoesNotMatch(pendingOperation?.request ?? null, card.id, grade)) return null;
  return (
    pendingOperation ?? {
      request: createStudyReviewRequest({ cardId: card.id, grade, durationMs }),
      undoSnapshot: options.captureUndoSnapshot(),
    }
  );
};

const submitReviewGrade = async (
  options: StudyReviewGradingOptions,
  card: StudyCardSummary,
  grade: StudySessionGrade
) => {
  const durationMs = Math.max(0, Date.now() - options.cardStartedAtRef.current);
  const operation = getPendingReviewOperation(options, card, grade, durationMs);
  if (!operation) return;

  const { pendingReviewOperationRef } = options;
  pendingReviewOperationRef.current = operation;
  options.setReviewRetryAvailable(false);
  options.setReviewConflictRecovered(false);
  const expectedEpoch = options.sessionEpochRef.current;
  const requestToken = options.requestGuardRef.current.acquire('review', card.id);
  if (!requestToken) return;

  await submitStudyReviewOperation({
    ...options,
    currentCard: card,
    expectedEpoch,
    fallbackDurationMs: durationMs,
    grade,
    operation,
    requestToken,
  });
};

const gradeCurrentCard = async (options: StudyReviewGradingOptions, grade: StudySessionGrade) => {
  const { currentCard } = options;
  if (
    isReviewSubmissionBlocked({
      editing: options.editing,
      hasCurrentCard: currentCard !== null,
      masteryAnimationActive: options.masteryAnimation !== null,
      requestBusy: options.requestGuardRef.current.isBusy(),
      reviewPending: options.reviewPending,
      undoPending: options.undoPending,
    })
  ) {
    return;
  }
  if (!currentCard) return;

  if (options.practiceMode) {
    gradePracticeCard(options, currentCard, grade);
    return;
  }
  if (options.sessionKind === 'lessons' && grade === 'again') {
    repeatLessonCard(options, currentCard);
    return;
  }
  await submitReviewGrade(options, currentCard, grade);
};

const retryReviewGrade = async (options: StudyReviewGradingOptions) => {
  const pendingOperation: PendingStudyReviewOperation | null =
    options.pendingReviewOperationRef.current;
  if (!pendingOperation) return;
  await gradeCurrentCard(options, pendingOperation.request.grade);
};

const useStudyReviewGrading = (options: StudyReviewGradingOptions) => {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const handleGrade = useCallback(
    (grade: StudySessionGrade) => gradeCurrentCard(optionsRef.current, grade),
    []
  );
  const retryPendingReview = useCallback(() => retryReviewGrade(optionsRef.current), []);

  return { handleGrade, retryPendingReview };
};

export default useStudyReviewGrading;
