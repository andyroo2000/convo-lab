import { useEffect } from 'react';

import useStudyEmptySessionRefresh from './useStudyEmptySessionRefresh';
import useStudyFocusModeLifecycle from './useStudyFocusModeLifecycle';
import useStudyKeyboardShortcuts from './useStudyKeyboardShortcuts';
import { useStudyMotionUndo } from './useStudyMotionUndo';
import useStudyReviewModeActions from './useStudyReviewModeActions';
import useStudyReviewWrapUpActions from './useStudyReviewWrapUpActions';
import {
  getStudyEditingHandler,
  isEmptySessionRefreshBlocked,
  isStudyMotionUndoDisabled,
} from './studyReviewSessionOrchestration';
import type { StudyReviewSessionActions } from './useStudyReviewSessionActions';
import type { StudyReviewSessionCore } from './useStudyReviewSessionCore';
import type { StudyReviewSessionInteractions } from './useStudyReviewSessionInteractions';

const useReviewFocusLifecycle = (
  core: StudyReviewSessionCore,
  interactions: StudyReviewSessionInteractions
) => {
  const motion = useStudyMotionUndo({
    disabled: isStudyMotionUndoDisabled(
      core.state,
      core.reviewMutation.isPending,
      core.cardActionMutation.isPending
    ),
    focusMode: core.state.focusMode,
    onShake: interactions.handleUndo,
    runBackgroundTask: core.runBackgroundTask,
  });
  const focus = useStudyFocusModeLifecycle({
    activeAchievementCompletionRequestRef: core.state.activeAchievementCompletionRequestRef,
    activeLessonCohortIdRef: core.state.activeLessonCohortIdRef,
    achievementCompletionRequestIdRef: core.state.achievementCompletionRequestIdRef,
    achievementSessionBootstrapRef: core.achievementSessionBootstrapRef,
    achievementSessionStore: core.achievementSessionStore,
    answeredCardIdsRef: core.state.answeredCardIdsRef,
    autoRefreshEmptySessionRef: core.state.autoRefreshEmptySessionRef,
    canSurfaceAsyncSessionErrorRef: core.state.canSurfaceAsyncSessionErrorRef,
    loadSession: core.loadSession,
    pendingReviewOperationRef: core.state.pendingReviewOperationRef,
    queryClient: core.queryClient,
    requestGuardRef: core.state.requestGuardRef,
    requestMotionPermission: motion.requestMotionPermission,
    resetStudyAudioAutoplay: interactions.resetAllAutoplay,
    resetUndo: interactions.resetUndo,
    runBackgroundTask: core.runBackgroundTask,
    sessionEpochRef: core.state.sessionEpochRef,
    setAchievementCelebrationPresented: core.state.setAchievementCelebrationPresented,
    setAchievementCompletion: core.state.setAchievementCompletion,
    setAchievementCompletionRefreshPending: core.state.setAchievementCompletionRefreshPending,
    setAnsweredCardIds: core.state.setAnsweredCardIds,
    setCurrentAchievementIndex: core.state.setCurrentAchievementIndex,
    setCurrentIndex: core.state.setCurrentIndex,
    setEditing: core.state.setEditing,
    setFocusMode: core.state.setFocusMode,
    setLessonPhase: core.state.setLessonPhase,
    setMasteryAnimation: core.state.setMasteryAnimation,
    setPracticeCards: core.state.setPracticeCards,
    setPracticeInitialCount: core.state.setPracticeInitialCount,
    setRevealed: core.state.setRevealed,
    setReviewConflictRecovered: core.state.setReviewConflictRecovered,
    setReviewRetryAvailable: core.state.setReviewRetryAvailable,
    setReviewSubmitPending: core.state.setReviewSubmitPending,
    setSession: core.state.setSession,
    setSessionError: core.state.setSessionError,
    setSessionKind: core.state.setSessionKind,
    setSessionLoading: core.state.setSessionLoading,
    setSessionReviewRecords: core.state.setSessionReviewRecords,
    setSessionWasEnded: core.state.setSessionWasEnded,
    setShowSetDueControls: core.state.setShowSetDueControls,
    setUndoPending: core.state.setUndoPending,
    startAchievementReviewSession: core.startAchievementReviewSession,
    stopAllAudio: interactions.stopAllAudio,
  });
  return { ...focus, ...motion };
};

type ReviewFocusLifecycle = ReturnType<typeof useReviewFocusLifecycle>;

const useReviewModeLifecycle = (
  core: StudyReviewSessionCore,
  interactions: StudyReviewSessionInteractions,
  actions: StudyReviewSessionActions,
  focus: ReviewFocusLifecycle
) => {
  const modes = useStudyReviewModeActions({
    loadSession: core.loadSession,
    resetStudyAudioAutoplay: interactions.resetAllAutoplay,
    resetUndo: interactions.resetUndo,
    state: core.state,
    stopAllAudio: interactions.stopAllAudio,
  });
  const wrapUp = useStudyReviewWrapUpActions({
    achievementCompletion: core.state.achievementCompletion,
    achievementCompletionRefreshPending: core.state.achievementCompletionRefreshPending,
    achievementSessionStore: core.achievementSessionStore,
    completionAchievementCount: core.completionAchievements.length,
    currentAchievementIndex: core.state.currentAchievementIndex,
    exitFocusMode: focus.exitFocusMode,
    exitPracticeMode: modes.exitPracticeMode,
    practiceMode: core.practiceMode,
    prepareSessionCompletion: actions.prepareSessionCompletion,
    sessionKind: core.state.sessionKind,
    sessionReviewRecordCount: core.state.sessionReviewRecords.length,
    setAchievementCelebrationPresented: core.state.setAchievementCelebrationPresented,
    setCurrentAchievementIndex: core.state.setCurrentAchievementIndex,
  });
  return { ...modes, ...wrapUp };
};

type ReviewModeLifecycle = ReturnType<typeof useReviewModeLifecycle>;

const useReviewPresentationLifecycle = (
  core: StudyReviewSessionCore,
  interactions: StudyReviewSessionInteractions
) => {
  const { cardStartedAtRef, focusMode, setEditing, setShowSetDueControls } = core.state;
  const { stopAllAudio } = interactions;
  const currentCardId = core.currentCard?.id;
  useStudyEmptySessionRefresh({
    autoRefreshEmptySessionRef: core.state.autoRefreshEmptySessionRef,
    blocked: isEmptySessionRefreshBlocked(
      core.state,
      core.practiceMode,
      Boolean(core.currentCard),
      core.reviewBusy
    ),
    getCachedOverview: core.getCachedOverview,
    loadSession: core.loadSession,
    runBackgroundTask: core.runBackgroundTask,
    sessionOverview: core.state.session?.overview,
  });
  useEffect(() => {
    stopAllAudio();
    cardStartedAtRef.current = Date.now();
  }, [cardStartedAtRef, currentCardId, stopAllAudio]);
  useEffect(() => {
    setEditing(false);
    setShowSetDueControls(false);
  }, [currentCardId, setEditing, setShowSetDueControls]);
  useEffect(() => {
    if (!focusMode) stopAllAudio();
  }, [focusMode, stopAllAudio]);
  useEffect(() => {
    if (!focusMode) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [focusMode]);
};

const useReviewKeyboard = (
  core: StudyReviewSessionCore,
  interactions: StudyReviewSessionInteractions,
  actions: StudyReviewSessionActions,
  modes: ReviewModeLifecycle
) =>
  useStudyKeyboardShortcuts({
    cardActionPending: core.cardActionMutation.isPending,
    editing: core.state.editing,
    exitFocusMode: modes.endReviewSession,
    focusMode: core.state.focusMode,
    handleGrade: actions.handleGrade,
    handleUndo: interactions.handleUndo,
    interactionBlocked: core.state.masteryAnimation !== null,
    onError: interactions.reportAsyncSessionError,
    revealCurrentCard: actions.revealCurrentCard,
    revealed: core.state.revealed,
    reviewPending: core.reviewMutation.isPending,
    reviewSubmitPending: core.state.reviewSubmitPending,
    runBackgroundTask: core.runBackgroundTask,
    setEditing: getStudyEditingHandler(core.practiceMode, core.state.setEditing),
    toggleAnswerAudio: actions.toggleAnswerAudio,
  });

const useStudyReviewSessionLifecycle = (
  core: StudyReviewSessionCore,
  interactions: StudyReviewSessionInteractions,
  actions: StudyReviewSessionActions
) => {
  const focus = useReviewFocusLifecycle(core, interactions);
  const modes = useReviewModeLifecycle(core, interactions, actions, focus);
  useReviewPresentationLifecycle(core, interactions);
  useReviewKeyboard(core, interactions, actions, modes);
  return { ...focus, ...modes };
};

export type StudyReviewSessionLifecycle = ReturnType<typeof useStudyReviewSessionLifecycle>;

export default useStudyReviewSessionLifecycle;
