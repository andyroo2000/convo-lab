import { useCallback, useRef, useState, type MutableRefObject } from 'react';
import type { StudyCardSummary } from '@languageflow/shared/src/types';

import type { StudySessionResponse } from './useStudy';
import { createStudyReviewRequestGuard } from './studyReviewRequestGuard';
import type { StudySessionReviewRecord } from '../components/study/studySessionWrapUpModel';
import type { StudyAchievementSessionCompletion } from '../components/study/studyAchievementSessionModel';
import type { StudyMasteryAnimation } from './studyReviewSubmissionRules';
import type { PendingStudyReviewOperation } from './studyReviewSubmissionFlow';

export type StudyLessonPhase = 'preview' | 'quiz' | 'complete';

const useStudyReviewViewState = () => {
  const [focusMode, setFocusMode] = useState(false);
  const [sessionKind, setSessionKind] = useState<'reviews' | 'lessons'>('reviews');
  const [lessonPhase, setLessonPhase] = useState<StudyLessonPhase>('preview');
  const [masteryAnimation, setMasteryAnimation] = useState<StudyMasteryAnimation | null>(null);
  const [session, setSession] = useState<StudySessionResponse | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [reviewConflictRecovered, setReviewConflictRecovered] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showSetDueControls, setShowSetDueControls] = useState(false);

  return {
    currentIndex,
    editing,
    focusMode,
    lessonPhase,
    masteryAnimation,
    revealed,
    reviewConflictRecovered,
    session,
    sessionError,
    sessionKind,
    sessionLoading,
    setCurrentIndex,
    setEditing,
    setFocusMode,
    setLessonPhase,
    setMasteryAnimation,
    setRevealed,
    setReviewConflictRecovered,
    setSession,
    setSessionError,
    setSessionKind,
    setSessionLoading,
    setShowSetDueControls,
    showSetDueControls,
  };
};

const useStudyReviewProgressState = () => {
  const [undoPending, setUndoPending] = useState(false);
  const [reviewSubmitPending, setReviewSubmitPending] = useState(false);
  const [reviewRetryAvailable, setReviewRetryAvailable] = useState(false);
  const [answeredCardIds, setAnsweredCardIds] = useState<string[]>([]);
  const [sessionReviewRecords, setSessionReviewRecords] = useState<StudySessionReviewRecord[]>([]);
  const [sessionWasEnded, setSessionWasEnded] = useState(false);
  const [achievementCompletion, setAchievementCompletion] =
    useState<StudyAchievementSessionCompletion | null>(null);
  const [currentAchievementIndex, setCurrentAchievementIndex] = useState(0);
  const [achievementCelebrationPresented, setAchievementCelebrationPresented] = useState(false);
  const [achievementCompletionRefreshPending, setAchievementCompletionRefreshPending] =
    useState(false);
  const [practiceCards, setPracticeCards] = useState<StudyCardSummary[] | null>(null);
  const [practiceInitialCount, setPracticeInitialCount] = useState(0);

  return {
    achievementCelebrationPresented,
    achievementCompletion,
    achievementCompletionRefreshPending,
    answeredCardIds,
    currentAchievementIndex,
    practiceCards,
    practiceInitialCount,
    reviewRetryAvailable,
    reviewSubmitPending,
    sessionReviewRecords,
    sessionWasEnded,
    setAchievementCelebrationPresented,
    setAchievementCompletion,
    setAchievementCompletionRefreshPending,
    setAnsweredCardIds,
    setCurrentAchievementIndex,
    setPracticeCards,
    setPracticeInitialCount,
    setReviewRetryAvailable,
    setReviewSubmitPending,
    setSessionReviewRecords,
    setSessionWasEnded,
    setUndoPending,
    undoPending,
  };
};

const useStudyReviewSessionRefs = () => {
  const requestGuardRef = useRef(createStudyReviewRequestGuard());
  const sessionEpochRef = useRef(0);
  const activeLessonCohortIdRef = useRef<string | null>(null);
  const canSurfaceAsyncSessionErrorRef = useRef(false);
  const answeredCardIdsRef = useRef<Set<string>>(new Set());
  const autoRefreshEmptySessionRef = useRef(false);
  const achievementCompletionRequestIdRef = useRef(0);
  const activeAchievementCompletionRequestRef = useRef<number | null>(null);
  const pendingReviewOperationRef = useRef<PendingStudyReviewOperation | null>(null);
  const cardStartedAtRef = useRef(Date.now());

  return {
    achievementCompletionRequestIdRef,
    activeAchievementCompletionRequestRef,
    activeLessonCohortIdRef,
    answeredCardIdsRef,
    autoRefreshEmptySessionRef,
    canSurfaceAsyncSessionErrorRef,
    cardStartedAtRef,
    pendingReviewOperationRef,
    requestGuardRef,
    sessionEpochRef,
  };
};

const useStudyReviewSessionState = () => ({
  ...useStudyReviewViewState(),
  ...useStudyReviewProgressState(),
  ...useStudyReviewSessionRefs(),
});

export type StudyReviewSessionState = ReturnType<typeof useStudyReviewSessionState>;

export const isStudyReviewBusy = (
  reviewPending: boolean,
  state: Pick<StudyReviewSessionState, 'reviewRetryAvailable' | 'reviewSubmitPending'>
) => reviewPending || state.reviewSubmitPending || state.reviewRetryAvailable;

export const useStudyAsyncSessionErrorReporter = (
  canSurfaceAsyncSessionErrorRef: MutableRefObject<boolean>,
  setSessionError: StudyReviewSessionState['setSessionError']
) =>
  useCallback(
    (message: string) => {
      if (canSurfaceAsyncSessionErrorRef.current) {
        setSessionError(message);
      }
    },
    [canSurfaceAsyncSessionErrorRef, setSessionError]
  );

export default useStudyReviewSessionState;
