import type { QueryClient } from '@tanstack/react-query';
import type {
  StudyCardSummary,
  StudyOverview,
  StudyReviewResult,
} from '@languageflow/shared/src/types';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type {
  StudySessionGrade,
  StudySessionReviewRecord,
} from '../components/study/studySessionWrapUpModel';

import type { StudyReviewRequestGuard, StudyReviewRequestToken } from './studyReviewRequestGuard';
import type { StudyUndoAction, StudyUndoSnapshot } from './studyReviewSessionUtils';
import {
  createStudyMasteryAnimation,
  getCardsAfterCommittedReview,
  getNextReviewCardIndex,
  getStudyReviewErrorMessage,
  isAmbiguousReviewError,
  isReviewConflictError,
  type StudyMasteryAnimation,
} from './studyReviewSubmissionRules';
import type { StudyReviewRequest, StudySessionResponse } from './useStudy';
import type { StudySessionKind, StudySessionLoadOptions } from './useStudySessionLoader';

export interface PendingStudyReviewOperation {
  request: StudyReviewRequest;
  undoSnapshot: StudyUndoSnapshot;
}

export interface StudyReviewSubmissionContext {
  activeLessonCohortIdRef: MutableRefObject<string | null>;
  activePileIdRef: MutableRefObject<string | null>;
  answeredCardIdsRef: MutableRefObject<Set<string>>;
  applyReviewResultToSession: (
    updatedCard: StudyCardSummary,
    grade: StudySessionGrade,
    resolvedCards?: StudyCardSummary[],
    resolvedOverview?: StudyOverview
  ) => void;
  autoRefreshEmptySessionRef: MutableRefObject<boolean>;
  cards: StudyCardSummary[];
  currentCard: StudyCardSummary;
  expectedEpoch: number;
  fallbackDurationMs: number;
  grade: StudySessionGrade;
  loadSession: (
    kind?: StudySessionKind,
    options?: StudySessionLoadOptions,
    expectedEpoch?: number
  ) => Promise<StudySessionResponse | null>;
  operation: PendingStudyReviewOperation;
  pendingReviewOperationRef: MutableRefObject<PendingStudyReviewOperation | null>;
  pushUndo: (action: StudyUndoAction) => void;
  queryClient: QueryClient;
  requestGuardRef: MutableRefObject<StudyReviewRequestGuard>;
  requestToken: StudyReviewRequestToken;
  resetStudyAudioAutoplayForCard: (cardId: string) => void;
  resetUndo: () => void;
  sessionEpochRef: MutableRefObject<number>;
  sessionKind: StudySessionKind;
  setAnsweredCardIds: Dispatch<SetStateAction<string[]>>;
  setCurrentIndex: Dispatch<SetStateAction<number>>;
  setEditing: Dispatch<SetStateAction<boolean>>;
  setLessonPhase: Dispatch<SetStateAction<'preview' | 'quiz' | 'complete'>>;
  setMasteryAnimation: Dispatch<SetStateAction<StudyMasteryAnimation | null>>;
  setRevealed: Dispatch<SetStateAction<boolean>>;
  setReviewConflictRecovered: Dispatch<SetStateAction<boolean>>;
  setReviewRetryAvailable: Dispatch<SetStateAction<boolean>>;
  setReviewSubmitPending: Dispatch<SetStateAction<boolean>>;
  setSession: Dispatch<SetStateAction<StudySessionResponse | null>>;
  setSessionError: Dispatch<SetStateAction<string | null>>;
  setSessionReviewRecords: Dispatch<SetStateAction<StudySessionReviewRecord[]>>;
  setSessionWasEnded: Dispatch<SetStateAction<boolean>>;
  setShowSetDueControls: Dispatch<SetStateAction<boolean>>;
  stopAllAudio: () => void;
  submitReview: (request: StudyReviewRequest) => Promise<StudyReviewResult>;
  syncOverview: (overview: StudyOverview) => void;
}

const isCurrentSession = (context: StudyReviewSubmissionContext) =>
  context.sessionEpochRef.current === context.expectedEpoch;

const createReviewRecord = (
  context: StudyReviewSubmissionContext,
  result: StudyReviewResult
): StudySessionReviewRecord => ({
  id: result.reviewLogId,
  cardBefore: context.currentCard,
  cardAfter: result.card,
  grade: context.grade,
  durationMs: context.operation.request.durationMs ?? context.fallbackDurationMs,
});

const recordCommittedReview = (
  context: StudyReviewSubmissionContext,
  result: StudyReviewResult
) => {
  context.pendingReviewOperationRef.current = null;
  context.setReviewRetryAvailable(false);
  context.answeredCardIdsRef.current.add(context.currentCard.id);
  context.setAnsweredCardIds((current) =>
    current.includes(context.currentCard.id) ? current : [...current, context.currentCard.id]
  );
  context.pushUndo({
    kind: 'grade',
    snapshot: context.operation.undoSnapshot,
    reviewLogId: result.reviewLogId,
  });
  if (context.grade === 'again') {
    context.resetStudyAudioAutoplayForCard(context.currentCard.id);
  }
};

const applyCommittedCardState = (
  context: StudyReviewSubmissionContext,
  result: StudyReviewResult,
  nextCards: StudyCardSummary[]
) => {
  context.autoRefreshEmptySessionRef.current =
    context.sessionKind === 'reviews' && nextCards.length === 0;
  context.setMasteryAnimation(
    createStudyMasteryAnimation({
      cardBefore: context.currentCard,
      cardAfter: result.card,
      grade: context.grade,
      reviewLogId: result.reviewLogId,
    })
  );
  if (result.card) {
    context.applyReviewResultToSession(result.card, context.grade, nextCards, result.overview);
  } else {
    context.setSession((currentSession) =>
      currentSession ? { ...currentSession, cards: nextCards, overview: result.overview } : null
    );
  }
  context.syncOverview(result.overview);
};

const recordReviewSessionResult = (
  context: StudyReviewSubmissionContext,
  result: StudyReviewResult,
  nextCards: StudyCardSummary[]
) => {
  const reviewRecord = createReviewRecord(context, result);
  context.setSessionReviewRecords((current) => [...current, reviewRecord]);
  context.setCurrentIndex((current) => getNextReviewCardIndex(current, nextCards.length));
  context.setRevealed(false);
  if (context.sessionKind === 'lessons' && nextCards.length === 0) {
    context.setLessonPhase('complete');
  }
  context.setSessionError(null);
};

const applyCommittedReview = (context: StudyReviewSubmissionContext, result: StudyReviewResult) => {
  recordCommittedReview(context, result);
  const nextCards = getCardsAfterCommittedReview(
    context.cards,
    context.currentCard.id,
    result.card,
    context.grade
  );
  applyCommittedCardState(context, result, nextCards);
  recordReviewSessionResult(context, result, nextCards);
};

const resetReviewConflictState = (context: StudyReviewSubmissionContext) => {
  context.pendingReviewOperationRef.current = null;
  context.setReviewRetryAvailable(false);
  context.resetUndo();
  context.answeredCardIdsRef.current = new Set();
  context.setAnsweredCardIds([]);
  context.setSessionReviewRecords([]);
  context.setCurrentIndex(0);
  context.setRevealed(false);
  context.setEditing(false);
  context.setShowSetDueControls(false);
  context.setMasteryAnimation(null);
};

const reloadAfterReviewConflict = async (context: StudyReviewSubmissionContext) => {
  await Promise.all([
    context.queryClient.invalidateQueries({ queryKey: ['study', 'overview'] }),
    context.loadSession(
      context.sessionKind,
      {
        allowEmptySessionRefresh: false,
        lessonCohortId: context.activeLessonCohortIdRef.current ?? undefined,
        pileId: context.activePileIdRef.current ?? undefined,
      },
      context.expectedEpoch
    ),
  ]);
  if (isCurrentSession(context)) {
    context.setReviewConflictRecovered(true);
  }
};

const recoverFromReviewConflict = async (context: StudyReviewSubmissionContext) => {
  resetReviewConflictState(context);
  await reloadAfterReviewConflict(context);
};

const applyReviewFailure = (context: StudyReviewSubmissionContext, error: unknown) => {
  if (isAmbiguousReviewError(error)) {
    context.setReviewRetryAvailable(true);
  } else {
    context.pendingReviewOperationRef.current = null;
    context.setReviewRetryAvailable(false);
  }
  context.setSessionError(getStudyReviewErrorMessage(error));
};

export const submitStudyReviewOperation = async (context: StudyReviewSubmissionContext) => {
  try {
    context.setReviewSubmitPending(true);
    context.setMasteryAnimation(null);
    context.stopAllAudio();
    const result = await context.submitReview(context.operation.request);
    if (!isCurrentSession(context)) return;
    applyCommittedReview(context, result);
  } catch (error) {
    if (!isCurrentSession(context)) return;
    if (isReviewConflictError(error)) {
      await recoverFromReviewConflict(context);
      return;
    }
    applyReviewFailure(context, error);
    throw error;
  } finally {
    context.requestGuardRef.current.release(context.requestToken);
    if (isCurrentSession(context)) {
      context.setReviewSubmitPending(false);
    }
  }
};
