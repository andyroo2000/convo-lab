import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { flushSync } from 'react-dom';
import { fsrs, Rating, type Card as FsrsCard } from 'ts-fsrs';
import type {
  StudyCardSetDueMode,
  StudyCardSummary,
  StudyFsrsState,
  StudyOverview,
  StudyPromptPayload,
  StudyAnswerPayload,
} from '@shared/types';

import {
  type StudySessionResponse,
  prepareStudyAnswerAudio,
  startStudySession,
  undoStudyReview,
  useStudyCardAction,
  useSubmitStudyReview,
  useUpdateStudyCard,
} from './useStudy';
import { AudioPlayerHandle } from '../components/study/StudyCardPreview';
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

interface UseStudyReviewSessionOptions {
  availableCount: number;
}

const useStudyReviewSession = ({ availableCount }: UseStudyReviewSessionOptions) => {
  const queryClient = useQueryClient();
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
  const sessionCardCountRef = useRef(0);
  const motionEnabledRef = useRef(false);
  const lastShakeAtRef = useRef(0);
  const lastMotionMagnitudeRef = useRef<number | null>(null);

  const cards = useMemo(() => session?.cards ?? [], [session?.cards]);
  const currentCard = cards[currentIndex] ?? null;
  const gradeIntervals = useMemo(() => getGradeIntervals(currentCard), [currentCard]);
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

  useEffect(() => {
    sessionCardCountRef.current = session?.cards.length ?? 0;
  }, [session]);

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
        const currentSessionCardCount = sessionCardCountRef.current;
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

  const saveCurrentCard = useCallback(
    async (payload: { prompt: StudyPromptPayload; answer: StudyAnswerPayload }) => {
      if (!currentCard) return;

      stopAllAudio();
      const updatedCard = await updateCardMutation.mutateAsync({
        cardId: currentCard.id,
        prompt: payload.prompt,
        answer: payload.answer,
      });
      mergeCardIntoSession(updatedCard);
      setEditing(false);
      setRevealed(false);
      setSessionError(null);
    },
    [currentCard, mergeCardIntoSession, stopAllAudio, updateCardMutation]
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
    ) {
      return;
    }

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
    revealCurrentCard,
    revealed,
    reviewMutation.isPending,
  ]);

  return {
    focusMode,
    sessionLoading,
    sessionError,
    currentCard,
    revealed,
    editing,
    showSetDueControls,
    undoPending,
    sessionCounts,
    gradeIntervals,
    promptAudioRef,
    answerAudioRef,
    reviewMutation,
    cardActionMutation,
    updateCardMutation,
    updateCardErrorMessage,
    setEditing,
    setShowSetDueControls,
    revealCurrentCard,
    exitFocusMode,
    handleGrade,
    handleBuryForSession,
    handleCardAction,
    handleUndo,
    saveCurrentCard,
    enterFocusMode,
  };
};

export default useStudyReviewSession;
