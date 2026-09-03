import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { StudyCardSummary, StudyOverview } from '@languageflow/shared/src/types';

import {
  useRegenerateStudyAnswerAudio,
  useDeleteStudyCard,
  useStudyCardAction,
  useSubmitStudyReview,
  useUpdateStudyCard,
} from './useStudy';
import useStudyAudioAutoplay from './useStudyAudioAutoplay';
import useStudyAnswerAudioPrep from './useStudyAnswerAudioPrep';
import useStudyKeyboardShortcuts from './useStudyKeyboardShortcuts';
import { useStudyMotionUndo } from './useStudyMotionUndo';
import useStudyUndoStack from './useStudyUndoStack';
import useStudyBackgroundTask from './useStudyBackgroundTask';
import { type StudyUndoAction } from './studyReviewSessionUtils';
import { useAuth } from '../contexts/AuthContext';
import useStudyReviewSessionDerivedState from './useStudyReviewSessionDerivedState';
import useStudyAchievementSync from './useStudyAchievementSync';
import useStudyAchievementReviewSession from './useStudyAchievementReviewSession';
import useStudyEmptySessionRefresh from './useStudyEmptySessionRefresh';
import useStudySessionLoader from './useStudySessionLoader';
import useStudyReviewCardActions from './useStudyReviewCardActions';
import useStudyFocusModeLifecycle from './useStudyFocusModeLifecycle';
import useStudyCurrentCardMutations from './useStudyCurrentCardMutations';
import useStudySessionCompletion from './useStudySessionCompletion';
import useStudyReviewAudioControls from './useStudyReviewAudioControls';
import useStudyReviewWrapUpActions from './useStudyReviewWrapUpActions';
import useStudyReviewGrading from './useStudyReviewGrading';
import useStudyReviewSessionCardState from './useStudyReviewSessionCardState';
import useStudyInterruptedAchievementRecovery from './useStudyInterruptedAchievementRecovery';
import useStudyReviewUndoAction from './useStudyReviewUndoAction';
import useStudyReviewSessionState, {
  isStudyReviewBusy,
  useStudyAsyncSessionErrorReporter,
} from './useStudyReviewSessionState';
import useStudyReviewModeActions from './useStudyReviewModeActions';

const useStudyReviewSession = () => {
  const userId = useAuth().user?.id ?? null;
  const queryClient = useQueryClient();
  const reviewMutation = useSubmitStudyReview();
  const cardActionMutation = useStudyCardAction();
  const updateCardMutation = useUpdateStudyCard();
  const deleteCardMutation = useDeleteStudyCard();
  const regenerateAudioMutation = useRegenerateStudyAnswerAudio();
  const state = useStudyReviewSessionState();
  const { canSurfaceAsyncSessionErrorRef, setEditing, setSessionError, setShowSetDueControls } =
    state;
  const runBackgroundTask = useStudyBackgroundTask();
  const getCachedOverview = useCallback(
    () => queryClient.getQueryData<StudyOverview>(['study', 'overview']) ?? null,
    [queryClient]
  );
  const syncOverview = useCallback(
    (overview: StudyOverview) => {
      queryClient.setQueryData(['study', 'overview'], overview);
    },
    [queryClient]
  );
  const { loadSession, sessionCardCountRef } = useStudySessionLoader({
    autoRefreshEmptySessionRef: state.autoRefreshEmptySessionRef,
    sessionEpochRef: state.sessionEpochRef,
    sessionKind: state.sessionKind,
    setLessonPhase: state.setLessonPhase,
    setSession: state.setSession,
    setSessionError: state.setSessionError,
    setSessionLoading: state.setSessionLoading,
    syncOverview,
  });
  const { achievementCatalog, achievementProgress, hasFreshAchievementProgress, syncAchievements } =
    useStudyAchievementSync();
  const {
    achievementSessionBootstrapRef,
    achievementSessionStore,
    recordAchievementReview,
    startAchievementReviewSession,
    undoAchievementReview,
  } = useStudyAchievementReviewSession({
    achievementProgress,
    hasFreshAchievementProgress,
    runBackgroundTask,
    syncAchievements,
    userId,
  });

  const {
    cards,
    completionAchievements,
    currentAchievement,
    currentCard,
    practiceComplete,
    practiceMode,
    presentedCards,
    reviewQueueExhausted,
    reviewSessionComplete,
    sessionCounts,
    sessionProgress,
    sessionWrapUp,
    updateCardErrorMessage,
  } = useStudyReviewSessionDerivedState({
    achievementCatalog,
    achievementCelebrationPresented: state.achievementCelebrationPresented,
    achievementCompletion: state.achievementCompletion,
    achievementProgress,
    answeredCardIds: state.answeredCardIds,
    currentAchievementIndex: state.currentAchievementIndex,
    currentIndex: state.currentIndex,
    focusMode: state.focusMode,
    practiceCards: state.practiceCards,
    practiceInitialCount: state.practiceInitialCount,
    regenerateAudioError: regenerateAudioMutation.error,
    session: state.session,
    sessionCardCount: sessionCardCountRef.current,
    sessionKind: state.sessionKind,
    sessionReviewRecords: state.sessionReviewRecords,
    sessionWasEnded: state.sessionWasEnded,
    updateCardError: updateCardMutation.error,
  });
  // Ref so handlers always read the live card even if a background session update
  // races with a click (stale-closure guard). Cast needed for @types/react 18.3.5.
  const currentCardRef = useRef<StudyCardSummary | null>(
    null
  ) as MutableRefObject<StudyCardSummary | null>;
  currentCardRef.current = currentCard;
  const reviewBusy = isStudyReviewBusy(reviewMutation.isPending, state);

  useEffect(() => {
    state.answeredCardIdsRef.current = new Set(state.answeredCardIds);
  }, [state.answeredCardIds, state.answeredCardIdsRef]);

  useEffect(() => {
    state.canSurfaceAsyncSessionErrorRef.current = state.focusMode;
  }, [state.canSurfaceAsyncSessionErrorRef, state.focusMode]);

  useStudyInterruptedAchievementRecovery({
    achievementSessionStore,
    canSurfaceAsyncSessionErrorRef: state.canSurfaceAsyncSessionErrorRef,
    sessionEpochRef: state.sessionEpochRef,
    setAchievementCelebrationPresented: state.setAchievementCelebrationPresented,
    setAchievementCompletion: state.setAchievementCompletion,
    setCurrentAchievementIndex: state.setCurrentAchievementIndex,
    setCurrentIndex: state.setCurrentIndex,
    setEditing: state.setEditing,
    setFocusMode: state.setFocusMode,
    setLessonPhase: state.setLessonPhase,
    setMasteryAnimation: state.setMasteryAnimation,
    setRevealed: state.setRevealed,
    setReviewConflictRecovered: state.setReviewConflictRecovered,
    setSession: state.setSession,
    setSessionError: state.setSessionError,
    setSessionKind: state.setSessionKind,
    setSessionLoading: state.setSessionLoading,
    setSessionReviewRecords: state.setSessionReviewRecords,
    setSessionWasEnded: state.setSessionWasEnded,
    setShowSetDueControls: state.setShowSetDueControls,
    syncAchievements,
  });

  useEffect(
    () => () => {
      state.sessionEpochRef.current += 1;
      state.requestGuardRef.current.reset();
      state.canSurfaceAsyncSessionErrorRef.current = false;
    },
    [state.canSurfaceAsyncSessionErrorRef, state.requestGuardRef, state.sessionEpochRef]
  );

  const reportAsyncSessionError = useStudyAsyncSessionErrorReporter(
    canSurfaceAsyncSessionErrorRef,
    setSessionError
  );

  const { popUndo, pushUndo, resetUndo } = useStudyUndoStack<StudyUndoAction>();

  const {
    applyReviewResultToSession,
    captureUndoSnapshot,
    mergeCardIntoSession,
    removeCardFromSession,
  } = useStudyReviewSessionCardState({
    answeredCardIds: state.answeredCardIds,
    answeredCardIdsRef: state.answeredCardIdsRef,
    currentIndex: state.currentIndex,
    getCachedOverview,
    revealed: state.revealed,
    session: state.session,
    setSession: state.setSession,
  });

  const ensureAnswerAudioPrepared = useStudyAnswerAudioPrep({
    enabled: state.focusMode,
    mergeCardIntoSession,
    onError: reportAsyncSessionError,
  });

  const {
    answerAudioRef,
    autoplayAnswerAudioForCard,
    promptAudioRef,
    resetAllAutoplay: resetStudyAudioAutoplay,
    resetAutoplayForCard: resetStudyAudioAutoplayForCard,
    stopAllAudio,
  } = useStudyAudioAutoplay({
    autoplayBlocked:
      state.masteryAnimation !== null ||
      state.reviewSubmitPending ||
      (state.sessionKind === 'lessons' && state.lessonPhase !== 'quiz'),
    cards: presentedCards,
    currentCard,
    ensureAnswerAudioPrepared,
    focusMode: state.focusMode,
    runBackgroundTask,
    revealed: state.revealed,
  });

  const handleUndo = useStudyReviewUndoAction({
    achievementAwards: achievementProgress?.awards ?? [],
    achievementCompletion: state.achievementCompletion,
    achievementCompletionRequestIdRef: state.achievementCompletionRequestIdRef,
    achievementSessionStore,
    activeAchievementCompletionRequestRef: state.activeAchievementCompletionRequestRef,
    answeredCardIdsRef: state.answeredCardIdsRef,
    cardActionPending: cardActionMutation.isPending,
    editing: state.editing,
    masteryAnimation: state.masteryAnimation,
    pendingReviewOperationRef: state.pendingReviewOperationRef,
    popUndo,
    pushUndo,
    requestGuardRef: state.requestGuardRef,
    reviewPending: reviewMutation.isPending,
    sessionEpochRef: state.sessionEpochRef,
    sessionLoading: state.sessionLoading,
    setAchievementCelebrationPresented: state.setAchievementCelebrationPresented,
    setAchievementCompletion: state.setAchievementCompletion,
    setAchievementCompletionRefreshPending: state.setAchievementCompletionRefreshPending,
    setAnsweredCardIds: state.setAnsweredCardIds,
    setCurrentAchievementIndex: state.setCurrentAchievementIndex,
    setCurrentIndex: state.setCurrentIndex,
    setRevealed: state.setRevealed,
    setSession: state.setSession,
    setSessionError: state.setSessionError,
    setSessionReviewRecords: state.setSessionReviewRecords,
    setSessionWasEnded: state.setSessionWasEnded,
    setShowSetDueControls: state.setShowSetDueControls,
    setUndoPending: state.setUndoPending,
    stopAllAudio,
    syncAchievements,
    syncOverview,
    undoAchievementReview,
    undoPending: state.undoPending,
  });

  const { revealCurrentCard, toggleAnswerAudio } = useStudyReviewAudioControls({
    answerAudioRef,
    autoplayAnswerAudioForCard,
    captureUndoSnapshot,
    currentCard,
    editing: state.editing,
    ensureAnswerAudioPrepared,
    pushUndo,
    reportAsyncSessionError,
    revealed: state.revealed,
    runBackgroundTask,
    setRevealed: state.setRevealed,
    stopAllAudio,
  });

  const prepareSessionCompletion = useStudySessionCompletion({
    achievementAwards: achievementProgress?.awards ?? [],
    achievementCompletion: state.achievementCompletion,
    achievementCompletionRequestIdRef: state.achievementCompletionRequestIdRef,
    achievementSessionStore,
    activeAchievementCompletionRequestRef: state.activeAchievementCompletionRequestRef,
    masteryAnimation: state.masteryAnimation,
    reviewQueueExhausted,
    runBackgroundTask,
    sessionEpochRef: state.sessionEpochRef,
    setAchievementCelebrationPresented: state.setAchievementCelebrationPresented,
    setAchievementCompletion: state.setAchievementCompletion,
    setAchievementCompletionRefreshPending: state.setAchievementCompletionRefreshPending,
    setCurrentAchievementIndex: state.setCurrentAchievementIndex,
    setSessionWasEnded: state.setSessionWasEnded,
    syncAchievements,
  });

  const { handleGrade, retryPendingReview } = useStudyReviewGrading({
    activeLessonCohortIdRef: state.activeLessonCohortIdRef,
    achievementAwards: achievementProgress?.awards ?? [],
    achievementSessionBootstrapRef,
    achievementSessionStore,
    answeredCardIdsRef: state.answeredCardIdsRef,
    applyReviewResultToSession,
    autoRefreshEmptySessionRef: state.autoRefreshEmptySessionRef,
    cards,
    cardStartedAtRef: state.cardStartedAtRef,
    captureUndoSnapshot,
    currentCard,
    currentIndex: state.currentIndex,
    editing: state.editing,
    loadSession,
    masteryAnimation: state.masteryAnimation,
    pendingReviewOperationRef: state.pendingReviewOperationRef,
    practiceMode,
    pushUndo,
    queryClient,
    recordAchievementReview,
    requestGuardRef: state.requestGuardRef,
    resetStudyAudioAutoplayForCard,
    resetUndo,
    reviewPending: reviewMutation.isPending,
    sessionEpochRef: state.sessionEpochRef,
    sessionKind: state.sessionKind,
    setAchievementCelebrationPresented: state.setAchievementCelebrationPresented,
    setAchievementCompletion: state.setAchievementCompletion,
    setAnsweredCardIds: state.setAnsweredCardIds,
    setCurrentAchievementIndex: state.setCurrentAchievementIndex,
    setCurrentIndex: state.setCurrentIndex,
    setEditing: state.setEditing,
    setLessonPhase: state.setLessonPhase,
    setMasteryAnimation: state.setMasteryAnimation,
    setPracticeCards: state.setPracticeCards,
    setRevealed: state.setRevealed,
    setReviewConflictRecovered: state.setReviewConflictRecovered,
    setReviewRetryAvailable: state.setReviewRetryAvailable,
    setReviewSubmitPending: state.setReviewSubmitPending,
    setSession: state.setSession,
    setSessionError: state.setSessionError,
    setSessionReviewRecords: state.setSessionReviewRecords,
    setSessionWasEnded: state.setSessionWasEnded,
    setShowSetDueControls: state.setShowSetDueControls,
    stopAllAudio,
    submitReview: reviewMutation.mutateAsync,
    syncAchievements,
    syncOverview,
    undoPending: state.undoPending,
  });

  const { handleBuryForSession, handleCardAction } = useStudyReviewCardActions({
    autoRefreshEmptySessionRef: state.autoRefreshEmptySessionRef,
    cardActionMutation,
    cardsLength: cards.length,
    captureUndoSnapshot,
    currentCard,
    editing: state.editing,
    mergeCardIntoSession,
    pendingReviewOperationRef: state.pendingReviewOperationRef,
    pushUndo,
    removeCardFromSession,
    requestGuardRef: state.requestGuardRef,
    revealed: state.revealed,
    sessionEpochRef: state.sessionEpochRef,
    sessionKind: state.sessionKind,
    setAnsweredCardIds: state.setAnsweredCardIds,
    setCurrentIndex: state.setCurrentIndex,
    setLessonPhase: state.setLessonPhase,
    setRevealed: state.setRevealed,
    setSessionError: state.setSessionError,
    setShowSetDueControls: state.setShowSetDueControls,
    stopAllAudio,
    syncOverview,
  });

  const { deleteCurrentCard, regenerateCurrentCardAudio, saveCurrentCard } =
    useStudyCurrentCardMutations({
      autoRefreshEmptySessionRef: state.autoRefreshEmptySessionRef,
      cardsLength: cards.length,
      currentCardRef,
      deleteCard: deleteCardMutation.mutateAsync,
      mergeCardIntoSession,
      regenerateAnswerAudio: regenerateAudioMutation.mutateAsync,
      removeCardFromSession,
      resetAudioAutoplayForCard: resetStudyAudioAutoplayForCard,
      sessionEpochRef: state.sessionEpochRef,
      setAnsweredCardIds: state.setAnsweredCardIds,
      setCurrentIndex: state.setCurrentIndex,
      setEditing: state.setEditing,
      setRevealed: state.setRevealed,
      setSessionError: state.setSessionError,
      stopAllAudio,
      updateCard: updateCardMutation.mutateAsync,
    });

  const { motionPermissionState, requestMotionPermission } = useStudyMotionUndo({
    disabled:
      state.undoPending ||
      reviewMutation.isPending ||
      cardActionMutation.isPending ||
      state.sessionLoading ||
      state.editing ||
      state.masteryAnimation !== null,
    focusMode: state.focusMode,
    onShake: handleUndo,
    runBackgroundTask,
  });

  const { enterFocusMode, exitFocusMode } = useStudyFocusModeLifecycle({
    activeAchievementCompletionRequestRef: state.activeAchievementCompletionRequestRef,
    activeLessonCohortIdRef: state.activeLessonCohortIdRef,
    achievementCompletionRequestIdRef: state.achievementCompletionRequestIdRef,
    achievementSessionBootstrapRef,
    achievementSessionStore,
    answeredCardIdsRef: state.answeredCardIdsRef,
    autoRefreshEmptySessionRef: state.autoRefreshEmptySessionRef,
    canSurfaceAsyncSessionErrorRef: state.canSurfaceAsyncSessionErrorRef,
    loadSession,
    pendingReviewOperationRef: state.pendingReviewOperationRef,
    queryClient,
    requestGuardRef: state.requestGuardRef,
    requestMotionPermission,
    resetStudyAudioAutoplay,
    resetUndo,
    runBackgroundTask,
    sessionEpochRef: state.sessionEpochRef,
    setAchievementCelebrationPresented: state.setAchievementCelebrationPresented,
    setAchievementCompletion: state.setAchievementCompletion,
    setAchievementCompletionRefreshPending: state.setAchievementCompletionRefreshPending,
    setAnsweredCardIds: state.setAnsweredCardIds,
    setCurrentAchievementIndex: state.setCurrentAchievementIndex,
    setCurrentIndex: state.setCurrentIndex,
    setEditing: state.setEditing,
    setFocusMode: state.setFocusMode,
    setLessonPhase: state.setLessonPhase,
    setMasteryAnimation: state.setMasteryAnimation,
    setPracticeCards: state.setPracticeCards,
    setPracticeInitialCount: state.setPracticeInitialCount,
    setRevealed: state.setRevealed,
    setReviewConflictRecovered: state.setReviewConflictRecovered,
    setReviewRetryAvailable: state.setReviewRetryAvailable,
    setReviewSubmitPending: state.setReviewSubmitPending,
    setSession: state.setSession,
    setSessionError: state.setSessionError,
    setSessionKind: state.setSessionKind,
    setSessionLoading: state.setSessionLoading,
    setSessionReviewRecords: state.setSessionReviewRecords,
    setSessionWasEnded: state.setSessionWasEnded,
    setShowSetDueControls: state.setShowSetDueControls,
    setUndoPending: state.setUndoPending,
    startAchievementReviewSession,
    stopAllAudio,
  });

  const { beginLessonQuiz, exitPracticeMode, loadNextLessonBatch, startToughestPractice } =
    useStudyReviewModeActions({
      loadSession,
      resetStudyAudioAutoplay,
      resetUndo,
      state,
      stopAllAudio,
    });

  const { advanceAchievement, endReviewSession, finishReviewSession } = useStudyReviewWrapUpActions(
    {
      achievementCompletion: state.achievementCompletion,
      achievementCompletionRefreshPending: state.achievementCompletionRefreshPending,
      achievementSessionStore,
      completionAchievementCount: completionAchievements.length,
      currentAchievementIndex: state.currentAchievementIndex,
      exitFocusMode,
      exitPracticeMode,
      practiceMode,
      prepareSessionCompletion,
      sessionKind: state.sessionKind,
      sessionReviewRecordCount: state.sessionReviewRecords.length,
      setAchievementCelebrationPresented: state.setAchievementCelebrationPresented,
      setCurrentAchievementIndex: state.setCurrentAchievementIndex,
    }
  );

  useStudyEmptySessionRefresh({
    autoRefreshEmptySessionRef: state.autoRefreshEmptySessionRef,
    blocked:
      !state.focusMode ||
      practiceMode ||
      state.sessionLoading ||
      Boolean(state.sessionError) ||
      Boolean(currentCard) ||
      reviewBusy ||
      state.undoPending ||
      state.editing,
    getCachedOverview,
    loadSession,
    runBackgroundTask,
    sessionOverview: state.session?.overview,
  });

  useEffect(() => {
    stopAllAudio();
    state.cardStartedAtRef.current = Date.now();
  }, [currentCard?.id, state.cardStartedAtRef, stopAllAudio]);

  useEffect(() => {
    setEditing(false);
    setShowSetDueControls(false);
  }, [currentCard?.id, setEditing, setShowSetDueControls]);

  useEffect(() => {
    if (!state.focusMode) {
      stopAllAudio();
    }
  }, [state.focusMode, stopAllAudio]);

  useEffect(() => {
    if (!state.focusMode) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [state.focusMode]);

  useStudyKeyboardShortcuts({
    cardActionPending: cardActionMutation.isPending,
    editing: state.editing,
    exitFocusMode: endReviewSession,
    focusMode: state.focusMode,
    handleGrade,
    handleUndo,
    interactionBlocked: state.masteryAnimation !== null,
    onError: reportAsyncSessionError,
    revealCurrentCard,
    revealed: state.revealed,
    reviewPending: reviewMutation.isPending,
    reviewSubmitPending: state.reviewSubmitPending,
    runBackgroundTask,
    setEditing: practiceMode ? () => {} : state.setEditing,
    toggleAnswerAudio,
  });

  return {
    focusMode: state.focusMode,
    sessionKind: state.sessionKind,
    lessonPhase: state.lessonPhase,
    cards,
    masteryAnimation: state.masteryAnimation,
    sessionLoading: state.sessionLoading,
    sessionError: state.sessionError,
    reviewConflictRecovered: state.reviewConflictRecovered,
    currentCard,
    revealed: state.revealed,
    editing: state.editing,
    showSetDueControls: state.showSetDueControls,
    undoPending: state.undoPending,
    reviewBusy,
    reviewRetryAvailable: state.reviewRetryAvailable,
    sessionCounts,
    sessionProgress,
    sessionWrapUp,
    reviewQueueExhausted,
    reviewSessionComplete,
    achievementCompletion: state.achievementCompletion,
    achievementCatalog,
    achievementProgress,
    achievementCompletionRefreshPending: state.achievementCompletionRefreshPending,
    currentAchievement,
    currentAchievementIndex: state.currentAchievementIndex,
    completionAchievements,
    practiceMode,
    practiceComplete,
    motionPermissionState,
    promptAudioRef,
    answerAudioRef,
    reviewMutation,
    cardActionMutation,
    updateCardMutation,
    deleteCardMutation,
    regenerateAudioMutation,
    updateCardErrorMessage,
    setEditing: state.setEditing,
    setMasteryAnimation: state.setMasteryAnimation,
    setShowSetDueControls: state.setShowSetDueControls,
    revealCurrentCard,
    exitFocusMode,
    endReviewSession,
    advanceAchievement,
    finishReviewSession,
    handleGrade,
    retryPendingReview,
    handleBuryForSession,
    handleCardAction,
    handleUndo,
    requestMotionPermission,
    saveCurrentCard,
    deleteCurrentCard,
    regenerateCurrentCardAudio,
    enterFocusMode,
    beginLessonQuiz,
    loadNextLessonBatch,
    startToughestPractice,
    exitPracticeMode,
  };
};

export default useStudyReviewSession;
