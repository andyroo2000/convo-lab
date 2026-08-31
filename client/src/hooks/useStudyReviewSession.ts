import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { flushSync } from 'react-dom';
import type {
  StudyCardSetDueMode,
  StudyCardSummary,
  StudyMasteryLevel,
  StudyOverview,
  StudyPromptPayload,
  StudyAnswerPayload,
} from '@languageflow/shared/src/types';

import {
  createStudyReviewRequest,
  type StudySessionResponse,
  type StudyReviewRequest,
  startStudyLesson,
  startStudyIntroductionCohortLesson,
  startStudySession,
  undoStudyReview,
  useRegenerateStudyAnswerAudio,
  useDeleteStudyCard,
  useStudyCardAction,
  useSubmitStudyReview,
  useUpdateStudyCard,
} from './useStudy';
import { JsonRequestError } from '../lib/apiClient';
import StudyReviewIdentityMismatchError from '../lib/studyReviewIdentityMismatch';
import useStudyAudioAutoplay from './useStudyAudioAutoplay';
import { normalizeStudyMasteryLevel } from '../components/study/studyMastery';
import useStudyAnswerAudioPrep from './useStudyAnswerAudioPrep';
import useStudyKeyboardShortcuts from './useStudyKeyboardShortcuts';
import { useStudyMotionUndo } from './useStudyMotionUndo';
import useStudyUndoStack from './useStudyUndoStack';
import getDeviceStudyTimeZone from '../components/study/studyTimeZoneUtils';
import { getStudyCardAudioUrl } from '../components/study/studyCardUtils';
import useStudyBackgroundTask from './useStudyBackgroundTask';
import {
  cloneStudySnapshot,
  getCardsAfterReview,
  hasPersistedFailure,
  isCardEligibleForSession,
  type StudyUndoAction,
  type StudyUndoSnapshot,
} from './studyReviewSessionUtils';
import { createStudyReviewRequestGuard } from './studyReviewRequestGuard';
import {
  buildStudySessionWrapUp,
  type StudySessionReviewRecord,
} from '../components/study/studySessionWrapUpModel';
import { useAuth } from '../contexts/AuthContext';
import {
  StudyAchievementSessionStore,
  type StudyAchievementSessionCompletion,
} from '../components/study/studyAchievementSessionModel';
import {
  allPresentedAchievements,
  type AchievementCatalog,
  type AchievementProgress,
} from '../components/study/achievementModel';
import { getAchievementCatalog, getAchievementProgress } from '../lib/achievementApi';

const ACHIEVEMENT_PROGRESS_SESSION_START_FRESHNESS_MS = 60_000;

interface AchievementSessionBootstrap {
  cancelled: boolean;
  promise: Promise<void> | null;
}

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
  const [masteryAnimation, setMasteryAnimation] = useState<{
    id: string;
    card: StudyCardSummary;
    label: string;
    fromLevel: StudyMasteryLevel;
    toLevel: StudyMasteryLevel;
    passed: boolean;
  } | null>(null);
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
  const [achievementCatalog, setAchievementCatalog] = useState<AchievementCatalog | null>(null);
  const [achievementProgress, setAchievementProgress] = useState<AchievementProgress | null>(null);
  const [currentAchievementIndex, setCurrentAchievementIndex] = useState(0);
  const [achievementCelebrationPresented, setAchievementCelebrationPresented] = useState(false);
  const [practiceCards, setPracticeCards] = useState<StudyCardSummary[] | null>(null);
  const [practiceInitialCount, setPracticeInitialCount] = useState(0);
  const requestGuardRef = useRef(createStudyReviewRequestGuard());
  const sessionEpochRef = useRef(0);
  const sessionLoadRequestRef = useRef(0);
  const activeLessonCohortIdRef = useRef<string | null>(null);
  const sessionCardCountRef = useRef(0);
  const canSurfaceAsyncSessionErrorRef = useRef(false);
  const answeredCardIdsRef = useRef<Set<string>>(new Set());
  const autoRefreshEmptySessionRef = useRef(false);
  const achievementCompletionRequestIdRef = useRef(0);
  const activeAchievementCompletionRequestRef = useRef<number | null>(null);
  const pendingReviewOperationRef = useRef<{
    request: StudyReviewRequest;
    undoSnapshot: StudyUndoSnapshot;
  } | null>(null);
  const runBackgroundTask = useStudyBackgroundTask();
  const cardStartedAtRef = useRef(Date.now());
  const achievementSessionStore = useMemo(
    () =>
      userId && typeof window !== 'undefined'
        ? new StudyAchievementSessionStore(window.localStorage, userId)
        : null,
    [userId]
  );
  const achievementCatalogRef = useRef<AchievementCatalog | null>(null);
  const achievementProgressSyncedAtRef = useRef<number | null>(null);
  const achievementSyncQueueRef = useRef<Promise<void>>(Promise.resolve());
  const achievementSyncInFlightRef = useRef<{
    evaluate: boolean;
    request: Promise<{ catalog: AchievementCatalog; progress: AchievementProgress }>;
  } | null>(null);
  const achievementSessionBootstrapRef = useRef<AchievementSessionBootstrap | null>(null);

  const syncAchievements = useCallback((evaluate = true, force = false) => {
    const inFlight = achievementSyncInFlightRef.current;
    if (!force && inFlight && (inFlight.evaluate || !evaluate)) {
      return inFlight.request;
    }

    const request = achievementSyncQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        const [catalog, progress] = await Promise.all([
          achievementCatalogRef.current
            ? Promise.resolve(achievementCatalogRef.current)
            : getAchievementCatalog(),
          getAchievementProgress({ evaluate }),
        ]);
        if (catalog.revision !== progress.revision) {
          throw new Error('Achievement catalog and progress revisions did not match.');
        }
        achievementCatalogRef.current = catalog;
        achievementProgressSyncedAtRef.current = Date.now();
        setAchievementCatalog(catalog);
        setAchievementProgress(progress);
        return { catalog, progress };
      });
    achievementSyncInFlightRef.current = { evaluate, request };
    achievementSyncQueueRef.current = request.then(
      () => undefined,
      () => undefined
    );
    const clearInFlightRequest = () => {
      if (achievementSyncInFlightRef.current?.request === request) {
        achievementSyncInFlightRef.current = null;
      }
    };
    request.then(clearInFlightRequest, clearInFlightRequest);
    return request;
  }, []);

  const startAchievementReviewSession = useCallback(() => {
    const bootstrap: AchievementSessionBootstrap = {
      cancelled: false,
      promise: null,
    };
    if (achievementSessionBootstrapRef.current) {
      achievementSessionBootstrapRef.current.cancelled = true;
    }
    achievementSessionBootstrapRef.current = bootstrap;

    const cachedAwards = achievementProgress?.awards ?? [];
    achievementSessionStore?.beginReviewSession(cachedAwards);

    bootstrap.promise = (async () => {
      const progressSyncedAt = achievementProgressSyncedAtRef.current;
      const hasFreshAchievementProgress =
        achievementProgress !== null &&
        progressSyncedAt !== null &&
        Date.now() - progressSyncedAt <= ACHIEVEMENT_PROGRESS_SESSION_START_FRESHNESS_MS;

      if (hasFreshAchievementProgress) return;

      try {
        const currentAwards = (await syncAchievements(false)).progress.awards;
        if (bootstrap.cancelled || achievementSessionBootstrapRef.current !== bootstrap) return;

        achievementSessionStore?.refreshCurrentSessionBaseline(currentAwards);
      } catch {
        // Reviews remain available offline, using cached awards when available.
      }
    })();

    runBackgroundTask(bootstrap.promise, {
      label: 'Study achievement-session bootstrap',
    });
    return bootstrap;
  }, [achievementProgress, achievementSessionStore, runBackgroundTask, syncAchievements]);

  const recordAchievementReview = useCallback(
    (record: StudySessionReviewRecord) => {
      achievementSessionStore?.recordReview(record);
    },
    [achievementSessionStore]
  );

  const undoAchievementReview = useCallback(
    (reviewId: string) => {
      achievementSessionStore?.undoReview(reviewId);
    },
    [achievementSessionStore]
  );

  const cards = useMemo(() => session?.cards ?? [], [session?.cards]);
  const practiceMode = practiceCards !== null;
  const practiceComplete = practiceMode && practiceCards.length === 0;
  const presentedCards = practiceCards ?? cards;
  const currentCard = practiceMode ? (practiceCards[0] ?? null) : (cards[currentIndex] ?? null);
  const sessionWrapUp = useMemo(
    () => buildStudySessionWrapUp(sessionReviewRecords),
    [sessionReviewRecords]
  );
  const reviewQueueExhausted =
    focusMode &&
    sessionKind === 'reviews' &&
    sessionReviewRecords.length > 0 &&
    cards.length === 0 &&
    (session?.overview.dueCount ?? 0) === 0 &&
    (session?.overview.failedCount ?? 0) === 0 &&
    !practiceMode;
  const reviewSessionComplete = !practiceMode && (reviewQueueExhausted || sessionWasEnded);
  const completionAchievements = useMemo(() => {
    if (!achievementCatalog || !achievementProgress || !achievementCompletion) return [];
    const achievementIds = new Set(achievementCompletion.newAwardIds);
    return allPresentedAchievements(achievementCatalog, achievementProgress)
      .filter((achievement) => achievementIds.has(achievement.id))
      .sort((left, right) => (left.earnedAt ?? '').localeCompare(right.earnedAt ?? ''));
  }, [achievementCatalog, achievementCompletion, achievementProgress]);
  const currentAchievement =
    !achievementCelebrationPresented && completionAchievements[currentAchievementIndex]
      ? completionAchievements[currentAchievementIndex]
      : null;
  // Ref so handlers always read the live card even if a background session update
  // races with a click (stale-closure guard). Cast needed for @types/react 18.3.5.
  const currentCardRef = useRef<StudyCardSummary | null>(
    null
  ) as MutableRefObject<StudyCardSummary | null>;
  currentCardRef.current = currentCard;
  const reviewBusy = reviewMutation.isPending || reviewSubmitPending || reviewRetryAvailable;
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
  let sessionProgress = 0;
  if (practiceMode && practiceInitialCount > 0) {
    sessionProgress = practiceComplete
      ? 1
      : Math.max(0, (practiceInitialCount - practiceCards.length) / practiceInitialCount);
  } else if (sessionCardCountRef.current > 0) {
    sessionProgress =
      cards.length === 0 ? 1 : Math.min(0.99, answeredCardIds.length / sessionCardCountRef.current);
  }
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
      let progress: AchievementProgress;
      try {
        ({ progress } = await syncAchievements());
        if (cancelled || sessionEpochRef.current !== expectedEpoch) return;
      } catch {
        return;
      }

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

  const loadSession = useCallback(
    async (
      kind: 'reviews' | 'lessons' = sessionKind,
      options: { allowEmptySessionRefresh?: boolean; lessonCohortId?: string } = {},
      expectedEpoch = sessionEpochRef.current
    ) => {
      const requestId = sessionLoadRequestRef.current + 1;
      sessionLoadRequestRef.current = requestId;
      const isCurrentRequest = () =>
        sessionEpochRef.current === expectedEpoch && sessionLoadRequestRef.current === requestId;

      if (!isCurrentRequest()) return null;

      setSessionLoading(true);
      setSessionError(null);

      try {
        let nextSession: StudySessionResponse;
        if (kind === 'lessons' && options.lessonCohortId) {
          nextSession = await startStudyIntroductionCohortLesson(options.lessonCohortId);
        } else if (kind === 'lessons') {
          nextSession = await startStudyLesson();
        } else {
          nextSession = await startStudySession();
        }
        if (!isCurrentRequest()) return null;

        autoRefreshEmptySessionRef.current =
          kind === 'reviews' &&
          nextSession.cards.length === 0 &&
          options.allowEmptySessionRefresh !== false;
        sessionCardCountRef.current = nextSession.cards.length;
        setSession(nextSession);
        setLessonPhase(kind === 'lessons' ? 'preview' : 'quiz');
        syncOverview(nextSession.overview);
        return nextSession;
      } catch (error) {
        if (!isCurrentRequest()) return null;

        setSession(null);
        const message = error instanceof Error ? error.message : 'Study session failed to load.';
        setSessionError(message);
        throw error;
      } finally {
        if (isCurrentRequest()) {
          setSessionLoading(false);
        }
      }
    },
    [sessionKind, syncOverview]
  );

  const revealCurrentCard = useCallback(() => {
    if (!currentCard || revealed || editing) return;

    pushUndo({
      kind: 'reveal',
      snapshot: captureUndoSnapshot(),
    });
    stopAllAudio();
    flushSync(() => setRevealed(true));

    const answerUrl = getStudyCardAudioUrl(currentCard);
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

  const prepareSessionCompletion = useCallback(() => {
    if (activeAchievementCompletionRequestRef.current !== null) return;
    const requestId = achievementCompletionRequestIdRef.current + 1;
    achievementCompletionRequestIdRef.current = requestId;
    activeAchievementCompletionRequestRef.current = requestId;
    setSessionWasEnded(true);

    const currentAwards = achievementProgress?.awards ?? [];
    const completion =
      achievementSessionStore?.prepareCurrentSessionCompletion(currentAwards) ?? null;
    setAchievementCompletion(completion);
    setCurrentAchievementIndex(0);
    setAchievementCelebrationPresented(completion?.celebrationPresented ?? true);

    const expectedEpoch = sessionEpochRef.current;
    runBackgroundTask(
      (async () => {
        try {
          // Queue an evaluation that starts after the final review has committed;
          // an older in-flight baseline request cannot authoritatively include it.
          const refreshedAwards = (await syncAchievements(true, true)).progress.awards;
          if (
            sessionEpochRef.current !== expectedEpoch ||
            activeAchievementCompletionRequestRef.current !== requestId
          ) {
            return;
          }

          const refreshedCompletion =
            achievementSessionStore?.prepareCurrentSessionCompletion(refreshedAwards) ?? null;
          if (!refreshedCompletion || refreshedCompletion.id !== completion?.id) return;

          setAchievementCompletion(refreshedCompletion);
          setCurrentAchievementIndex(0);
          setAchievementCelebrationPresented(refreshedCompletion.celebrationPresented);
        } catch {
          // The wrap-up remains available offline. A later launch can recover a new award.
        } finally {
          if (
            sessionEpochRef.current === expectedEpoch &&
            activeAchievementCompletionRequestRef.current === requestId
          ) {
            activeAchievementCompletionRequestRef.current = null;
          }
        }
      })(),
      { label: 'Study achievement completion refresh' }
    );
  }, [achievementProgress?.awards, achievementSessionStore, runBackgroundTask, syncAchievements]);

  useEffect(() => {
    if (!reviewQueueExhausted || achievementCompletion || masteryAnimation !== null) return;
    prepareSessionCompletion();
  }, [achievementCompletion, masteryAnimation, prepareSessionCompletion, reviewQueueExhausted]);

  const exitFocusMode = useCallback(() => {
    sessionEpochRef.current += 1;
    if (achievementSessionBootstrapRef.current) {
      achievementSessionBootstrapRef.current.cancelled = true;
      achievementSessionBootstrapRef.current = null;
    }
    achievementCompletionRequestIdRef.current += 1;
    activeAchievementCompletionRequestRef.current = null;
    achievementSessionStore?.cancelCurrentSession();
    stopAllAudio();
    resetUndo();
    canSurfaceAsyncSessionErrorRef.current = false;
    setFocusMode(false);
    setSessionKind('reviews');
    setLessonPhase('preview');
    setMasteryAnimation(null);
    setSession(null);
    setSessionLoading(false);
    setSessionError(null);
    setReviewConflictRecovered(false);
    setCurrentIndex(0);
    setRevealed(false);
    setEditing(false);
    setShowSetDueControls(false);
    setUndoPending(false);
    activeLessonCohortIdRef.current = null;
    requestGuardRef.current.reset();
    setReviewSubmitPending(false);
    pendingReviewOperationRef.current = null;
    setReviewRetryAvailable(false);
    autoRefreshEmptySessionRef.current = false;
    answeredCardIdsRef.current = new Set();
    setAnsweredCardIds([]);
    setSessionReviewRecords([]);
    setSessionWasEnded(false);
    setAchievementCompletion(null);
    setCurrentAchievementIndex(0);
    setAchievementCelebrationPresented(false);
    setPracticeCards(null);
    setPracticeInitialCount(0);
    runBackgroundTask(() => queryClient.invalidateQueries({ queryKey: ['study', 'overview'] }), {
      label: 'Study overview refresh',
    });
  }, [achievementSessionStore, queryClient, resetUndo, runBackgroundTask, stopAllAudio]);

  const handleGrade = useCallback(
    async (grade: 'again' | 'hard' | 'good' | 'easy') => {
      if (
        !currentCard ||
        requestGuardRef.current.isBusy() ||
        reviewMutation.isPending ||
        undoPending ||
        editing ||
        masteryAnimation !== null
      ) {
        return;
      }

      if (practiceMode) {
        stopAllAudio();
        resetStudyAudioAutoplayForCard(currentCard.id);
        setPracticeCards((current) => {
          if (!current || current.length === 0) return current;
          const [reviewedCard, ...remaining] = current;
          return grade === 'again' ? [...remaining, reviewedCard] : remaining;
        });
        setRevealed(false);
        setSessionError(null);
        cardStartedAtRef.current = Date.now();
        return;
      }

      if (sessionKind === 'lessons' && grade === 'again') {
        stopAllAudio();
        resetStudyAudioAutoplayForCard(currentCard.id);
        const nextCards = [
          ...cards.slice(currentIndex + 1),
          ...cards.slice(0, currentIndex),
          currentCard,
        ];
        setSession((currentSession) =>
          currentSession ? { ...currentSession, cards: nextCards } : currentSession
        );
        setCurrentIndex(0);
        setRevealed(false);
        setSessionError(null);
        return;
      }

      const pendingOperation = pendingReviewOperationRef.current;
      if (
        pendingOperation &&
        (pendingOperation.request.cardId !== currentCard.id ||
          pendingOperation.request.grade !== grade)
      ) {
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
      try {
        setReviewSubmitPending(true);
        setMasteryAnimation(null);
        stopAllAudio();
        const reviewResult = await reviewMutation.mutateAsync(operation.request);
        if (sessionEpochRef.current !== expectedEpoch) return;

        pendingReviewOperationRef.current = null;
        setReviewRetryAvailable(false);

        answeredCardIdsRef.current.add(currentCard.id);
        setAnsweredCardIds((current) =>
          current.includes(currentCard.id) ? current : [...current, currentCard.id]
        );
        pushUndo({
          kind: 'grade',
          snapshot: operation.undoSnapshot,
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
        autoRefreshEmptySessionRef.current = sessionKind === 'reviews' && nextCards.length === 0;
        const previousLevel = currentCard.masteryLevel ?? 'apprentice';
        const nextLevel = reviewResult.card?.masteryLevel ?? previousLevel;
        const normalizedPreviousLevel = normalizeStudyMasteryLevel(previousLevel);
        const normalizedNextLevel = normalizeStudyMasteryLevel(nextLevel, normalizedPreviousLevel);
        const reviewedCard = reviewResult.card ?? currentCard;
        const label =
          reviewedCard.answer.expression ??
          reviewedCard.prompt.cueText ??
          reviewedCard.prompt.cueMeaning ??
          'This item';
        setMasteryAnimation({
          id: reviewResult.reviewLogId,
          card: currentCard,
          label,
          fromLevel: normalizedPreviousLevel,
          toLevel: normalizedNextLevel,
          passed: grade !== 'again',
        });
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
        const reviewRecord: StudySessionReviewRecord = {
          id: reviewResult.reviewLogId,
          cardBefore: currentCard,
          cardAfter: reviewResult.card,
          grade,
          durationMs: operation.request.durationMs ?? durationMs,
        };
        setSessionReviewRecords((current) => [...current, reviewRecord]);
        if (sessionKind === 'reviews') {
          recordAchievementReview(reviewRecord);
        }
        setCurrentIndex((current) => {
          const nextLength = nextCards.length;
          if (nextLength === 0) return 0;
          return Math.min(current, nextLength - 1);
        });
        setRevealed(false);
        if (sessionKind === 'lessons' && nextCards.length === 0) {
          setLessonPhase('complete');
        }
        setSessionError(null);
      } catch (error) {
        if (sessionEpochRef.current !== expectedEpoch) return;

        if (
          error instanceof StudyReviewIdentityMismatchError ||
          (error instanceof JsonRequestError && error.status === 409)
        ) {
          pendingReviewOperationRef.current = null;
          setReviewRetryAvailable(false);
          resetUndo();
          answeredCardIdsRef.current = new Set();
          setAnsweredCardIds([]);
          setSessionReviewRecords([]);
          setCurrentIndex(0);
          setRevealed(false);
          setEditing(false);
          setShowSetDueControls(false);
          setMasteryAnimation(null);
          const achievementBootstrap = achievementSessionBootstrapRef.current;
          await achievementBootstrap?.promise;
          if (sessionEpochRef.current !== expectedEpoch) return;
          if (achievementSessionBootstrapRef.current === achievementBootstrap) {
            achievementSessionBootstrapRef.current = null;
          }
          let currentAwards = achievementProgress?.awards ?? [];
          if (sessionKind === 'reviews') {
            try {
              currentAwards = (await syncAchievements()).progress.awards;
            } catch {
              // Recovery still refreshes the authoritative review queue below.
            }
            if (sessionEpochRef.current !== expectedEpoch) return;
          }
          const recoveredAchievementCompletion =
            sessionKind === 'reviews'
              ? (achievementSessionStore?.prepareInterruptedCompletion(currentAwards) ?? null)
              : null;
          if (!recoveredAchievementCompletion) {
            achievementSessionStore?.cancelCurrentSession();
          }
          const [, refreshedSession] = await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['study', 'overview'] }),
            loadSession(
              sessionKind,
              {
                allowEmptySessionRefresh: false,
                lessonCohortId: activeLessonCohortIdRef.current ?? undefined,
              },
              expectedEpoch
            ),
          ]);
          if (sessionKind === 'reviews' && refreshedSession) {
            achievementSessionStore?.beginReviewSession(currentAwards);
          }
          if (recoveredAchievementCompletion) {
            setSessionWasEnded(true);
            setAchievementCompletion(recoveredAchievementCompletion);
            setCurrentAchievementIndex(0);
            setAchievementCelebrationPresented(recoveredAchievementCompletion.celebrationPresented);
          }
          if (sessionEpochRef.current === expectedEpoch) {
            setReviewConflictRecovered(true);
          }
          return;
        }

        const ambiguous =
          error instanceof TypeError ||
          (error instanceof JsonRequestError &&
            (error.status === 408 || error.status === 429 || error.status >= 500));
        if (ambiguous) {
          setReviewRetryAvailable(true);
        } else {
          pendingReviewOperationRef.current = null;
          setReviewRetryAvailable(false);
        }
        setSessionError(error instanceof Error ? error.message : 'Review failed.');
        throw error;
      } finally {
        requestGuardRef.current.release(requestToken);
        if (sessionEpochRef.current === expectedEpoch) {
          setReviewSubmitPending(false);
        }
      }
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

  const handleBuryForSession = useCallback(() => {
    if (!currentCard || !revealed || editing || pendingReviewOperationRef.current) return;

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
    if (sessionKind === 'lessons' && nextLength === 0) {
      setLessonPhase('complete');
    }
  }, [
    cards.length,
    captureUndoSnapshot,
    currentCard,
    editing,
    pushUndo,
    removeCardFromSession,
    revealed,
    sessionKind,
    stopAllAudio,
  ]);

  const handleCardAction = useCallback(
    async (
      action: 'suspend' | 'unsuspend' | 'forget' | 'set_due',
      options?: { mode?: StudyCardSetDueMode; dueAt?: string }
    ) => {
      if (
        !currentCard ||
        editing ||
        pendingReviewOperationRef.current ||
        requestGuardRef.current.isBusy() ||
        cardActionMutation.isPending
      ) {
        return;
      }

      const expectedEpoch = sessionEpochRef.current;
      const requestToken = requestGuardRef.current.acquire('card-action', currentCard.id);
      if (!requestToken) return;
      try {
        stopAllAudio();
        const result = await cardActionMutation.mutateAsync({
          cardId: currentCard.id,
          action,
          mode: options?.mode,
          dueAt: options?.dueAt,
          timeZone: options?.mode === 'tomorrow' ? getDeviceStudyTimeZone() : undefined,
        });
        if (sessionEpochRef.current !== expectedEpoch) return;

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
          if (sessionKind === 'lessons' && nextLength === 0) {
            setLessonPhase('complete');
          }
        }

        setRevealed(false);
        setSessionError(null);
      } catch (error) {
        if (sessionEpochRef.current !== expectedEpoch) return;

        setSessionError(error instanceof Error ? error.message : 'Card action failed.');
      } finally {
        requestGuardRef.current.release(requestToken);
      }
    },
    [
      cardActionMutation,
      cards.length,
      currentCard,
      editing,
      mergeCardIntoSession,
      removeCardFromSession,
      sessionKind,
      stopAllAudio,
      syncOverview,
    ]
  );

  const saveCurrentCard = useCallback(
    async (payload: { prompt: StudyPromptPayload; answer: StudyAnswerPayload }) => {
      const card = currentCardRef.current; // read live value, not stale closure
      if (!card) return;
      const expectedEpoch = sessionEpochRef.current;

      stopAllAudio();
      const updatedCard = await updateCardMutation.mutateAsync({
        cardId: card.id,
        expectedRevision: card.revision ?? 0,
        prompt: payload.prompt,
        answer: payload.answer,
      });
      if (sessionEpochRef.current !== expectedEpoch) return;

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
      const expectedEpoch = sessionEpochRef.current;

      stopAllAudio();
      const updatedCard = await regenerateAudioMutation.mutateAsync({
        cardId: card.id,
        answerAudioVoiceId: payload.answerAudioVoiceId,
        answerAudioTextOverride: payload.answerAudioTextOverride,
      });
      if (sessionEpochRef.current !== expectedEpoch) return undefined;

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
    const expectedEpoch = sessionEpochRef.current;

    stopAllAudio();
    try {
      await deleteCardMutation.mutateAsync(currentCard.id);
      if (sessionEpochRef.current !== expectedEpoch) return;

      autoRefreshEmptySessionRef.current = false;
      setAnsweredCardIds((current) => current.filter((cardId) => cardId !== currentCard.id));
      removeCardFromSession(currentCard.id);
      const nextLength = Math.max(cards.length - 1, 0);
      setCurrentIndex((current) => (nextLength === 0 ? 0 : Math.min(current, nextLength - 1)));
      setEditing(false);
      setRevealed(false);
      setSessionError(null);
    } catch (error) {
      if (sessionEpochRef.current !== expectedEpoch) return;

      setSessionError(error instanceof Error ? error.message : 'Unable to delete card.');
      throw error;
    }
  }, [cards.length, currentCard, deleteCardMutation, removeCardFromSession, stopAllAudio]);

  const handleUndo = useCallback(async () => {
    if (
      undoPending ||
      pendingReviewOperationRef.current ||
      requestGuardRef.current.isBusy() ||
      reviewMutation.isPending ||
      cardActionMutation.isPending ||
      sessionLoading ||
      editing ||
      masteryAnimation !== null
    ) {
      return;
    }

    const action = popUndo();
    if (!action) return;
    const expectedEpoch = sessionEpochRef.current;

    stopAllAudio();

    if (action.kind !== 'grade') {
      restoreUndoSnapshot(action.snapshot);
      return;
    }

    const requestToken = requestGuardRef.current.acquire('undo', action.reviewLogId);
    if (!requestToken) {
      pushUndo(action);
      return;
    }
    setUndoPending(true);
    try {
      const undoResult = await undoStudyReview(action.reviewLogId);
      if (sessionEpochRef.current !== expectedEpoch) return;

      restoreUndoSnapshot(action.snapshot);
      syncOverview(undoResult.overview);
      setSessionReviewRecords((current) =>
        current.filter((record) => record.id !== action.reviewLogId)
      );
      if (achievementCompletion) {
        achievementCompletionRequestIdRef.current += 1;
        activeAchievementCompletionRequestRef.current = null;
        achievementSessionStore?.reopenCompletion(
          achievementCompletion.id,
          achievementProgress?.awards ?? []
        );
        setSessionWasEnded(false);
        setAchievementCompletion(null);
        setCurrentAchievementIndex(0);
        setAchievementCelebrationPresented(false);
      }
      undoAchievementReview(action.reviewLogId);
      try {
        await syncAchievements();
      } catch {
        // The successful review undo is authoritative; achievement refresh retries later.
      }
    } catch (error) {
      if (sessionEpochRef.current !== expectedEpoch) return;

      pushUndo(action);
      setSessionError(error instanceof Error ? error.message : 'Unable to undo study action.');
    } finally {
      requestGuardRef.current.release(requestToken);
      if (sessionEpochRef.current === expectedEpoch) {
        setUndoPending(false);
      }
    }
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

  const enterFocusMode = useCallback(
    async (kind: 'reviews' | 'lessons' = 'reviews', options: { lessonCohortId?: string } = {}) => {
      const expectedEpoch = sessionEpochRef.current + 1;
      sessionEpochRef.current = expectedEpoch;
      requestGuardRef.current.reset();
      stopAllAudio();
      resetStudyAudioAutoplay();
      resetUndo();
      pendingReviewOperationRef.current = null;
      achievementCompletionRequestIdRef.current += 1;
      activeAchievementCompletionRequestRef.current = null;
      setReviewRetryAvailable(false);
      setReviewConflictRecovered(false);
      canSurfaceAsyncSessionErrorRef.current = true;
      setSession(null);
      setSessionLoading(true);
      setFocusMode(true);
      setSessionKind(kind);
      activeLessonCohortIdRef.current =
        kind === 'lessons' ? (options.lessonCohortId ?? null) : null;
      setLessonPhase(kind === 'lessons' ? 'preview' : 'quiz');
      setMasteryAnimation(null);
      setCurrentIndex(0);
      setRevealed(false);
      setEditing(false);
      setUndoPending(false);
      autoRefreshEmptySessionRef.current = false;
      answeredCardIdsRef.current = new Set();
      setAnsweredCardIds([]);
      setSessionReviewRecords([]);
      setSessionWasEnded(false);
      setAchievementCompletion(null);
      setCurrentAchievementIndex(0);
      setAchievementCelebrationPresented(false);
      setPracticeCards(null);
      setPracticeInitialCount(0);
      if (achievementSessionBootstrapRef.current) {
        achievementSessionBootstrapRef.current.cancelled = true;
      }
      achievementSessionBootstrapRef.current = null;
      const achievementBootstrap = kind === 'reviews' ? startAchievementReviewSession() : null;
      if (kind !== 'reviews') {
        achievementSessionStore?.cancelCurrentSession();
      }
      runBackgroundTask(() => requestMotionPermission(), {
        label: 'Study motion-permission request',
      });
      try {
        const nextSession = await loadSession(kind, options, expectedEpoch);
        if (!nextSession && achievementBootstrap) {
          achievementBootstrap.cancelled = true;
          if (achievementSessionBootstrapRef.current === achievementBootstrap) {
            achievementSessionBootstrapRef.current = null;
            achievementSessionStore?.cancelCurrentSession();
          }
        }
      } catch {
        if (achievementBootstrap) {
          achievementBootstrap.cancelled = true;
          if (achievementSessionBootstrapRef.current === achievementBootstrap) {
            achievementSessionBootstrapRef.current = null;
            achievementSessionStore?.cancelCurrentSession();
          }
        }
        // loadSession already updates session error state for the dashboard.
      }
    },
    [
      loadSession,
      achievementSessionStore,
      requestMotionPermission,
      resetStudyAudioAutoplay,
      runBackgroundTask,
      resetUndo,
      startAchievementReviewSession,
      stopAllAudio,
    ]
  );

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
    if (achievementCompletion) {
      achievementSessionStore?.consumeCompletion(achievementCompletion.id);
    }
    exitFocusMode();
  }, [achievementCompletion, achievementSessionStore, exitFocusMode]);

  const loadNextLessonBatch = useCallback(async () => {
    answeredCardIdsRef.current = new Set();
    setAnsweredCardIds([]);
    setCurrentIndex(0);
    setRevealed(false);
    await loadSession('lessons', {
      lessonCohortId: activeLessonCohortIdRef.current ?? undefined,
    });
  }, [loadSession]);

  useEffect(() => {
    if (
      !focusMode ||
      practiceMode ||
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
    const nextDueAt = overview.nextDueAt ? new Date(overview.nextDueAt) : null;
    const nextDueMs = nextDueAt && !Number.isNaN(nextDueAt.getTime()) ? nextDueAt.getTime() : null;
    const shouldLoadNow =
      overview.dueCount > 0 || (failedCount > 0 && nextDueMs !== null && nextDueMs <= Date.now());

    if (shouldLoadNow) {
      runBackgroundTask(() => loadSession('reviews', { allowEmptySessionRefresh: false }), {
        label: 'Study session refresh',
      });
      return undefined;
    }

    if (failedCount > 0 && nextDueMs !== null) {
      const delayMs = Math.max(0, Math.min(nextDueMs - Date.now() + 250, 2_147_483_647));
      const timeoutId = window.setTimeout(() => {
        runBackgroundTask(() => loadSession('reviews', { allowEmptySessionRefresh: false }), {
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
    practiceMode,
    reviewBusy,
    runBackgroundTask,
    session?.overview,
    sessionError,
    sessionLoading,
    undoPending,
  ]);

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
