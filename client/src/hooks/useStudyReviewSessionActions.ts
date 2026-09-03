import useStudyCurrentCardMutations from './useStudyCurrentCardMutations';
import useStudyReviewAudioControls from './useStudyReviewAudioControls';
import useStudyReviewCardActions from './useStudyReviewCardActions';
import useStudyReviewGrading from './useStudyReviewGrading';
import useStudySessionCompletion from './useStudySessionCompletion';
import type { StudyReviewSessionCore } from './useStudyReviewSessionCore';
import type { StudyReviewSessionInteractions } from './useStudyReviewSessionInteractions';

const useReviewAudioControls = (
  core: StudyReviewSessionCore,
  interactions: StudyReviewSessionInteractions
) =>
  useStudyReviewAudioControls({
    answerAudioRef: interactions.answerAudioRef,
    autoplayAnswerAudioForCard: interactions.autoplayAnswerAudioForCard,
    captureUndoSnapshot: interactions.captureUndoSnapshot,
    currentCard: core.currentCard,
    editing: core.state.editing,
    ensureAnswerAudioPrepared: interactions.ensureAnswerAudioPrepared,
    pushUndo: interactions.pushUndo,
    reportAsyncSessionError: interactions.reportAsyncSessionError,
    revealed: core.state.revealed,
    runBackgroundTask: core.runBackgroundTask,
    setRevealed: core.state.setRevealed,
    stopAllAudio: interactions.stopAllAudio,
  });

const useReviewSessionCompletion = (core: StudyReviewSessionCore) =>
  useStudySessionCompletion({
    achievementAwards: core.achievementAwards,
    achievementCompletion: core.state.achievementCompletion,
    achievementCompletionRequestIdRef: core.state.achievementCompletionRequestIdRef,
    achievementSessionStore: core.achievementSessionStore,
    activeAchievementCompletionRequestRef: core.state.activeAchievementCompletionRequestRef,
    masteryAnimation: core.state.masteryAnimation,
    reviewQueueExhausted: core.reviewQueueExhausted,
    runBackgroundTask: core.runBackgroundTask,
    sessionEpochRef: core.state.sessionEpochRef,
    setAchievementCelebrationPresented: core.state.setAchievementCelebrationPresented,
    setAchievementCompletion: core.state.setAchievementCompletion,
    setAchievementCompletionRefreshPending: core.state.setAchievementCompletionRefreshPending,
    setCurrentAchievementIndex: core.state.setCurrentAchievementIndex,
    setSessionWasEnded: core.state.setSessionWasEnded,
    syncAchievements: core.syncAchievements,
  });

const useReviewGrading = (
  core: StudyReviewSessionCore,
  interactions: StudyReviewSessionInteractions
) =>
  useStudyReviewGrading({
    activeLessonCohortIdRef: core.state.activeLessonCohortIdRef,
    achievementAwards: core.achievementAwards,
    achievementSessionBootstrapRef: core.achievementSessionBootstrapRef,
    achievementSessionStore: core.achievementSessionStore,
    answeredCardIdsRef: core.state.answeredCardIdsRef,
    applyReviewResultToSession: interactions.applyReviewResultToSession,
    autoRefreshEmptySessionRef: core.state.autoRefreshEmptySessionRef,
    cards: core.cards,
    cardStartedAtRef: core.state.cardStartedAtRef,
    captureUndoSnapshot: interactions.captureUndoSnapshot,
    currentCard: core.currentCard,
    currentIndex: core.state.currentIndex,
    editing: core.state.editing,
    loadSession: core.loadSession,
    masteryAnimation: core.state.masteryAnimation,
    pendingReviewOperationRef: core.state.pendingReviewOperationRef,
    practiceMode: core.practiceMode,
    pushUndo: interactions.pushUndo,
    queryClient: core.queryClient,
    recordAchievementReview: core.recordAchievementReview,
    requestGuardRef: core.state.requestGuardRef,
    resetStudyAudioAutoplayForCard: interactions.resetAutoplayForCard,
    resetUndo: interactions.resetUndo,
    reviewPending: core.reviewMutation.isPending,
    sessionEpochRef: core.state.sessionEpochRef,
    sessionKind: core.state.sessionKind,
    setAchievementCelebrationPresented: core.state.setAchievementCelebrationPresented,
    setAchievementCompletion: core.state.setAchievementCompletion,
    setAnsweredCardIds: core.state.setAnsweredCardIds,
    setCurrentAchievementIndex: core.state.setCurrentAchievementIndex,
    setCurrentIndex: core.state.setCurrentIndex,
    setEditing: core.state.setEditing,
    setLessonPhase: core.state.setLessonPhase,
    setMasteryAnimation: core.state.setMasteryAnimation,
    setPracticeCards: core.state.setPracticeCards,
    setRevealed: core.state.setRevealed,
    setReviewConflictRecovered: core.state.setReviewConflictRecovered,
    setReviewRetryAvailable: core.state.setReviewRetryAvailable,
    setReviewSubmitPending: core.state.setReviewSubmitPending,
    setSession: core.state.setSession,
    setSessionError: core.state.setSessionError,
    setSessionReviewRecords: core.state.setSessionReviewRecords,
    setSessionWasEnded: core.state.setSessionWasEnded,
    setShowSetDueControls: core.state.setShowSetDueControls,
    stopAllAudio: interactions.stopAllAudio,
    submitReview: core.reviewMutation.mutateAsync,
    syncAchievements: core.syncAchievements,
    syncOverview: core.syncOverview,
    undoPending: core.state.undoPending,
  });

const useReviewCardActions = (
  core: StudyReviewSessionCore,
  interactions: StudyReviewSessionInteractions
) =>
  useStudyReviewCardActions({
    autoRefreshEmptySessionRef: core.state.autoRefreshEmptySessionRef,
    cardActionMutation: core.cardActionMutation,
    cardsLength: core.cards.length,
    captureUndoSnapshot: interactions.captureUndoSnapshot,
    currentCard: core.currentCard,
    editing: core.state.editing,
    mergeCardIntoSession: interactions.mergeCardIntoSession,
    pendingReviewOperationRef: core.state.pendingReviewOperationRef,
    pushUndo: interactions.pushUndo,
    removeCardFromSession: interactions.removeCardFromSession,
    requestGuardRef: core.state.requestGuardRef,
    revealed: core.state.revealed,
    sessionEpochRef: core.state.sessionEpochRef,
    sessionKind: core.state.sessionKind,
    setAnsweredCardIds: core.state.setAnsweredCardIds,
    setCurrentIndex: core.state.setCurrentIndex,
    setLessonPhase: core.state.setLessonPhase,
    setRevealed: core.state.setRevealed,
    setSessionError: core.state.setSessionError,
    setShowSetDueControls: core.state.setShowSetDueControls,
    stopAllAudio: interactions.stopAllAudio,
    syncOverview: core.syncOverview,
  });

const useCurrentCardMutations = (
  core: StudyReviewSessionCore,
  interactions: StudyReviewSessionInteractions
) =>
  useStudyCurrentCardMutations({
    autoRefreshEmptySessionRef: core.state.autoRefreshEmptySessionRef,
    cardsLength: core.cards.length,
    currentCardRef: core.currentCardRef,
    deleteCard: core.deleteCardMutation.mutateAsync,
    mergeCardIntoSession: interactions.mergeCardIntoSession,
    regenerateAnswerAudio: core.regenerateAudioMutation.mutateAsync,
    removeCardFromSession: interactions.removeCardFromSession,
    resetAudioAutoplayForCard: interactions.resetAutoplayForCard,
    sessionEpochRef: core.state.sessionEpochRef,
    setAnsweredCardIds: core.state.setAnsweredCardIds,
    setCurrentIndex: core.state.setCurrentIndex,
    setEditing: core.state.setEditing,
    setRevealed: core.state.setRevealed,
    setSessionError: core.state.setSessionError,
    stopAllAudio: interactions.stopAllAudio,
    updateCard: core.updateCardMutation.mutateAsync,
  });

const useStudyReviewSessionActions = (
  core: StudyReviewSessionCore,
  interactions: StudyReviewSessionInteractions
) => {
  const audio = useReviewAudioControls(core, interactions);
  const prepareSessionCompletion = useReviewSessionCompletion(core);
  const grading = useReviewGrading(core, interactions);
  const cardActions = useReviewCardActions(core, interactions);
  const cardMutations = useCurrentCardMutations(core, interactions);
  return { ...audio, ...cardActions, ...cardMutations, ...grading, prepareSessionCompletion };
};

export type StudyReviewSessionActions = ReturnType<typeof useStudyReviewSessionActions>;

export default useStudyReviewSessionActions;
