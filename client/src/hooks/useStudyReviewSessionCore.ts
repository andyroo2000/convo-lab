import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { StudyCardSummary, StudyOverview } from '@languageflow/shared/src/types';
import { getCachedStudyOverview } from './studyReviewSessionOrchestration';

import useStudyBackgroundTask from './useStudyBackgroundTask';

import useStudyReviewSessionDerivedState from './useStudyReviewSessionDerivedState';
import useStudyReviewSessionState, { isStudyReviewBusy } from './useStudyReviewSessionState';
import useStudySessionLoader from './useStudySessionLoader';
import {
  useDeleteStudyCard,
  useRegenerateStudyAnswerAudio,
  useRegenerateStudyCardImage,
  useStudyCardAction,
  useSubmitStudyReview,
  useUpdateStudyCard,
} from './useStudy';

const useStudyReviewSessionBase = () => {
  const queryClient = useQueryClient();
  const reviewMutation = useSubmitStudyReview();
  const cardActionMutation = useStudyCardAction();
  const updateCardMutation = useUpdateStudyCard();
  const deleteCardMutation = useDeleteStudyCard();
  const regenerateAudioMutation = useRegenerateStudyAnswerAudio();
  const regenerateImageMutation = useRegenerateStudyCardImage();
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
    regenerateImageMutation,
    reviewMutation,
    runBackgroundTask,
    state,
    syncOverview,
    updateCardMutation,
    ...sessionLoader,
  };
};

type StudyReviewSessionBase = ReturnType<typeof useStudyReviewSessionBase>;

const useStudyReviewSessionPresentation = (base: StudyReviewSessionBase) => {
  const presentation = useStudyReviewSessionDerivedState({
    answeredCardIds: base.state.answeredCardIds,
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

const useStudyReviewSessionCoreLifecycle = (base: StudyReviewSessionBase) => {
  const { state } = base;
  useEffect(() => {
    state.answeredCardIdsRef.current = new Set(state.answeredCardIds);
  }, [state.answeredCardIds, state.answeredCardIdsRef]);
  useEffect(() => {
    state.canSurfaceAsyncSessionErrorRef.current = state.focusMode;
  }, [state.canSurfaceAsyncSessionErrorRef, state.focusMode]);

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
  const presentation = useStudyReviewSessionPresentation(base);
  useStudyReviewSessionCoreLifecycle(base);
  return { ...base, ...presentation };
};

export type StudyReviewSessionCore = ReturnType<typeof useStudyReviewSessionCore>;

export default useStudyReviewSessionCore;
