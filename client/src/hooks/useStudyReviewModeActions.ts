import { useCallback } from 'react';
import type { StudyCardSummary } from '@languageflow/shared/src/types';

import type useStudySessionLoader from './useStudySessionLoader';
import type { StudyReviewSessionState } from './useStudyReviewSessionState';

type LoadStudySession = ReturnType<typeof useStudySessionLoader>['loadSession'];

interface UseStudyReviewModeActionsOptions {
  loadSession: LoadStudySession;
  resetStudyAudioAutoplay: () => void;
  resetUndo: () => void;
  state: StudyReviewSessionState;
  stopAllAudio: () => void;
}

const useBeginLessonQuiz = (state: StudyReviewSessionState) => {
  const { setCurrentIndex, setLessonPhase, setRevealed } = state;
  return useCallback(() => {
    setCurrentIndex(0);
    setRevealed(false);
    setLessonPhase('quiz');
  }, [setCurrentIndex, setLessonPhase, setRevealed]);
};

const usePracticeModeActions = (
  state: StudyReviewSessionState,
  resetStudyAudioAutoplay: () => void,
  resetUndo: () => void,
  stopAllAudio: () => void
) => {
  const {
    cardStartedAtRef,
    setCurrentIndex,
    setEditing,
    setMasteryAnimation,
    setPracticeCards,
    setPracticeInitialCount,
    setRevealed,
    setSessionError,
    setShowSetDueControls,
  } = state;
  const startToughestPractice = useCallback(
    (nextCards: StudyCardSummary[]) => {
      if (nextCards.length === 0) return;
      stopAllAudio();
      resetStudyAudioAutoplay();
      resetUndo();
      setMasteryAnimation(null);
      setPracticeCards([...nextCards]);
      setPracticeInitialCount(nextCards.length);
      setCurrentIndex(0);
      setRevealed(false);
      setEditing(false);
      setShowSetDueControls(false);
      setSessionError(null);
      cardStartedAtRef.current = Date.now();
    },
    [
      cardStartedAtRef,
      resetStudyAudioAutoplay,
      resetUndo,
      setCurrentIndex,
      setEditing,
      setMasteryAnimation,
      setPracticeCards,
      setPracticeInitialCount,
      setRevealed,
      setSessionError,
      setShowSetDueControls,
      stopAllAudio,
    ]
  );
  const exitPracticeMode = useCallback(() => {
    stopAllAudio();
    resetStudyAudioAutoplay();
    setPracticeCards(null);
    setPracticeInitialCount(0);
    setCurrentIndex(0);
    setRevealed(false);
    setSessionError(null);
  }, [
    resetStudyAudioAutoplay,
    setCurrentIndex,
    setPracticeCards,
    setPracticeInitialCount,
    setRevealed,
    setSessionError,
    stopAllAudio,
  ]);
  return { exitPracticeMode, startToughestPractice };
};

const useLoadNextLessonBatch = (state: StudyReviewSessionState, loadSession: LoadStudySession) => {
  const {
    activeLessonCohortIdRef,
    answeredCardIdsRef,
    setAnsweredCardIds,
    setCurrentIndex,
    setRevealed,
  } = state;
  return useCallback(async () => {
    answeredCardIdsRef.current = new Set();
    setAnsweredCardIds([]);
    setCurrentIndex(0);
    setRevealed(false);
    await loadSession('lessons', {
      lessonCohortId: activeLessonCohortIdRef.current ?? undefined,
    });
  }, [
    activeLessonCohortIdRef,
    answeredCardIdsRef,
    loadSession,
    setAnsweredCardIds,
    setCurrentIndex,
    setRevealed,
  ]);
};

const useStudyReviewModeActions = ({
  loadSession,
  resetStudyAudioAutoplay,
  resetUndo,
  state,
  stopAllAudio,
}: UseStudyReviewModeActionsOptions) => {
  const beginLessonQuiz = useBeginLessonQuiz(state);
  const { exitPracticeMode, startToughestPractice } = usePracticeModeActions(
    state,
    resetStudyAudioAutoplay,
    resetUndo,
    stopAllAudio
  );
  const loadNextLessonBatch = useLoadNextLessonBatch(state, loadSession);
  return { beginLessonQuiz, exitPracticeMode, loadNextLessonBatch, startToughestPractice };
};

export default useStudyReviewModeActions;
