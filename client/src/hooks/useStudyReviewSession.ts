import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { flushSync } from 'react-dom';
import { Rating, type Card as FsrsCard } from 'ts-fsrs';
import {
  createStudyFsrsScheduler,
  deserializeStudyFsrsCard,
} from '@languageflow/shared/src/studyFsrs';
import type {
  StudyCardSetDueMode,
  StudyCardSummary,
  StudyOverview,
  StudyPromptPayload,
  StudyAnswerPayload,
} from '@languageflow/shared/src/types';

import {
  type StudySessionResponse,
  startStudySession,
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
import getDeviceStudyTimeZone from '../components/study/studyTimeZoneUtils';
import { toAssetUrl } from '../components/study/studyCardUtils';
import useStudyBackgroundTask from './useStudyBackgroundTask';
import { useFeatureFlags } from './useFeatureFlags';

const reviewScheduler = createStudyFsrsScheduler();

interface StudyUndoSnapshot {
  session: StudySessionResponse | null;
  overview: StudyOverview | null;
  currentIndex: number;
  revealed: boolean;
  answeredCardIds: string[];
}

type StudyUndoAction =
  | {
      kind: 'reveal';
      snapshot: StudyUndoSnapshot;
    }
  | {
      kind: 'bury';
      snapshot: StudyUndoSnapshot;
    }
  | {
      kind: 'grade';
      snapshot: StudyUndoSnapshot;
      reviewLogId: string;
    };

const cloneStudySnapshot = (snapshot: StudyUndoSnapshot): StudyUndoSnapshot =>
  structuredClone(snapshot);

const formatReviewInterval = (due: Date, now: Date) => {
  const diffMs = Math.max(0, due.getTime() - now.getTime());

  if (diffMs < 60_000) return '<1m';
  if (diffMs < 60 * 60_000) return `<${Math.ceil(diffMs / 60_000)}m`;
  if (diffMs < 24 * 60 * 60_000) return `${Math.round(diffMs / (60 * 60_000))}h`;
  if (diffMs < 30 * 24 * 60 * 60_000) return `${Math.round(diffMs / (24 * 60 * 60_000))}d`;
  if (diffMs < 365 * 24 * 60 * 60_000) {
    return `${Math.round(diffMs / (30 * 24 * 60 * 60_000))}mo`;
  }

  return `${Math.round(diffMs / (365 * 24 * 60 * 60_000))}y`;
};

const getGradeIntervals = (card: StudyCardSummary | null) => {
  if (!card?.state.scheduler) return null;

  const fsrsCard = deserializeStudyFsrsCard(card.state.scheduler) as FsrsCard | null;
  if (!fsrsCard) return null;

  const now = new Date();

  return {
    again: formatReviewInterval(reviewScheduler.next(fsrsCard, now, Rating.Again).card.due, now),
    hard: formatReviewInterval(reviewScheduler.next(fsrsCard, now, Rating.Hard).card.due, now),
    good: formatReviewInterval(reviewScheduler.next(fsrsCard, now, Rating.Good).card.due, now),
    easy: formatReviewInterval(reviewScheduler.next(fsrsCard, now, Rating.Easy).card.due, now),
  };
};

const isCardEligibleForSession = (card: StudyCardSummary) => {
  if (card.state.queueState === 'new') return !card.state.failedAt;
  if (!['learning', 'review', 'relearning'].includes(card.state.queueState)) {
    return false;
  }
  if (!card.state.dueAt) return false;
  return new Date(card.state.dueAt).getTime() <= Date.now();
};

const hasPersistedFailure = (card: StudyCardSummary) => Boolean(card.state.failedAt);

const orderStudySessionCards = (cards: StudyCardSummary[]) =>
  [...cards].sort((left, right) => {
    const leftIsNew = left.state.queueState === 'new';
    const rightIsNew = right.state.queueState === 'new';
    if (leftIsNew !== rightIsNew) return leftIsNew ? 1 : -1;
    if (leftIsNew && rightIsNew) return 0;

    const leftDueAt = left.state.dueAt
      ? new Date(left.state.dueAt).getTime()
      : Number.MAX_SAFE_INTEGER;
    const rightDueAt = right.state.dueAt
      ? new Date(right.state.dueAt).getTime()
      : Number.MAX_SAFE_INTEGER;
    if (leftDueAt !== rightDueAt) return leftDueAt - rightDueAt;

    return left.id.localeCompare(right.id);
  });

const getCardsAfterReview = (
  currentCards: StudyCardSummary[],
  updatedCard: StudyCardSummary,
  grade: 'again' | 'hard' | 'good' | 'easy'
) => {
  let nextCards = currentCards.filter((card) => card.id !== updatedCard.id);

  if (grade === 'again' && hasPersistedFailure(updatedCard)) {
    nextCards = nextCards.filter((card) => card.state.queueState !== 'new');
    if (isCardEligibleForSession(updatedCard)) {
      nextCards.push(updatedCard);
    }
  }

  return orderStudySessionCards(nextCards);
};

const useStudyReviewSession = () => {
  const queryClient = useQueryClient();
  const { flags } = useFeatureFlags();
  const reviewMutation = useSubmitStudyReview();
  const cardActionMutation = useStudyCardAction();
  const updateCardMutation = useUpdateStudyCard();
  const deleteCardMutation = useDeleteStudyCard();
  const regenerateAudioMutation = useRegenerateStudyAnswerAudio();
  const [focusMode, setFocusMode] = useState(false);
  const [session, setSession] = useState<StudySessionResponse | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showSetDueControls, setShowSetDueControls] = useState(false);
  const [undoPending, setUndoPending] = useState(false);
  const [reviewSubmitPending, setReviewSubmitPending] = useState(false);
  const [answeredCardIds, setAnsweredCardIds] = useState<string[]>([]);
  const reviewSubmitPendingRef = useRef(false);
  const sessionCardCountRef = useRef(0);
  const canSurfaceAsyncSessionErrorRef = useRef(false);
  const answeredCardIdsRef = useRef<Set<string>>(new Set());
  const autoRefreshEmptySessionRef = useRef(false);
  const runBackgroundTask = useStudyBackgroundTask();

  const cards = useMemo(() => session?.cards ?? [], [session?.cards]);
  const currentCard = cards[currentIndex] ?? null;
  // Ref so handlers always read the live card even if a background session update
  // races with a click (stale-closure guard). Cast needed for @types/react 18.3.5.
  const currentCardRef = useRef<StudyCardSummary | null>(
    null
  ) as MutableRefObject<StudyCardSummary | null>;
  currentCardRef.current = currentCard;
  const reviewBusy = reviewMutation.isPending || reviewSubmitPending;
  const gradeIntervals = useMemo(() => getGradeIntervals(currentCard), [currentCard]);
  const sessionCounts = useMemo(() => {
    const answeredSet = new Set(answeredCardIds);
    const totals = {
      newRemaining: 0,
      failedDue: session?.overview.failedCount ?? 0,
      reviewRemaining: 0,
    };
    let loadedFailedCount = 0;

    cards.forEach((card) => {
      if (hasPersistedFailure(card)) {
        loadedFailedCount += 1;
      } else if (!answeredSet.has(card.id)) {
        if (card.state.queueState === 'new') {
          totals.newRemaining += 1;
        } else {
          totals.reviewRemaining += 1;
        }
      }
    });

    totals.failedDue = Math.max(totals.failedDue, loadedFailedCount);

    return totals;
  }, [answeredCardIds, cards, session?.overview.failedCount]);
  const updateCardErrorMessage = useMemo(() => {
    if (regenerateAudioMutation.error instanceof Error) {
      return regenerateAudioMutation.error.message;
    }

    if (updateCardMutation.error instanceof Error) {
      return updateCardMutation.error.message;
    }

    if (regenerateAudioMutation.error) {
      return 'Audio regeneration failed.';
    }

    return updateCardMutation.error ? 'Card update failed.' : null;
  }, [regenerateAudioMutation.error, updateCardMutation.error]);

  useEffect(() => {
    sessionCardCountRef.current = session?.cards.length ?? 0;
  }, [session]);

  useEffect(() => {
    answeredCardIdsRef.current = new Set(answeredCardIds);
  }, [answeredCardIds]);

  useEffect(() => {
    canSurfaceAsyncSessionErrorRef.current = focusMode;
  }, [focusMode]);

  const reportAsyncSessionError = useCallback((message: string) => {
    if (canSurfaceAsyncSessionErrorRef.current) {
      setSessionError(message);
    }
  }, []);

  const { popUndo, pushUndo, resetUndo } = useStudyUndoStack<StudyUndoAction>();

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
    cards,
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

  const loadSession = useCallback(async () => {
    setSessionLoading(true);
    setSessionError(null);

    try {
      const nextSession = await startStudySession(flags);
      autoRefreshEmptySessionRef.current = nextSession.cards.length === 0;
      setSession(nextSession);
      syncOverview(nextSession.overview);
      return nextSession;
    } catch (error) {
      setSession(null);
      const message = error instanceof Error ? error.message : 'Study session failed to load.';
      setSessionError(message);
      throw error;
    } finally {
      setSessionLoading(false);
    }
  }, [flags, syncOverview]);

  const revealCurrentCard = useCallback(() => {
    if (!currentCard || revealed || editing) return;

    pushUndo({
      kind: 'reveal',
      snapshot: captureUndoSnapshot(),
    });
    stopAllAudio();
    flushSync(() => setRevealed(true));

    const answerUrl = toAssetUrl(currentCard.answer.answerAudio?.url);
    if (answerUrl) {
      autoplayAnswerAudioForCard(currentCard);
      return;
    }

    // Mobile browsers such as iOS Safari may reject play() until a user gesture or
    // until the generated audio asset has propagated, so we prewarm with bounded retries.
    runBackgroundTask(() => ensureAnswerAudioPrepared(currentCard.id), {
      label: 'Study answer-audio preparation',
      errorMessage: 'Answer audio could not be prepared.',
      onError: reportAsyncSessionError,
    });
  }, [
    captureUndoSnapshot,
    currentCard,
    editing,
    autoplayAnswerAudioForCard,
    ensureAnswerAudioPrepared,
    pushUndo,
    revealed,
    reportAsyncSessionError,
    runBackgroundTask,
    stopAllAudio,
  ]);

  const exitFocusMode = useCallback(() => {
    stopAllAudio();
    resetUndo();
    canSurfaceAsyncSessionErrorRef.current = false;
    setFocusMode(false);
    setSession(null);
    setSessionError(null);
    setCurrentIndex(0);
    setRevealed(false);
    setEditing(false);
    setShowSetDueControls(false);
    setUndoPending(false);
    reviewSubmitPendingRef.current = false;
    setReviewSubmitPending(false);
    autoRefreshEmptySessionRef.current = false;
    answeredCardIdsRef.current = new Set();
    setAnsweredCardIds([]);
    runBackgroundTask(() => queryClient.invalidateQueries({ queryKey: ['study', 'overview'] }), {
      label: 'Study overview refresh',
    });
  }, [queryClient, resetUndo, runBackgroundTask, stopAllAudio]);

  const handleGrade = useCallback(
    async (grade: 'again' | 'hard' | 'good' | 'easy') => {
      if (
        !currentCard ||
        reviewSubmitPendingRef.current ||
        reviewMutation.isPending ||
        undoPending ||
        editing
      ) {
        return;
      }

      const undoSnapshot = captureUndoSnapshot();
      try {
        reviewSubmitPendingRef.current = true;
        setReviewSubmitPending(true);
        stopAllAudio();
        const reviewResult = await reviewMutation.mutateAsync({ cardId: currentCard.id, grade });
        answeredCardIdsRef.current.add(currentCard.id);
        setAnsweredCardIds((current) =>
          current.includes(currentCard.id) ? current : [...current, currentCard.id]
        );
        pushUndo({
          kind: 'grade',
          snapshot: undoSnapshot,
          reviewLogId: reviewResult.reviewLogId,
        });
        if (grade === 'again') {
          resetStudyAudioAutoplayForCard(currentCard.id);
        }
        // A committed review must not be retried. Without the updated card, drop it for this
        // session even for "again"; the next session will load its authoritative schedule.
        const nextCards = reviewResult.card
          ? getCardsAfterReview(cards, reviewResult.card, grade)
          : cards.filter((card) => card.id !== currentCard.id);
        autoRefreshEmptySessionRef.current = nextCards.length === 0;
        if (reviewResult.card) {
          applyReviewResultToSession(reviewResult.card, grade, nextCards, reviewResult.overview);
        } else {
          setSession((currentSession) =>
            currentSession
              ? { ...currentSession, cards: nextCards, overview: reviewResult.overview }
              : currentSession
          );
        }
        syncOverview(reviewResult.overview);
        setCurrentIndex((current) => {
          const nextLength = nextCards.length;
          if (nextLength === 0) return 0;
          return Math.min(current, nextLength - 1);
        });
        setRevealed(false);
        setSessionError(null);
      } catch (error) {
        setSessionError(error instanceof Error ? error.message : 'Review failed.');
        throw error;
      } finally {
        reviewSubmitPendingRef.current = false;
        setReviewSubmitPending(false);
      }
    },
    [
      applyReviewResultToSession,
      captureUndoSnapshot,
      currentCard,
      cards,
      editing,
      pushUndo,
      resetStudyAudioAutoplayForCard,
      reviewMutation,
      stopAllAudio,
      syncOverview,
      undoPending,
    ]
  );

  const handleBuryForSession = useCallback(() => {
    if (!currentCard || !revealed || editing) return;

    // Bury is intentionally session-only: it removes the card from this in-memory
    // review queue without persisting any scheduler change on the server.
    pushUndo({
      kind: 'bury',
      snapshot: captureUndoSnapshot(),
    });
    stopAllAudio();
    autoRefreshEmptySessionRef.current = false;
    setAnsweredCardIds((current) => current.filter((cardId) => cardId !== currentCard.id));
    removeCardFromSession(currentCard.id);
    const nextLength = Math.max(cards.length - 1, 0);
    setCurrentIndex((current) => (nextLength === 0 ? 0 : Math.min(current, nextLength - 1)));
    setRevealed(false);
    setShowSetDueControls(false);
  }, [
    cards.length,
    captureUndoSnapshot,
    currentCard,
    editing,
    pushUndo,
    removeCardFromSession,
    revealed,
    stopAllAudio,
  ]);

  const handleCardAction = useCallback(
    async (
      action: 'suspend' | 'unsuspend' | 'forget' | 'set_due',
      options?: { mode?: StudyCardSetDueMode; dueAt?: string }
    ) => {
      if (!currentCard || editing || cardActionMutation.isPending) return;

      try {
        stopAllAudio();
        const result = await cardActionMutation.mutateAsync({
          cardId: currentCard.id,
          action,
          mode: options?.mode,
          dueAt: options?.dueAt,
          timeZone: options?.mode === 'tomorrow' ? getDeviceStudyTimeZone() : undefined,
        });

        syncOverview(result.overview);
        setAnsweredCardIds((current) => current.filter((cardId) => cardId !== currentCard.id));
        setShowSetDueControls(false);
        autoRefreshEmptySessionRef.current = false;

        if (isCardEligibleForSession(result.card)) {
          mergeCardIntoSession(result.card);
        } else {
          removeCardFromSession(currentCard.id);
          const nextLength = Math.max(cards.length - 1, 0);
          setCurrentIndex((current) => (nextLength === 0 ? 0 : Math.min(current, nextLength - 1)));
        }

        setRevealed(false);
        setSessionError(null);
      } catch (error) {
        setSessionError(error instanceof Error ? error.message : 'Card action failed.');
      }
    },
    [
      cardActionMutation,
      cards.length,
      currentCard,
      editing,
      mergeCardIntoSession,
      removeCardFromSession,
      stopAllAudio,
      syncOverview,
    ]
  );

  const saveCurrentCard = useCallback(
    async (payload: { prompt: StudyPromptPayload; answer: StudyAnswerPayload }) => {
      const card = currentCardRef.current; // read live value, not stale closure
      if (!card) return;

      stopAllAudio();
      const updatedCard = await updateCardMutation.mutateAsync({
        cardId: card.id,
        prompt: payload.prompt,
        answer: payload.answer,
      });
      mergeCardIntoSession(updatedCard);
      resetStudyAudioAutoplayForCard(card.id);
      setEditing(false);
      setRevealed(false);
      setSessionError(null);
    },
    [
      currentCardRef,
      mergeCardIntoSession,
      resetStudyAudioAutoplayForCard,
      stopAllAudio,
      updateCardMutation,
    ]
  );

  const regenerateCurrentCardAudio = useCallback(
    async (payload: {
      answerAudioVoiceId: string | null;
      answerAudioTextOverride: string | null;
    }) => {
      const card = currentCardRef.current; // read live value, not stale closure
      if (!card) return undefined;

      stopAllAudio();
      const updatedCard = await regenerateAudioMutation.mutateAsync({
        cardId: card.id,
        answerAudioVoiceId: payload.answerAudioVoiceId,
        answerAudioTextOverride: payload.answerAudioTextOverride,
      });
      mergeCardIntoSession(updatedCard);
      resetStudyAudioAutoplayForCard(card.id);
      setSessionError(null);
      return updatedCard;
    },
    [
      currentCardRef,
      mergeCardIntoSession,
      regenerateAudioMutation,
      resetStudyAudioAutoplayForCard,
      stopAllAudio,
    ]
  );

  const deleteCurrentCard = useCallback(async () => {
    if (!currentCard) return;

    stopAllAudio();
    try {
      await deleteCardMutation.mutateAsync(currentCard.id);
      autoRefreshEmptySessionRef.current = false;
      setAnsweredCardIds((current) => current.filter((cardId) => cardId !== currentCard.id));
      removeCardFromSession(currentCard.id);
      const nextLength = Math.max(cards.length - 1, 0);
      setCurrentIndex((current) => (nextLength === 0 ? 0 : Math.min(current, nextLength - 1)));
      setEditing(false);
      setRevealed(false);
      setSessionError(null);
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : 'Unable to delete card.');
      throw error;
    }
  }, [cards.length, currentCard, deleteCardMutation, removeCardFromSession, stopAllAudio]);

  const handleUndo = useCallback(async () => {
    if (
      undoPending ||
      reviewSubmitPendingRef.current ||
      reviewMutation.isPending ||
      cardActionMutation.isPending ||
      sessionLoading ||
      editing
    ) {
      return;
    }

    const action = popUndo();
    if (!action) return;

    stopAllAudio();

    if (action.kind !== 'grade') {
      restoreUndoSnapshot(action.snapshot);
      return;
    }

    setUndoPending(true);
    try {
      const undoResult = await undoStudyReview(
        action.reviewLogId,
        action.snapshot.overview ?? undefined,
        flags
      );
      restoreUndoSnapshot(action.snapshot);
      syncOverview(undoResult.overview);
    } catch (error) {
      pushUndo(action);
      setSessionError(error instanceof Error ? error.message : 'Unable to undo study action.');
    } finally {
      setUndoPending(false);
    }
  }, [
    popUndo,
    pushUndo,
    flags,
    editing,
    cardActionMutation.isPending,
    restoreUndoSnapshot,
    reviewMutation.isPending,
    sessionLoading,
    stopAllAudio,
    syncOverview,
    undoPending,
  ]);

  const { motionPermissionState, requestMotionPermission } = useStudyMotionUndo({
    disabled:
      undoPending ||
      reviewMutation.isPending ||
      cardActionMutation.isPending ||
      sessionLoading ||
      editing,
    focusMode,
    onShake: handleUndo,
    runBackgroundTask,
  });

  const toggleAnswerAudio = useCallback(() => {
    if (!revealed || editing || !answerAudioRef.current) {
      return false;
    }

    const playPromise = answerAudioRef.current.play();
    runBackgroundTask(playPromise, {
      label: 'Study answer-audio keyboard replay',
    });
    return true;
  }, [answerAudioRef, editing, revealed, runBackgroundTask]);

  const enterFocusMode = useCallback(async () => {
    stopAllAudio();
    resetStudyAudioAutoplay();
    resetUndo();
    canSurfaceAsyncSessionErrorRef.current = true;
    setFocusMode(true);
    setCurrentIndex(0);
    setRevealed(false);
    setEditing(false);
    setUndoPending(false);
    autoRefreshEmptySessionRef.current = false;
    answeredCardIdsRef.current = new Set();
    setAnsweredCardIds([]);
    runBackgroundTask(() => requestMotionPermission(), {
      label: 'Study motion-permission request',
    });
    try {
      await loadSession();
    } catch {
      // loadSession already updates session error state for the dashboard.
    }
  }, [
    loadSession,
    requestMotionPermission,
    resetStudyAudioAutoplay,
    runBackgroundTask,
    resetUndo,
    stopAllAudio,
  ]);

  useEffect(() => {
    if (
      !focusMode ||
      sessionLoading ||
      sessionError ||
      currentCard ||
      reviewBusy ||
      undoPending ||
      editing ||
      !autoRefreshEmptySessionRef.current
    ) {
      return undefined;
    }

    const overview = session?.overview ?? getCachedOverview();
    if (!overview) return undefined;

    const failedCount = overview.failedCount ?? 0;
    const newCardsAvailable = overview.newCardsAvailableToday ?? overview.newCount;
    const nextDueAt = overview.nextDueAt ? new Date(overview.nextDueAt) : null;
    const nextDueMs = nextDueAt && !Number.isNaN(nextDueAt.getTime()) ? nextDueAt.getTime() : null;
    const shouldLoadNow =
      overview.dueCount > 0 ||
      newCardsAvailable > 0 ||
      (failedCount > 0 && nextDueMs !== null && nextDueMs <= Date.now());

    if (shouldLoadNow) {
      runBackgroundTask(() => loadSession(), {
        label: 'Study session refresh',
      });
      return undefined;
    }

    if (failedCount > 0 && newCardsAvailable <= 0 && nextDueMs !== null) {
      const delayMs = Math.max(0, Math.min(nextDueMs - Date.now() + 250, 2_147_483_647));
      const timeoutId = window.setTimeout(() => {
        runBackgroundTask(() => loadSession(), {
          label: 'Study failed-card retry refresh',
        });
      }, delayMs);

      return () => window.clearTimeout(timeoutId);
    }

    return undefined;
  }, [
    currentCard,
    editing,
    focusMode,
    getCachedOverview,
    loadSession,
    reviewBusy,
    runBackgroundTask,
    session?.overview,
    sessionError,
    sessionLoading,
    undoPending,
  ]);

  useEffect(() => {
    stopAllAudio();
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
    exitFocusMode,
    focusMode,
    handleGrade,
    handleUndo,
    onError: reportAsyncSessionError,
    revealCurrentCard,
    revealed,
    reviewPending: reviewMutation.isPending,
    reviewSubmitPending,
    runBackgroundTask,
    setEditing,
    toggleAnswerAudio,
  });

  return {
    focusMode,
    sessionLoading,
    sessionError,
    currentCard,
    revealed,
    editing,
    showSetDueControls,
    undoPending,
    reviewBusy,
    sessionCounts,
    gradeIntervals,
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
    setShowSetDueControls,
    revealCurrentCard,
    exitFocusMode,
    handleGrade,
    handleBuryForSession,
    handleCardAction,
    handleUndo,
    requestMotionPermission,
    saveCurrentCard,
    deleteCurrentCard,
    regenerateCurrentCardAudio,
    enterFocusMode,
  };
};

export default useStudyReviewSession;
