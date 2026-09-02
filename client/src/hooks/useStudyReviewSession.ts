import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { StudyCardSummary, StudyOverview } from '@languageflow/shared/src/types';

import {
  createStudyReviewRequest,
  type StudySessionResponse,
  undoStudyReview,
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
import {
  cloneStudySnapshot,
  getCardsAfterReview,
  type StudyUndoAction,
  type StudyUndoSnapshot,
} from './studyReviewSessionUtils';
import { createStudyReviewRequestGuard } from './studyReviewRequestGuard';
import type { StudySessionReviewRecord } from '../components/study/studySessionWrapUpModel';
import { useAuth } from '../contexts/AuthContext';
import type { StudyAchievementSessionCompletion } from '../components/study/studyAchievementSessionModel';
import useStudyReviewSessionDerivedState from './useStudyReviewSessionDerivedState';
import useStudyAchievementSync from './useStudyAchievementSync';
import useStudyAchievementReviewSession from './useStudyAchievementReviewSession';
import useStudyEmptySessionRefresh from './useStudyEmptySessionRefresh';
import useStudySessionLoader from './useStudySessionLoader';
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
} from './studyReviewSubmissionFlow';
import { submitStudyReviewUndo } from './studyReviewUndoFlow';
import useStudyReviewCardActions from './useStudyReviewCardActions';
import useStudyFocusModeLifecycle from './useStudyFocusModeLifecycle';
import useStudyCurrentCardMutations from './useStudyCurrentCardMutations';
import useStudySessionCompletion from './useStudySessionCompletion';
import useStudyReviewAudioControls from './useStudyReviewAudioControls';

const useStudyReviewSession = () => {
  const userId = useAuth().user?.id ?? null;
  const queryClient = useQueryClient();
  const reviewMutation = useSubmitStudyReview();
  const cardActionMutation = useStudyCardAction();
  const updateCardMutation = useUpdateStudyCard();
  const deleteCardMutation = useDeleteStudyCard();
  const regenerateAudioMutation = useRegenerateStudyAnswerAudio();
  const [focusMode, setFocusMode] = useState(false);
  const [sessionKind, setSessionKind] = useState<'reviews' | 'lessons'>('reviews');
  const [lessonPhase, setLessonPhase] = useState<'preview' | 'quiz' | 'complete'>('preview');
  const [masteryAnimation, setMasteryAnimation] = useState<StudyMasteryAnimation | null>(null);
  const [session, setSession] = useState<StudySessionResponse | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [reviewConflictRecovered, setReviewConflictRecovered] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showSetDueControls, setShowSetDueControls] = useState(false);
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
  const requestGuardRef = useRef(createStudyReviewRequestGuard());
  const sessionEpochRef = useRef(0);
  const activeLessonCohortIdRef = useRef<string | null>(null);
  const canSurfaceAsyncSessionErrorRef = useRef(false);
  const answeredCardIdsRef = useRef<Set<string>>(new Set());
  const autoRefreshEmptySessionRef = useRef(false);
  const achievementCompletionRequestIdRef = useRef(0);
  const activeAchievementCompletionRequestRef = useRef<number | null>(null);
  const pendingReviewOperationRef = useRef<PendingStudyReviewOperation | null>(null);
  const runBackgroundTask = useStudyBackgroundTask();
  const cardStartedAtRef = useRef(Date.now());
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
    autoRefreshEmptySessionRef,
    sessionEpochRef,
    sessionKind,
    setLessonPhase,
    setSession,
    setSessionError,
    setSessionLoading,
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
    achievementCelebrationPresented,
    achievementCompletion,
    achievementProgress,
    answeredCardIds,
    currentAchievementIndex,
    currentIndex,
    focusMode,
    practiceCards,
    practiceInitialCount,
    regenerateAudioError: regenerateAudioMutation.error,
    session,
    sessionCardCount: sessionCardCountRef.current,
    sessionKind,
    sessionReviewRecords,
    sessionWasEnded,
    updateCardError: updateCardMutation.error,
  });
  // Ref so handlers always read the live card even if a background session update
  // races with a click (stale-closure guard). Cast needed for @types/react 18.3.5.
  const currentCardRef = useRef<StudyCardSummary | null>(
    null
  ) as MutableRefObject<StudyCardSummary | null>;
  currentCardRef.current = currentCard;
  const reviewBusy = reviewMutation.isPending || reviewSubmitPending || reviewRetryAvailable;

  useEffect(() => {
    answeredCardIdsRef.current = new Set(answeredCardIds);
  }, [answeredCardIds]);

  useEffect(() => {
    canSurfaceAsyncSessionErrorRef.current = focusMode;
  }, [focusMode]);

  useEffect(() => {
    if (!achievementSessionStore) return undefined;
    let cancelled = false;
    const expectedEpoch = sessionEpochRef.current;

    (async () => {
      try {
        const { progress } = await syncAchievements();
        if (cancelled || sessionEpochRef.current !== expectedEpoch) return;
        const restoredCompletion = achievementSessionStore.prepareInterruptedCompletion(
          progress.awards
        );
        if (!restoredCompletion) return;
        if (cancelled || sessionEpochRef.current !== expectedEpoch) return;

        sessionEpochRef.current += 1;
        canSurfaceAsyncSessionErrorRef.current = false;
        setFocusMode(true);
        setSessionKind('reviews');
        setLessonPhase('quiz');
        setSession(null);
        setSessionLoading(false);
        setSessionError(null);
        setReviewConflictRecovered(false);
        setCurrentIndex(0);
        setRevealed(false);
        setEditing(false);
        setShowSetDueControls(false);
        setMasteryAnimation(null);
        setSessionReviewRecords(restoredCompletion.records);
        setSessionWasEnded(true);
        setAchievementCompletion(restoredCompletion);
        setCurrentAchievementIndex(0);
        setAchievementCelebrationPresented(restoredCompletion.celebrationPresented);
      } catch {
        // Achievement recovery is best-effort and must not block study startup.
      }
    })().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [achievementSessionStore, syncAchievements]);

  useEffect(
    () => () => {
      sessionEpochRef.current += 1;
      requestGuardRef.current.reset();
      canSurfaceAsyncSessionErrorRef.current = false;
    },
    []
  );

  const reportAsyncSessionError = useCallback((message: string) => {
    if (canSurfaceAsyncSessionErrorRef.current) {
      setSessionError(message);
    }
  }, []);

  const { popUndo, pushUndo, resetUndo } = useStudyUndoStack<StudyUndoAction>();

  const mergeCardIntoSession = useCallback((updatedCard: StudyCardSummary) => {
    setSession((currentSession) => {
      if (!currentSession) return currentSession;
      if (answeredCardIdsRef.current.has(updatedCard.id)) return currentSession;

      return {
        ...currentSession,
        cards: currentSession.cards.map((card) =>
          card.id === updatedCard.id ? updatedCard : card
        ),
      };
    });
  }, []);

  const removeCardFromSession = useCallback((cardId: string) => {
    setSession((currentSession) => {
      if (!currentSession) return currentSession;

      return {
        ...currentSession,
        cards: currentSession.cards.filter((card) => card.id !== cardId),
      };
    });
  }, []);

  const applyReviewResultToSession = useCallback(
    (
      updatedCard: StudyCardSummary,
      grade: 'again' | 'hard' | 'good' | 'easy',
      resolvedCards?: StudyCardSummary[],
      resolvedOverview?: StudyOverview
    ) => {
      setSession((currentSession) => {
        if (!currentSession) return currentSession;

        return {
          ...currentSession,
          overview: resolvedOverview ?? currentSession.overview,
          cards: resolvedCards ?? getCardsAfterReview(currentSession.cards, updatedCard, grade),
        };
      });
    },
    []
  );

  const captureUndoSnapshot = useCallback(
    (): StudyUndoSnapshot => ({
      session: session
        ? cloneStudySnapshot({
            session,
            overview: getCachedOverview(),
            currentIndex,
            revealed,
            answeredCardIds,
          }).session
        : null,
      overview: getCachedOverview(),
      currentIndex,
      revealed,
      answeredCardIds: [...answeredCardIds],
    }),
    [answeredCardIds, currentIndex, getCachedOverview, revealed, session]
  );

  const ensureAnswerAudioPrepared = useStudyAnswerAudioPrep({
    enabled: focusMode,
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
      masteryAnimation !== null ||
      reviewSubmitPending ||
      (sessionKind === 'lessons' && lessonPhase !== 'quiz'),
    cards: presentedCards,
    currentCard,
    ensureAnswerAudioPrepared,
    focusMode,
    runBackgroundTask,
    revealed,
  });

  const restoreUndoSnapshot = useCallback(
    (snapshot: StudyUndoSnapshot) => {
      stopAllAudio();
      const restored = cloneStudySnapshot(snapshot);
      setSession(restored.session);
      if (restored.overview) {
        syncOverview(restored.overview);
      }
      setCurrentIndex(restored.currentIndex);
      setRevealed(restored.revealed);
      answeredCardIdsRef.current = new Set(restored.answeredCardIds);
      setAnsweredCardIds(restored.answeredCardIds);
      setSessionError(null);
      setShowSetDueControls(false);
    },
    [stopAllAudio, syncOverview]
  );

  const { revealCurrentCard, toggleAnswerAudio } = useStudyReviewAudioControls({
    answerAudioRef,
    autoplayAnswerAudioForCard,
    captureUndoSnapshot,
    currentCard,
    editing,
    ensureAnswerAudioPrepared,
    pushUndo,
    reportAsyncSessionError,
    revealed,
    runBackgroundTask,
    setRevealed,
    stopAllAudio,
  });

  const prepareSessionCompletion = useStudySessionCompletion({
    achievementAwards: achievementProgress?.awards ?? [],
    achievementCompletion,
    achievementCompletionRequestIdRef,
    achievementSessionStore,
    activeAchievementCompletionRequestRef,
    masteryAnimation,
    reviewQueueExhausted,
    runBackgroundTask,
    sessionEpochRef,
    setAchievementCelebrationPresented,
    setAchievementCompletion,
    setAchievementCompletionRefreshPending,
    setCurrentAchievementIndex,
    setSessionWasEnded,
    syncAchievements,
  });

  const handleGrade = useCallback(
    async (grade: 'again' | 'hard' | 'good' | 'easy') => {
      if (
        isReviewSubmissionBlocked({
          editing,
          hasCurrentCard: currentCard !== null,
          masteryAnimationActive: masteryAnimation !== null,
          requestBusy: requestGuardRef.current.isBusy(),
          reviewPending: reviewMutation.isPending,
          undoPending,
        })
      ) {
        return;
      }

      if (practiceMode) {
        stopAllAudio();
        resetStudyAudioAutoplayForCard(currentCard.id);
        setPracticeCards((current) => getPracticeCardsAfterGrade(current, grade));
        setRevealed(false);
        setSessionError(null);
        cardStartedAtRef.current = Date.now();
        return;
      }

      if (sessionKind === 'lessons' && grade === 'again') {
        stopAllAudio();
        resetStudyAudioAutoplayForCard(currentCard.id);
        const nextCards = getLessonCardsAfterAgain(cards, currentIndex, currentCard);
        setSession((currentSession) =>
          currentSession ? { ...currentSession, cards: nextCards } : currentSession
        );
        setCurrentIndex(0);
        setRevealed(false);
        setSessionError(null);
        return;
      }

      const pendingOperation = pendingReviewOperationRef.current;
      if (pendingReviewDoesNotMatch(pendingOperation?.request ?? null, currentCard.id, grade)) {
        return;
      }
      const durationMs = Math.max(0, Date.now() - cardStartedAtRef.current);
      const operation = pendingOperation ?? {
        request: createStudyReviewRequest({ cardId: currentCard.id, grade, durationMs }),
        undoSnapshot: captureUndoSnapshot(),
      };
      pendingReviewOperationRef.current = operation;
      setReviewRetryAvailable(false);
      setReviewConflictRecovered(false);
      const expectedEpoch = sessionEpochRef.current;
      const requestToken = requestGuardRef.current.acquire('review', currentCard.id);
      if (!requestToken) return;
      await submitStudyReviewOperation({
        activeLessonCohortIdRef,
        achievementAwards: achievementProgress?.awards ?? [],
        achievementSessionBootstrapRef,
        achievementSessionStore,
        answeredCardIdsRef,
        applyReviewResultToSession,
        autoRefreshEmptySessionRef,
        cards,
        currentCard,
        expectedEpoch,
        fallbackDurationMs: durationMs,
        grade,
        loadSession,
        operation,
        pendingReviewOperationRef,
        pushUndo,
        queryClient,
        recordAchievementReview,
        requestGuardRef,
        requestToken,
        resetStudyAudioAutoplayForCard,
        resetUndo,
        sessionEpochRef,
        sessionKind,
        setAchievementCelebrationPresented,
        setAchievementCompletion,
        setAnsweredCardIds,
        setCurrentAchievementIndex,
        setCurrentIndex,
        setEditing,
        setLessonPhase,
        setMasteryAnimation,
        setRevealed,
        setReviewConflictRecovered,
        setReviewRetryAvailable,
        setReviewSubmitPending,
        setSession,
        setSessionError,
        setSessionReviewRecords,
        setSessionWasEnded,
        setShowSetDueControls,
        stopAllAudio,
        submitReview: reviewMutation.mutateAsync,
        syncAchievements,
        syncOverview,
      });
    },
    [
      applyReviewResultToSession,
      captureUndoSnapshot,
      currentCard,
      currentIndex,
      cards,
      editing,
      masteryAnimation,
      pushUndo,
      resetStudyAudioAutoplayForCard,
      reviewMutation,
      stopAllAudio,
      syncOverview,
      undoPending,
      sessionKind,
      practiceMode,
      loadSession,
      achievementProgress?.awards,
      achievementSessionBootstrapRef,
      achievementSessionStore,
      recordAchievementReview,
      queryClient,
      resetUndo,
      syncAchievements,
    ]
  );

  const retryPendingReview = useCallback(async () => {
    const pendingOperation = pendingReviewOperationRef.current;
    if (!pendingOperation) return;
    await handleGrade(pendingOperation.request.grade);
  }, [handleGrade]);

  const { handleBuryForSession, handleCardAction } = useStudyReviewCardActions({
    autoRefreshEmptySessionRef,
    cardActionMutation,
    cardsLength: cards.length,
    captureUndoSnapshot,
    currentCard,
    editing,
    mergeCardIntoSession,
    pendingReviewOperationRef,
    pushUndo,
    removeCardFromSession,
    requestGuardRef,
    revealed,
    sessionEpochRef,
    sessionKind,
    setAnsweredCardIds,
    setCurrentIndex,
    setLessonPhase,
    setRevealed,
    setSessionError,
    setShowSetDueControls,
    stopAllAudio,
    syncOverview,
  });

  const { deleteCurrentCard, regenerateCurrentCardAudio, saveCurrentCard } =
    useStudyCurrentCardMutations({
      autoRefreshEmptySessionRef,
      cardsLength: cards.length,
      currentCardRef,
      deleteCard: deleteCardMutation.mutateAsync,
      mergeCardIntoSession,
      regenerateAnswerAudio: regenerateAudioMutation.mutateAsync,
      removeCardFromSession,
      resetAudioAutoplayForCard: resetStudyAudioAutoplayForCard,
      sessionEpochRef,
      setAnsweredCardIds,
      setCurrentIndex,
      setEditing,
      setRevealed,
      setSessionError,
      stopAllAudio,
      updateCard: updateCardMutation.mutateAsync,
    });

  const handleUndo = useCallback(async () => {
    await submitStudyReviewUndo({
      achievementAwards: achievementProgress?.awards ?? [],
      achievementCompletion,
      achievementCompletionRequestIdRef,
      achievementSessionStore,
      activeAchievementCompletionRequestRef,
      blocked:
        undoPending ||
        Boolean(pendingReviewOperationRef.current) ||
        requestGuardRef.current.isBusy() ||
        reviewMutation.isPending ||
        cardActionMutation.isPending ||
        sessionLoading ||
        editing ||
        masteryAnimation !== null,
      popUndo,
      pushUndo,
      requestGuardRef,
      restoreUndoSnapshot,
      sessionEpochRef,
      setAchievementCelebrationPresented,
      setAchievementCompletion,
      setAchievementCompletionRefreshPending,
      setCurrentAchievementIndex,
      setSessionError,
      setSessionReviewRecords,
      setSessionWasEnded,
      setUndoPending,
      stopAllAudio,
      syncAchievements,
      syncOverview,
      undoAchievementReview,
      undoReview: undoStudyReview,
    });
  }, [
    popUndo,
    pushUndo,
    editing,
    masteryAnimation,
    achievementCompletion,
    achievementProgress?.awards,
    achievementSessionStore,
    cardActionMutation.isPending,
    restoreUndoSnapshot,
    reviewMutation.isPending,
    sessionLoading,
    stopAllAudio,
    syncOverview,
    syncAchievements,
    undoAchievementReview,
    undoPending,
  ]);

  const { motionPermissionState, requestMotionPermission } = useStudyMotionUndo({
    disabled:
      undoPending ||
      reviewMutation.isPending ||
      cardActionMutation.isPending ||
      sessionLoading ||
      editing ||
      masteryAnimation !== null,
    focusMode,
    onShake: handleUndo,
    runBackgroundTask,
  });

  const { enterFocusMode, exitFocusMode } = useStudyFocusModeLifecycle({
    activeAchievementCompletionRequestRef,
    activeLessonCohortIdRef,
    achievementCompletionRequestIdRef,
    achievementSessionBootstrapRef,
    achievementSessionStore,
    answeredCardIdsRef,
    autoRefreshEmptySessionRef,
    canSurfaceAsyncSessionErrorRef,
    loadSession,
    pendingReviewOperationRef,
    queryClient,
    requestGuardRef,
    requestMotionPermission,
    resetStudyAudioAutoplay,
    resetUndo,
    runBackgroundTask,
    sessionEpochRef,
    setAchievementCelebrationPresented,
    setAchievementCompletion,
    setAchievementCompletionRefreshPending,
    setAnsweredCardIds,
    setCurrentAchievementIndex,
    setCurrentIndex,
    setEditing,
    setFocusMode,
    setLessonPhase,
    setMasteryAnimation,
    setPracticeCards,
    setPracticeInitialCount,
    setRevealed,
    setReviewConflictRecovered,
    setReviewRetryAvailable,
    setReviewSubmitPending,
    setSession,
    setSessionError,
    setSessionKind,
    setSessionLoading,
    setSessionReviewRecords,
    setSessionWasEnded,
    setShowSetDueControls,
    setUndoPending,
    startAchievementReviewSession,
    stopAllAudio,
  });

  const beginLessonQuiz = useCallback(() => {
    setCurrentIndex(0);
    setRevealed(false);
    setLessonPhase('quiz');
  }, []);

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
    [resetStudyAudioAutoplay, resetUndo, stopAllAudio]
  );

  const exitPracticeMode = useCallback(() => {
    stopAllAudio();
    resetStudyAudioAutoplay();
    setPracticeCards(null);
    setPracticeInitialCount(0);
    setCurrentIndex(0);
    setRevealed(false);
    setSessionError(null);
  }, [resetStudyAudioAutoplay, stopAllAudio]);

  const endReviewSession = useCallback(() => {
    if (practiceMode) {
      exitPracticeMode();
      return;
    }

    if (sessionKind === 'lessons') {
      exitFocusMode();
      return;
    }

    if (sessionReviewRecords.length === 0) {
      achievementSessionStore?.cancelCurrentSession();
      exitFocusMode();
      return;
    }

    prepareSessionCompletion();
  }, [
    exitFocusMode,
    exitPracticeMode,
    achievementSessionStore,
    practiceMode,
    prepareSessionCompletion,
    sessionKind,
    sessionReviewRecords.length,
  ]);

  const advanceAchievement = useCallback(() => {
    if (!achievementCompletion) return;

    if (currentAchievementIndex + 1 < completionAchievements.length) {
      setCurrentAchievementIndex((current) => current + 1);
      return;
    }

    achievementSessionStore?.markCelebrationPresented(achievementCompletion.id);
    setAchievementCelebrationPresented(true);
    if (achievementCompletion.records.length === 0) {
      exitFocusMode();
    }
  }, [
    achievementCompletion,
    achievementSessionStore,
    completionAchievements.length,
    currentAchievementIndex,
    exitFocusMode,
  ]);

  const finishReviewSession = useCallback(() => {
    if (achievementCompletionRefreshPending) return;
    if (achievementCompletion) {
      achievementSessionStore?.consumeCompletion(achievementCompletion.id);
    }
    exitFocusMode();
  }, [
    achievementCompletion,
    achievementCompletionRefreshPending,
    achievementSessionStore,
    exitFocusMode,
  ]);

  const loadNextLessonBatch = useCallback(async () => {
    answeredCardIdsRef.current = new Set();
    setAnsweredCardIds([]);
    setCurrentIndex(0);
    setRevealed(false);
    await loadSession('lessons', {
      lessonCohortId: activeLessonCohortIdRef.current ?? undefined,
    });
  }, [loadSession]);

  useStudyEmptySessionRefresh({
    autoRefreshEmptySessionRef,
    blocked:
      !focusMode ||
      practiceMode ||
      sessionLoading ||
      Boolean(sessionError) ||
      Boolean(currentCard) ||
      reviewBusy ||
      undoPending ||
      editing,
    getCachedOverview,
    loadSession,
    runBackgroundTask,
    sessionOverview: session?.overview,
  });

  useEffect(() => {
    stopAllAudio();
    cardStartedAtRef.current = Date.now();
  }, [currentCard?.id, stopAllAudio]);

  useEffect(() => {
    setEditing(false);
    setShowSetDueControls(false);
  }, [currentCard?.id]);

  useEffect(() => {
    if (!focusMode) {
      stopAllAudio();
    }
  }, [focusMode, stopAllAudio]);

  useEffect(() => {
    if (!focusMode) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [focusMode]);

  useStudyKeyboardShortcuts({
    cardActionPending: cardActionMutation.isPending,
    editing,
    exitFocusMode: endReviewSession,
    focusMode,
    handleGrade,
    handleUndo,
    interactionBlocked: masteryAnimation !== null,
    onError: reportAsyncSessionError,
    revealCurrentCard,
    revealed,
    reviewPending: reviewMutation.isPending,
    reviewSubmitPending,
    runBackgroundTask,
    setEditing: practiceMode ? () => {} : setEditing,
    toggleAnswerAudio,
  });

  return {
    focusMode,
    sessionKind,
    lessonPhase,
    cards,
    masteryAnimation,
    sessionLoading,
    sessionError,
    reviewConflictRecovered,
    currentCard,
    revealed,
    editing,
    showSetDueControls,
    undoPending,
    reviewBusy,
    reviewRetryAvailable,
    sessionCounts,
    sessionProgress,
    sessionWrapUp,
    reviewQueueExhausted,
    reviewSessionComplete,
    achievementCompletion,
    achievementCatalog,
    achievementProgress,
    achievementCompletionRefreshPending,
    currentAchievement,
    currentAchievementIndex,
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
    setEditing,
    setMasteryAnimation,
    setShowSetDueControls,
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
