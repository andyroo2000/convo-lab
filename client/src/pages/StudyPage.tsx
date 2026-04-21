import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { flushSync } from 'react-dom';
import { fsrs, Rating, type Card as FsrsCard } from 'ts-fsrs';
import type {
  StudyCardSetDueMode,
  StudyCardSummary,
  StudyFsrsState,
  StudyOverview,
} from '@shared/types';

import { useFeatureFlags } from '../hooks/useFeatureFlags';
import {
  type StudySessionResponse,
  prepareStudyAnswerAudio,
  startStudySession,
  undoStudyReview,
  useStudyCardAction,
  useStudyOverview,
  useSubmitStudyReview,
  useUpdateStudyCard,
} from '../hooks/useStudy';
import { AudioPlayerHandle, StudyCardFace } from '../components/study/StudyCardPreview';
import StudyCardEditor from '../components/study/StudyCardEditor';
import StudySetDueControls from '../components/study/StudySetDueControls';
import { isAudioLedPromptCard, toAssetUrl } from '../components/study/studyCardUtils';

const reviewScheduler = fsrs();
const PREWARM_CARD_COUNT = 3;
const SHAKE_ACCELERATION_THRESHOLD = 28;
const SHAKE_DELTA_THRESHOLD = 14;
const SHAKE_COOLDOWN_MS = 1200;

interface MotionEnabledDeviceMotionEventConstructor {
  new (type: string, eventInitDict?: EventInit): DeviceMotionEvent;
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

interface StudyUndoSnapshot {
  session: StudySessionResponse | null;
  currentIndex: number;
  revealed: boolean;
  answeredCardIds: string[];
  failedCardIds: string[];
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
  JSON.parse(JSON.stringify(snapshot)) as StudyUndoSnapshot;

const supportsTouchMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.DeviceMotionEvent !== 'undefined' &&
  (typeof navigator === 'undefined' ? false : navigator.maxTouchPoints > 0);

const requestDeviceMotionAccess = async () => {
  if (typeof window === 'undefined' || typeof window.DeviceMotionEvent === 'undefined') {
    return false;
  }

  const motionEvent = window.DeviceMotionEvent as MotionEnabledDeviceMotionEventConstructor;
  if (typeof motionEvent.requestPermission === 'function') {
    try {
      return (await motionEvent.requestPermission()) === 'granted';
    } catch (error) {
      console.warn('Device motion permission request failed:', error);
      return false;
    }
  }

  return true;
};

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

const deserializeFsrsCard = (state: StudyFsrsState | null | undefined): FsrsCard | null => {
  if (!state) return null;

  const due = new Date(state.due);
  if (Number.isNaN(due.getTime())) return null;

  return {
    due,
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: state.elapsed_days,
    scheduled_days: state.scheduled_days,
    learning_steps: state.learning_steps,
    reps: state.reps,
    lapses: state.lapses,
    state: state.state,
    last_review: state.last_review ? new Date(state.last_review) : undefined,
  };
};

const getGradeIntervals = (card: StudyCardSummary | null) => {
  if (!card?.state.scheduler) return null;

  const fsrsCard = deserializeFsrsCard(card.state.scheduler);
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
  if (card.state.queueState === 'new') return true;
  if (!['learning', 'review', 'relearning'].includes(card.state.queueState)) {
    return false;
  }
  if (!card.state.dueAt) return false;
  return new Date(card.state.dueAt).getTime() <= Date.now();
};

const gradeButtonStyles: Record<'again' | 'hard' | 'good' | 'easy', string> = {
  again: 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100',
  hard: 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100',
  good: 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
  easy: 'border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100',
};

const StudyPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isFeatureEnabled } = useFeatureFlags();
  const enabled = isFeatureEnabled('flashcardsEnabled');
  const overviewQuery = useStudyOverview(enabled);
  const reviewMutation = useSubmitStudyReview();
  const cardActionMutation = useStudyCardAction();
  const updateCardMutation = useUpdateStudyCard();
  const [focusMode, setFocusMode] = useState(false);
  const [session, setSession] = useState<StudySessionResponse | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showSetDueControls, setShowSetDueControls] = useState(false);
  const [undoPending, setUndoPending] = useState(false);
  const [answeredCardIds, setAnsweredCardIds] = useState<string[]>([]);
  const [failedCardIds, setFailedCardIds] = useState<string[]>([]);
  const promptAudioRef = useRef<AudioPlayerHandle | null>(null);
  const answerAudioRef = useRef<AudioPlayerHandle | null>(null);
  const inFlightAudioPrep = useRef<Map<string, Promise<StudyCardSummary>>>(new Map());
  const promptAutoplayKeys = useRef(new Set<string>());
  const answerAutoplayKeys = useRef(new Set<string>());
  const undoStack = useRef<StudyUndoAction[]>([]);
  const motionEnabledRef = useRef(false);
  const lastShakeAtRef = useRef(0);
  const lastMotionMagnitudeRef = useRef<number | null>(null);

  const cards = useMemo(() => session?.cards ?? [], [session?.cards]);
  const currentCard = cards[currentIndex] ?? null;
  const gradeIntervals = useMemo(() => getGradeIntervals(currentCard), [currentCard]);
  const availableCount = (overviewQuery.data?.dueCount ?? 0) + (overviewQuery.data?.newCount ?? 0);
  const sessionCounts = useMemo(() => {
    const answeredSet = new Set(answeredCardIds);
    const failedSet = new Set(failedCardIds);
    const totals = { newRemaining: 0, failedDue: 0, reviewRemaining: 0 };

    cards.forEach((card) => {
      const isNewCard = card.state.source.type === 0 || card.state.queueState === 'new';

      if (failedSet.has(card.id)) {
        totals.failedDue += 1;
      } else if (!answeredSet.has(card.id)) {
        if (isNewCard) {
          totals.newRemaining += 1;
        } else {
          totals.reviewRemaining += 1;
        }
      }
    });

    return totals;
  }, [answeredCardIds, cards, failedCardIds]);
  const updateCardErrorMessage = useMemo(() => {
    if (updateCardMutation.error instanceof Error) {
      return updateCardMutation.error.message;
    }

    return updateCardMutation.error ? 'Card update failed.' : null;
  }, [updateCardMutation.error]);

  const stopAllAudio = useCallback(() => {
    promptAudioRef.current?.stop();
    answerAudioRef.current?.stop();
  }, []);

  const ignorePromise = useCallback((task?: Promise<unknown>) => {
    task?.catch(() => {});
  }, []);

  const syncOverview = useCallback(
    (overview: StudyOverview) => {
      queryClient.setQueryData(['study', 'overview'], overview);
    },
    [queryClient]
  );

  const mergeCardIntoSession = useCallback((updatedCard: StudyCardSummary) => {
    setSession((currentSession) => {
      if (!currentSession) return currentSession;

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
    (updatedCard: StudyCardSummary, grade: 'again' | 'hard' | 'good' | 'easy') => {
      setSession((currentSession) => {
        if (!currentSession) return currentSession;

        const currentCards = [...currentSession.cards];
        const cardIndex = currentCards.findIndex((card) => card.id === updatedCard.id);
        if (cardIndex === -1) return currentSession;

        if (grade === 'again') {
          currentCards.splice(cardIndex, 1);
          currentCards.push(updatedCard);
        } else {
          currentCards.splice(cardIndex, 1);
        }

        return {
          ...currentSession,
          cards: currentCards,
        };
      });
    },
    []
  );

  const captureUndoSnapshot = useCallback(
    (): StudyUndoSnapshot => ({
      session: session ? (JSON.parse(JSON.stringify(session)) as StudySessionResponse) : null,
      currentIndex,
      revealed,
      answeredCardIds,
      failedCardIds,
    }),
    [answeredCardIds, currentIndex, failedCardIds, revealed, session]
  );

  const restoreUndoSnapshot = useCallback(
    (snapshot: StudyUndoSnapshot) => {
      stopAllAudio();
      const restored = cloneStudySnapshot(snapshot);
      setSession(restored.session);
      setCurrentIndex(restored.currentIndex);
      setRevealed(restored.revealed);
      setAnsweredCardIds(restored.answeredCardIds);
      setFailedCardIds(restored.failedCardIds);
      setSessionError(null);
      setShowSetDueControls(false);
    },
    [stopAllAudio]
  );

  const ensureAnswerAudioPrepared = useCallback(
    async (cardId: string) => {
      const existingPromise = inFlightAudioPrep.current.get(cardId);
      if (existingPromise) {
        return existingPromise;
      }

      const request = prepareStudyAnswerAudio(cardId)
        .then((updatedCard) => {
          mergeCardIntoSession(updatedCard);
          return updatedCard;
        })
        .catch((error) => {
          console.warn('Unable to prepare answer audio for study card:', cardId, error);
          throw error;
        })
        .finally(() => {
          inFlightAudioPrep.current.delete(cardId);
        });

      inFlightAudioPrep.current.set(cardId, request);
      return request;
    },
    [mergeCardIntoSession]
  );

  const loadSession = useCallback(
    async (limit: number) => {
      setSessionLoading(true);
      setSessionError(null);

      try {
        const nextSession = await startStudySession(limit);
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
    },
    [syncOverview]
  );

  const revealCurrentCard = useCallback(() => {
    if (!currentCard || revealed || editing) return;

    undoStack.current.push({
      kind: 'reveal',
      snapshot: captureUndoSnapshot(),
    });
    stopAllAudio();
    flushSync(() => setRevealed(true));

    const answerUrl = toAssetUrl(currentCard.answer.answerAudio?.url);
    if (answerUrl) {
      const autoplayKey = `${currentCard.id}:answer:${answerUrl}`;
      answerAutoplayKeys.current.add(autoplayKey);
      ignorePromise(answerAudioRef.current?.play());
      return;
    }

    ignorePromise(ensureAnswerAudioPrepared(currentCard.id));
  }, [
    captureUndoSnapshot,
    currentCard,
    editing,
    ensureAnswerAudioPrepared,
    ignorePromise,
    revealed,
    stopAllAudio,
  ]);

  const exitFocusMode = useCallback(() => {
    stopAllAudio();
    undoStack.current = [];
    motionEnabledRef.current = false;
    lastShakeAtRef.current = 0;
    lastMotionMagnitudeRef.current = null;
    setFocusMode(false);
    setSession(null);
    setSessionError(null);
    setCurrentIndex(0);
    setRevealed(false);
    setEditing(false);
    setShowSetDueControls(false);
    setUndoPending(false);
    setAnsweredCardIds([]);
    setFailedCardIds([]);
  }, [stopAllAudio]);

  const handleGrade = useCallback(
    async (grade: 'again' | 'hard' | 'good' | 'easy') => {
      if (!currentCard || reviewMutation.isPending || undoPending || editing) return;

      const undoSnapshot = captureUndoSnapshot();
      stopAllAudio();
      const reviewResult = await reviewMutation.mutateAsync({ cardId: currentCard.id, grade });
      setAnsweredCardIds((current) =>
        current.includes(currentCard.id) ? current : [...current, currentCard.id]
      );
      setFailedCardIds((current) => {
        if (grade === 'again') {
          return current.includes(currentCard.id) ? current : [...current, currentCard.id];
        }

        return current.filter((cardId) => cardId !== currentCard.id);
      });
      undoStack.current.push({
        kind: 'grade',
        snapshot: undoSnapshot,
        reviewLogId: reviewResult.reviewLogId,
      });
      applyReviewResultToSession(reviewResult.card, grade);
      syncOverview(reviewResult.overview);
      setCurrentIndex((current) => {
        const currentSessionCardCount = session?.cards.length ?? 0;
        const nextLength =
          grade === 'again' ? currentSessionCardCount : Math.max(currentSessionCardCount - 1, 0);

        if (nextLength === 0) return 0;
        return Math.min(current, nextLength - 1);
      });
      setRevealed(false);
    },
    [
      applyReviewResultToSession,
      captureUndoSnapshot,
      currentCard,
      editing,
      reviewMutation,
      session,
      stopAllAudio,
      syncOverview,
      undoPending,
    ]
  );

  const handleBuryForSession = useCallback(() => {
    if (!currentCard || !revealed || editing) return;

    undoStack.current.push({
      kind: 'bury',
      snapshot: captureUndoSnapshot(),
    });
    stopAllAudio();
    setAnsweredCardIds((current) => current.filter((cardId) => cardId !== currentCard.id));
    setFailedCardIds((current) => current.filter((cardId) => cardId !== currentCard.id));
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
        });

        syncOverview(result.overview);
        setAnsweredCardIds((current) => current.filter((cardId) => cardId !== currentCard.id));
        setFailedCardIds((current) => current.filter((cardId) => cardId !== currentCard.id));
        setShowSetDueControls(false);

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

  const enterFocusMode = useCallback(async () => {
    stopAllAudio();
    undoStack.current = [];
    motionEnabledRef.current = supportsTouchMotion() ? await requestDeviceMotionAccess() : false;
    lastShakeAtRef.current = 0;
    lastMotionMagnitudeRef.current = null;
    setFocusMode(true);
    setCurrentIndex(0);
    setRevealed(false);
    setEditing(false);
    setUndoPending(false);
    setAnsweredCardIds([]);
    setFailedCardIds([]);
    const sessionLimit = Math.max(availableCount, 1);
    try {
      await loadSession(sessionLimit);
    } catch {
      // loadSession already updates session error state for the dashboard.
    }
  }, [availableCount, loadSession, stopAllAudio]);

  const handleUndo = useCallback(async () => {
    if (
      undoPending ||
      reviewMutation.isPending ||
      cardActionMutation.isPending ||
      sessionLoading ||
      editing
    )
      return;

    const action = undoStack.current.pop();
    if (!action) return;

    stopAllAudio();

    if (action.kind !== 'grade') {
      restoreUndoSnapshot(action.snapshot);
      return;
    }

    setUndoPending(true);
    try {
      const undoResult = await undoStudyReview(action.reviewLogId);
      restoreUndoSnapshot(action.snapshot);
      syncOverview(undoResult.overview);
    } catch (error) {
      undoStack.current.push(action);
      setSessionError(error instanceof Error ? error.message : 'Unable to undo study action.');
    } finally {
      setUndoPending(false);
    }
  }, [
    editing,
    cardActionMutation.isPending,
    restoreUndoSnapshot,
    reviewMutation.isPending,
    sessionLoading,
    stopAllAudio,
    syncOverview,
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

  useEffect(() => {
    if (!focusMode || !cards.length) return;

    cards
      .slice(0, PREWARM_CARD_COUNT)
      .filter((card) => !toAssetUrl(card.answer.answerAudio?.url))
      .forEach((card) => {
        ignorePromise(ensureAnswerAudioPrepared(card.id));
      });
  }, [cards, ensureAnswerAudioPrepared, focusMode, ignorePromise]);

  useEffect(() => {
    if (!focusMode || !currentCard || revealed || !isAudioLedPromptCard(currentCard)) return;

    const promptUrl = toAssetUrl(currentCard.prompt.cueAudio?.url);
    if (!promptUrl) return;

    const autoplayKey = `${currentCard.id}:prompt:${promptUrl}`;
    if (promptAutoplayKeys.current.has(autoplayKey)) return;

    promptAutoplayKeys.current.add(autoplayKey);
    ignorePromise(promptAudioRef.current?.play());
  }, [currentCard, focusMode, ignorePromise, revealed]);

  useEffect(() => {
    if (!focusMode || !currentCard || !revealed) return;

    const answerUrl = toAssetUrl(currentCard.answer.answerAudio?.url);
    if (!answerUrl) return;

    const autoplayKey = `${currentCard.id}:answer:${answerUrl}`;
    if (answerAutoplayKeys.current.has(autoplayKey)) return;

    answerAutoplayKeys.current.add(autoplayKey);
    ignorePromise(answerAudioRef.current?.play());
  }, [currentCard, focusMode, ignorePromise, revealed]);

  useEffect(() => {
    if (!focusMode) return undefined;

    const handleDeviceMotion = (event: DeviceMotionEvent) => {
      if (
        !motionEnabledRef.current ||
        undoPending ||
        reviewMutation.isPending ||
        cardActionMutation.isPending ||
        sessionLoading
      ) {
        return;
      }

      const acceleration = event.accelerationIncludingGravity ?? event.acceleration;
      if (!acceleration) return;

      const x = Math.abs(acceleration.x ?? 0);
      const y = Math.abs(acceleration.y ?? 0);
      const z = Math.abs(acceleration.z ?? 0);
      const magnitude = x + y + z;
      const previousMagnitude = lastMotionMagnitudeRef.current;
      lastMotionMagnitudeRef.current = magnitude;

      if (previousMagnitude === null) return;

      const delta = Math.abs(magnitude - previousMagnitude);
      const now = Date.now();

      if (
        magnitude >= SHAKE_ACCELERATION_THRESHOLD &&
        delta >= SHAKE_DELTA_THRESHOLD &&
        now - lastShakeAtRef.current >= SHAKE_COOLDOWN_MS
      ) {
        lastShakeAtRef.current = now;
        ignorePromise(handleUndo());
      }
    };

    window.addEventListener('devicemotion', handleDeviceMotion);
    return () => window.removeEventListener('devicemotion', handleDeviceMotion);
  }, [
    focusMode,
    handleUndo,
    ignorePromise,
    reviewMutation.isPending,
    cardActionMutation.isPending,
    sessionLoading,
    undoPending,
  ]);

  useEffect(() => {
    if (!focusMode) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault();
        ignorePromise(handleUndo());
        return;
      }

      if (editing && event.key === 'Escape') {
        event.preventDefault();
        setEditing(false);
        return;
      }

      if (editing || cardActionMutation.isPending) return;

      if (event.code === 'Space') {
        event.preventDefault();
        revealCurrentCard();
        return;
      }

      if (!revealed || reviewMutation.isPending) return;

      if (event.key === '1') {
        event.preventDefault();
        ignorePromise(handleGrade('again'));
      } else if (event.key === '2') {
        event.preventDefault();
        ignorePromise(handleGrade('hard'));
      } else if (event.key === '3') {
        event.preventDefault();
        ignorePromise(handleGrade('good'));
      } else if (event.key === '4') {
        event.preventDefault();
        ignorePromise(handleGrade('easy'));
      } else if (event.key === 'Escape') {
        event.preventDefault();
        exitFocusMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    editing,
    cardActionMutation.isPending,
    exitFocusMode,
    focusMode,
    handleGrade,
    handleUndo,
    ignorePromise,
    reviewMutation.isPending,
    revealCurrentCard,
    revealed,
  ]);

  const headline = useMemo(() => {
    if (!overviewQuery.data) return 'Study';
    return `${overviewQuery.data.dueCount} due, ${overviewQuery.data.newCount} new`;
  }, [overviewQuery.data]);

  if (!enabled) {
    return (
      <section className="card retro-paper-panel max-w-3xl">
        <h1 className="mb-4 text-3xl font-bold text-navy">Study</h1>
        <p className="text-gray-600">Study is currently disabled for this environment.</p>
      </section>
    );
  }

  if (focusMode) {
    return (
      <div className="fixed inset-0 z-[60] overflow-y-auto bg-cream">
        <section className="min-h-screen px-4 py-4 sm:px-6 sm:py-6">
          <div
            data-testid="study-focus-shell"
            className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-7xl flex-col rounded-[2rem] bg-[#fdfbf5] p-4 shadow-sm ring-1 ring-gray-200 sm:min-h-[calc(100vh-3rem)] sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={exitFocusMode}
                className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-navy hover:bg-gray-50"
              >
                Exit Study
              </button>
              <div className="text-right">
                <p className="text-lg font-semibold tracking-[0.08em] text-navy">
                  <span className="text-blue-600">{sessionCounts.newRemaining}</span>
                  <span className="px-2 text-gray-400">+</span>
                  <span className="text-red-600">{sessionCounts.failedDue}</span>
                  <span className="px-2 text-gray-400">+</span>
                  <span className="text-emerald-700">{sessionCounts.reviewRemaining}</span>
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.18em] text-gray-400">
                  New + Failed + Review
                </p>
              </div>
            </div>

            {sessionLoading ? (
              <p className="py-16 text-center text-gray-500">Loading study session…</p>
            ) : null}
            {sessionError ? <p className="py-16 text-center text-red-600">{sessionError}</p> : null}

            {!sessionLoading && !sessionError && !currentCard ? (
              <div className="flex min-h-[60vh] flex-1 items-center justify-center rounded-[2rem] border border-dashed border-gray-300 p-8 text-center text-gray-600">
                No cards are ready right now. Import more cards or come back when something is due.
              </div>
            ) : null}

            {currentCard ? (
              <div className="mt-6 flex flex-1 flex-col justify-between space-y-6">
                {!revealed ? (
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label="Reveal answer"
                    onClick={revealCurrentCard}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        revealCurrentCard();
                      }
                    }}
                    className="flex min-h-[60vh] flex-1 w-full items-center justify-center rounded-[2rem] bg-white px-6 py-12 text-left shadow-sm ring-1 ring-gray-200 transition hover:shadow-md md:px-12"
                  >
                    <div className="w-full">
                      <StudyCardFace
                        card={currentCard}
                        side="front"
                        promptAudioRef={promptAudioRef}
                      />
                      {currentCard.cardType !== 'cloze' ? (
                        <p className="mt-10 text-center text-sm uppercase tracking-[0.2em] text-gray-400">
                          Tap, click, or press space to reveal
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="min-h-[60vh] flex-1 rounded-[2rem] bg-white px-6 py-10 shadow-sm ring-1 ring-gray-200 md:px-12">
                    {editing ? (
                      <StudyCardEditor
                        card={currentCard}
                        isSaving={updateCardMutation.isPending}
                        error={updateCardErrorMessage}
                        onCancel={() => {
                          setEditing(false);
                        }}
                        onSave={async ({ prompt, answer }) => {
                          stopAllAudio();
                          const updatedCard = await updateCardMutation.mutateAsync({
                            cardId: currentCard.id,
                            prompt,
                            answer,
                          });
                          mergeCardIntoSession(updatedCard);
                          setEditing(false);
                          setRevealed(false);
                          setSessionError(null);
                        }}
                      />
                    ) : (
                      <div className="space-y-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div
                            data-testid="study-review-actions"
                            className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                stopAllAudio();
                                setEditing(true);
                              }}
                              disabled={cardActionMutation.isPending}
                              className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Edit card
                            </button>
                            <button
                              type="button"
                              onClick={handleBuryForSession}
                              disabled={cardActionMutation.isPending}
                              className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Bury for session
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                ignorePromise(
                                  handleCardAction(
                                    currentCard.state.queueState === 'suspended'
                                      ? 'unsuspend'
                                      : 'suspend'
                                  )
                                );
                              }}
                              disabled={cardActionMutation.isPending}
                              className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {currentCard.state.queueState === 'suspended'
                                ? 'Unsuspend'
                                : 'Suspend'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                ignorePromise(handleCardAction('forget'));
                              }}
                              disabled={cardActionMutation.isPending}
                              className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Forget
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowSetDueControls((current) => !current)}
                              disabled={cardActionMutation.isPending}
                              className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Set due
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const params = new URLSearchParams({
                                  noteId: currentCard.noteId,
                                  cardId: currentCard.id,
                                });
                                exitFocusMode();
                                navigate(`/app/study/browse?${params.toString()}`);
                              }}
                              className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-navy hover:bg-gray-50"
                            >
                              Open in Browse
                            </button>
                          </div>
                        </div>
                        {showSetDueControls ? (
                          <StudySetDueControls
                            disabled={cardActionMutation.isPending}
                            isSubmitting={cardActionMutation.isPending}
                            onCancel={() => setShowSetDueControls(false)}
                            onSubmit={async ({ mode, dueAt }) => {
                              await handleCardAction('set_due', { mode, dueAt });
                            }}
                          />
                        ) : null}
                        <StudyCardFace
                          card={currentCard}
                          side="back"
                          answerAudioRef={answerAudioRef}
                        />
                      </div>
                    )}
                  </div>
                )}

                {revealed && !editing ? (
                  <div className="grid gap-3 md:grid-cols-4">
                    {(['again', 'hard', 'good', 'easy'] as const).map((grade, index) => (
                      <button
                        key={grade}
                        type="button"
                        onClick={() => {
                          ignorePromise(handleGrade(grade));
                        }}
                        disabled={reviewMutation.isPending || sessionLoading || undoPending}
                        className={`rounded-[1.5rem] border px-4 py-4 text-center transition disabled:cursor-not-allowed disabled:opacity-60 ${gradeButtonStyles[grade]}`}
                      >
                        <p className="text-2xl font-semibold">{gradeIntervals?.[grade] ?? '...'}</p>
                        <p className="mt-2 text-xl font-semibold capitalize">{grade}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-current/70">
                          Key {index + 1}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="card retro-paper-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-navy">Study</h1>
            <p className="text-gray-600">{headline}</p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
            <Link
              to="/app/study/browse"
              className="retro-nav-tab inline-flex items-center justify-center text-white hover:bg-white/20"
            >
              Browse
            </Link>
            <Link
              to="/app/study/import"
              className="retro-nav-tab inline-flex items-center justify-center text-white hover:bg-white/20"
            >
              Import
            </Link>
            <Link
              to="/app/study/create"
              className="retro-nav-tab inline-flex items-center justify-center text-white hover:bg-white/20"
            >
              Create Card
            </Link>
            <Link
              to="/app/study/history"
              className="retro-nav-tab inline-flex items-center justify-center text-white hover:bg-white/20"
            >
              History
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="card retro-paper-panel">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Due</p>
          <p className="text-3xl font-bold text-navy">{overviewQuery.data?.dueCount ?? 0}</p>
        </div>
        <div className="card retro-paper-panel">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">New</p>
          <p className="text-3xl font-bold text-navy">{overviewQuery.data?.newCount ?? 0}</p>
        </div>
        <div className="card retro-paper-panel">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Learning</p>
          <p className="text-3xl font-bold text-navy">{overviewQuery.data?.learningCount ?? 0}</p>
        </div>
        <div className="card retro-paper-panel">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Total</p>
          <p className="text-3xl font-bold text-navy">{overviewQuery.data?.totalCards ?? 0}</p>
        </div>
      </section>

      <section className="card retro-paper-panel space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-navy">Ready to study</h2>
            <p className="text-sm text-gray-500">
              Start a focused review mode that only shows the card and grading controls.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                ignorePromise(overviewQuery.refetch());
              }}
              className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-navy hover:bg-gray-50"
            >
              Refresh counts
            </button>
            <button
              type="button"
              onClick={() => {
                ignorePromise(enterFocusMode());
              }}
              disabled={sessionLoading || availableCount === 0}
              className="rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Begin Study
            </button>
          </div>
        </div>

        {overviewQuery.isLoading ? <p className="text-gray-500">Loading overview…</p> : null}
        {overviewQuery.error ? (
          <p className="text-red-600">
            {overviewQuery.error instanceof Error
              ? overviewQuery.error.message
              : 'Study overview failed to load.'}
          </p>
        ) : null}

        {availableCount === 0 && !overviewQuery.isLoading ? (
          <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-gray-600">
            Import your `日本語` deck or create a card to start studying here.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-cream/70 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Available now</p>
              <p className="mt-3 text-2xl font-semibold text-navy">{availableCount} cards ready</p>
            </div>
            <div className="rounded-2xl bg-cream/70 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Load strategy</p>
              <p className="mt-3 text-base text-navy">
                The dashboard only loads counts. Cards are fetched when study actually begins.
              </p>
            </div>
            <div className="rounded-2xl bg-cream/70 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Keyboard</p>
              <p className="mt-3 text-base text-navy">
                `Space` reveals. `1` again. `2` hard. `3` good. `4` easy. `Cmd+Z` undoes. On mobile,
                shake also undoes.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default StudyPage;
