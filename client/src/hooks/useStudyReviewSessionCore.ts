import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { StudyCardSummary, StudyOverview } from '@languageflow/shared/src/types';

import { useAuth } from '../contexts/AuthContext';
import useStudyAchievementReviewSession from './useStudyAchievementReviewSession';
import useStudyAchievementSync from './useStudyAchievementSync';
import useStudyBackgroundTask from './useStudyBackgroundTask';
import useStudyInterruptedAchievementRecovery from './useStudyInterruptedAchievementRecovery';
import useStudyReviewSessionDerivedState from './useStudyReviewSessionDerivedState';
import useStudyReviewSessionState, { isStudyReviewBusy } from './useStudyReviewSessionState';
import useStudySessionLoader from './useStudySessionLoader';
import {
  useDeleteStudyCard,
  useRegenerateStudyAnswerAudio,
  useStudyCardAction,
  useSubmitStudyReview,
  useUpdateStudyCard,
} from './useStudy';
import {
  getAchievementAwards,
  getCachedStudyOverview,
  getStudyUserId,
} from './studyReviewSessionOrchestration';

const useStudyReviewSessionBase = () => {
  const userId = getStudyUserId(useAuth().user);
  const queryClient = useQueryClient();
  const reviewMutation = useSubmitStudyReview();
  const cardActionMutation = useStudyCardAction();
  const updateCardMutation = useUpdateStudyCard();
  const deleteCardMutation = useDeleteStudyCard();
  const regenerateAudioMutation = useRegenerateStudyAnswerAudio();
  const state = useStudyReviewSessionState();
  const runBackgroundTask = useStudyBackgroundTask();
  const getCachedOverview = useCallback(() => getCachedStudyOverview(queryClient), [queryClient]);
  const syncOverview = useCallback(
    (overview: StudyOverview) => queryClient.setQueryData(['study', 'overview'], overview),
    [queryClient]
  );
  const sessionLoader = useStudySessionLoader({
    autoRefreshEmptySessionRef: state.autoRefreshEmptySessionRef,
    sessionEpochRef: state.sessionEpochRef,
    sessionKind: state.sessionKind,
    setLessonPhase: state.setLessonPhase,
    setSession: state.setSession,
    setSessionError: state.setSessionError,
    setSessionLoading: state.setSessionLoading,
    syncOverview,
  });

  return {
    cardActionMutation,
    deleteCardMutation,
    getCachedOverview,
    queryClient,
    regenerateAudioMutation,
    reviewMutation,
    runBackgroundTask,
    state,
    syncOverview,
    updateCardMutation,
    userId,
    ...sessionLoader,
  };
};

type StudyReviewSessionBase = ReturnType<typeof useStudyReviewSessionBase>;

const useStudyReviewSessionAchievements = (base: StudyReviewSessionBase) => {
  const syncState = useStudyAchievementSync();
  const sessionState = useStudyAchievementReviewSession({
    achievementProgress: syncState.achievementProgress,
    hasFreshAchievementProgress: syncState.hasFreshAchievementProgress,
    runBackgroundTask: base.runBackgroundTask,
    syncAchievements: syncState.syncAchievements,
    userId: base.userId,
  });

  return {
    achievementAwards: getAchievementAwards(syncState.achievementProgress),
    ...sessionState,
    ...syncState,
  };
};

type StudyReviewSessionAchievements = ReturnType<typeof useStudyReviewSessionAchievements>;

const useStudyReviewSessionPresentation = (
  base: StudyReviewSessionBase,
  achievements: StudyReviewSessionAchievements
) => {
  const presentation = useStudyReviewSessionDerivedState({
    achievementCatalog: achievements.achievementCatalog,
    achievementCelebrationPresented: base.state.achievementCelebrationPresented,
    achievementCompletion: base.state.achievementCompletion,
    achievementProgress: achievements.achievementProgress,
    answeredCardIds: base.state.answeredCardIds,
    currentAchievementIndex: base.state.currentAchievementIndex,
    currentIndex: base.state.currentIndex,
    focusMode: base.state.focusMode,
    practiceCards: base.state.practiceCards,
    practiceInitialCount: base.state.practiceInitialCount,
    regenerateAudioError: base.regenerateAudioMutation.error,
    session: base.state.session,
    sessionCardCount: base.sessionCardCountRef.current,
    sessionKind: base.state.sessionKind,
    sessionReviewRecords: base.state.sessionReviewRecords,
    sessionWasEnded: base.state.sessionWasEnded,
    updateCardError: base.updateCardMutation.error,
  });
  const currentCardRef = useRef<StudyCardSummary | null>(
    null
  ) as MutableRefObject<StudyCardSummary | null>;
  currentCardRef.current = presentation.currentCard;

  return {
    ...presentation,
    currentCardRef,
    reviewBusy: isStudyReviewBusy(base.reviewMutation.isPending, base.state),
  };
};

const useStudyReviewSessionCoreLifecycle = (
  base: StudyReviewSessionBase,
  achievements: StudyReviewSessionAchievements
) => {
  const { state } = base;
  useEffect(() => {
    state.answeredCardIdsRef.current = new Set(state.answeredCardIds);
  }, [state.answeredCardIds, state.answeredCardIdsRef]);
  useEffect(() => {
    state.canSurfaceAsyncSessionErrorRef.current = state.focusMode;
  }, [state.canSurfaceAsyncSessionErrorRef, state.focusMode]);
  useStudyInterruptedAchievementRecovery({
    achievementSessionStore: achievements.achievementSessionStore,
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
    syncAchievements: achievements.syncAchievements,
  });
  useEffect(
    () => () => {
      state.sessionEpochRef.current += 1;
      state.requestGuardRef.current.reset();
      state.canSurfaceAsyncSessionErrorRef.current = false;
    },
    [state.canSurfaceAsyncSessionErrorRef, state.requestGuardRef, state.sessionEpochRef]
  );
};

const useStudyReviewSessionCore = () => {
  const base = useStudyReviewSessionBase();
  const achievements = useStudyReviewSessionAchievements(base);
  const presentation = useStudyReviewSessionPresentation(base, achievements);
  useStudyReviewSessionCoreLifecycle(base, achievements);
  return { ...achievements, ...base, ...presentation };
};

export type StudyReviewSessionCore = ReturnType<typeof useStudyReviewSessionCore>;

export default useStudyReviewSessionCore;
