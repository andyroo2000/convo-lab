import useStudyAnswerAudioPrep from './useStudyAnswerAudioPrep';
import useStudyAudioAutoplay from './useStudyAudioAutoplay';
import useStudyReviewSessionCardState from './useStudyReviewSessionCardState';
import useStudyReviewUndoAction from './useStudyReviewUndoAction';
import useStudyUndoStack from './useStudyUndoStack';
import type { StudyUndoAction } from './studyReviewSessionUtils';
import { isStudyAudioAutoplayBlocked } from './studyReviewSessionOrchestration';
import type { StudyReviewSessionCore } from './useStudyReviewSessionCore';
import { useStudyAsyncSessionErrorReporter } from './useStudyReviewSessionState';

const useStudyReviewSessionMedia = (core: StudyReviewSessionCore) => {
  const reportAsyncSessionError = useStudyAsyncSessionErrorReporter(
    core.state.canSurfaceAsyncSessionErrorRef,
    core.state.setSessionError
  );
  const undoStack = useStudyUndoStack<StudyUndoAction>();
  const cardState = useStudyReviewSessionCardState({
    answeredCardIds: core.state.answeredCardIds,
    answeredCardIdsRef: core.state.answeredCardIdsRef,
    currentIndex: core.state.currentIndex,
    getCachedOverview: core.getCachedOverview,
    revealed: core.state.revealed,
    session: core.state.session,
    setSession: core.state.setSession,
  });
  const ensureAnswerAudioPrepared = useStudyAnswerAudioPrep({
    enabled: core.state.focusMode,
    mergeCardIntoSession: cardState.mergeCardIntoSession,
    onError: reportAsyncSessionError,
  });
  const audio = useStudyAudioAutoplay({
    autoplayBlocked: isStudyAudioAutoplayBlocked(core.state),
    cards: core.presentedCards,
    currentCard: core.currentCard,
    ensureAnswerAudioPrepared,
    focusMode: core.state.focusMode,
    runBackgroundTask: core.runBackgroundTask,
    revealed: core.state.revealed,
  });

  return {
    ...audio,
    ...cardState,
    ...undoStack,
    ensureAnswerAudioPrepared,
    reportAsyncSessionError,
  };
};

type StudyReviewSessionMedia = ReturnType<typeof useStudyReviewSessionMedia>;

const useStudyReviewSessionUndo = (core: StudyReviewSessionCore, media: StudyReviewSessionMedia) =>
  useStudyReviewUndoAction({
    achievementAwards: core.achievementAwards,
    achievementCompletion: core.state.achievementCompletion,
    achievementCompletionRequestIdRef: core.state.achievementCompletionRequestIdRef,
    achievementSessionStore: core.achievementSessionStore,
    activeAchievementCompletionRequestRef: core.state.activeAchievementCompletionRequestRef,
    answeredCardIdsRef: core.state.answeredCardIdsRef,
    cardActionPending: core.cardActionMutation.isPending,
    editing: core.state.editing,
    masteryAnimation: core.state.masteryAnimation,
    pendingReviewOperationRef: core.state.pendingReviewOperationRef,
    popUndo: media.popUndo,
    pushUndo: media.pushUndo,
    requestGuardRef: core.state.requestGuardRef,
    reviewPending: core.reviewMutation.isPending,
    sessionEpochRef: core.state.sessionEpochRef,
    sessionLoading: core.state.sessionLoading,
    setAchievementCelebrationPresented: core.state.setAchievementCelebrationPresented,
    setAchievementCompletion: core.state.setAchievementCompletion,
    setAchievementCompletionRefreshPending: core.state.setAchievementCompletionRefreshPending,
    setAnsweredCardIds: core.state.setAnsweredCardIds,
    setCurrentAchievementIndex: core.state.setCurrentAchievementIndex,
    setCurrentIndex: core.state.setCurrentIndex,
    setRevealed: core.state.setRevealed,
    setSession: core.state.setSession,
    setSessionError: core.state.setSessionError,
    setSessionReviewRecords: core.state.setSessionReviewRecords,
    setSessionWasEnded: core.state.setSessionWasEnded,
    setShowSetDueControls: core.state.setShowSetDueControls,
    setUndoPending: core.state.setUndoPending,
    stopAllAudio: media.stopAllAudio,
    syncAchievements: core.syncAchievements,
    syncOverview: core.syncOverview,
    undoAchievementReview: core.undoAchievementReview,
    undoPending: core.state.undoPending,
  });

const useStudyReviewSessionInteractions = (core: StudyReviewSessionCore) => {
  const media = useStudyReviewSessionMedia(core);
  return { ...media, handleUndo: useStudyReviewSessionUndo(core, media) };
};

export type StudyReviewSessionInteractions = ReturnType<typeof useStudyReviewSessionInteractions>;

export default useStudyReviewSessionInteractions;
