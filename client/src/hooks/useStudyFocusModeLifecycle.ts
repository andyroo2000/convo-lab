import type { QueryClient } from '@tanstack/react-query';
import {
  useCallback,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';

import type { StudyCardSummary } from '@languageflow/shared/src/types';
import type {
  StudyAchievementSessionCompletion,
  StudyAchievementSessionStore,
} from '../components/study/studyAchievementSessionModel';
import type { StudySessionReviewRecord } from '../components/study/studySessionWrapUpModel';
import type useStudyBackgroundTask from './useStudyBackgroundTask';
import type { AchievementSessionBootstrap } from './useStudyAchievementReviewSession';
import type { StudyReviewRequestGuard } from './studyReviewRequestGuard';
import type { PendingStudyReviewOperation } from './studyReviewSubmissionFlow';
import type { StudyMasteryAnimation } from './studyReviewSubmissionRules';
import type { StudySessionResponse } from './useStudy';
import type { StudySessionKind, StudySessionLoadOptions } from './useStudySessionLoader';

interface StudyFocusModeLifecycleOptions {
  activeAchievementCompletionRequestRef: MutableRefObject<number | null>;
  activeLessonCohortIdRef: MutableRefObject<string | null>;
  achievementCompletionRequestIdRef: MutableRefObject<number>;
  achievementSessionBootstrapRef: MutableRefObject<AchievementSessionBootstrap | null>;
  achievementSessionStore: StudyAchievementSessionStore | null;
  answeredCardIdsRef: MutableRefObject<Set<string>>;
  autoRefreshEmptySessionRef: MutableRefObject<boolean>;
  canSurfaceAsyncSessionErrorRef: MutableRefObject<boolean>;
  loadSession: (
    kind?: StudySessionKind,
    options?: StudySessionLoadOptions,
    expectedEpoch?: number
  ) => Promise<StudySessionResponse | null>;
  pendingReviewOperationRef: MutableRefObject<PendingStudyReviewOperation | null>;
  queryClient: QueryClient;
  requestGuardRef: MutableRefObject<StudyReviewRequestGuard>;
  requestMotionPermission: () => Promise<boolean>;
  resetStudyAudioAutoplay: () => void;
  resetUndo: () => void;
  runBackgroundTask: ReturnType<typeof useStudyBackgroundTask>;
  sessionEpochRef: MutableRefObject<number>;
  setAchievementCelebrationPresented: Dispatch<SetStateAction<boolean>>;
  setAchievementCompletion: Dispatch<SetStateAction<StudyAchievementSessionCompletion | null>>;
  setAchievementCompletionRefreshPending: Dispatch<SetStateAction<boolean>>;
  setAnsweredCardIds: Dispatch<SetStateAction<string[]>>;
  setCurrentAchievementIndex: Dispatch<SetStateAction<number>>;
  setCurrentIndex: Dispatch<SetStateAction<number>>;
  setEditing: Dispatch<SetStateAction<boolean>>;
  setFocusMode: Dispatch<SetStateAction<boolean>>;
  setLessonPhase: Dispatch<SetStateAction<'preview' | 'quiz' | 'complete'>>;
  setMasteryAnimation: Dispatch<SetStateAction<StudyMasteryAnimation | null>>;
  setPracticeCards: Dispatch<SetStateAction<StudyCardSummary[] | null>>;
  setPracticeInitialCount: Dispatch<SetStateAction<number>>;
  setRevealed: Dispatch<SetStateAction<boolean>>;
  setReviewConflictRecovered: Dispatch<SetStateAction<boolean>>;
  setReviewRetryAvailable: Dispatch<SetStateAction<boolean>>;
  setReviewSubmitPending: Dispatch<SetStateAction<boolean>>;
  setSession: Dispatch<SetStateAction<StudySessionResponse | null>>;
  setSessionError: Dispatch<SetStateAction<string | null>>;
  setSessionKind: Dispatch<SetStateAction<StudySessionKind>>;
  setSessionLoading: Dispatch<SetStateAction<boolean>>;
  setSessionReviewRecords: Dispatch<SetStateAction<StudySessionReviewRecord[]>>;
  setSessionWasEnded: Dispatch<SetStateAction<boolean>>;
  setShowSetDueControls: Dispatch<SetStateAction<boolean>>;
  setUndoPending: Dispatch<SetStateAction<boolean>>;
  startAchievementReviewSession: () => AchievementSessionBootstrap;
  stopAllAudio: () => void;
}

const cancelAchievementBootstrap = (
  context: StudyFocusModeLifecycleOptions,
  bootstrap: AchievementSessionBootstrap | null
) => {
  if (!bootstrap) return;
  Object.assign(bootstrap, { cancelled: true });
  if (context.achievementSessionBootstrapRef.current !== bootstrap) return;
  context.achievementSessionBootstrapRef.current = null;
  context.achievementSessionStore?.cancelCurrentSession();
};

const resetSharedFocusState = (context: StudyFocusModeLifecycleOptions) => {
  context.setMasteryAnimation(null);
  context.setCurrentIndex(0);
  context.setRevealed(false);
  context.setEditing(false);
  context.setUndoPending(false);
  context.autoRefreshEmptySessionRef.current = false;
  context.answeredCardIdsRef.current = new Set();
  context.setAnsweredCardIds([]);
  context.setSessionReviewRecords([]);
  context.setSessionWasEnded(false);
  context.setAchievementCompletion(null);
  context.setCurrentAchievementIndex(0);
  context.setAchievementCelebrationPresented(false);
  context.setPracticeCards(null);
  context.setPracticeInitialCount(0);
};

const prepareFocusEntry = (
  context: StudyFocusModeLifecycleOptions,
  kind: StudySessionKind,
  options: StudySessionLoadOptions
) => {
  const expectedEpoch = context.sessionEpochRef.current + 1;
  context.sessionEpochRef.current = expectedEpoch;
  context.requestGuardRef.current.reset();
  context.stopAllAudio();
  context.resetStudyAudioAutoplay();
  context.resetUndo();
  context.pendingReviewOperationRef.current = null;
  context.achievementCompletionRequestIdRef.current += 1;
  context.activeAchievementCompletionRequestRef.current = null;
  context.setAchievementCompletionRefreshPending(false);
  context.setReviewRetryAvailable(false);
  context.setReviewConflictRecovered(false);
  context.canSurfaceAsyncSessionErrorRef.current = true;
  context.setSession(null);
  context.setSessionLoading(true);
  context.setFocusMode(true);
  context.setSessionKind(kind);
  context.activeLessonCohortIdRef.current =
    kind === 'lessons' ? (options.lessonCohortId ?? null) : null;
  context.setLessonPhase(kind === 'lessons' ? 'preview' : 'quiz');
  resetSharedFocusState(context);
  cancelAchievementBootstrap(context, context.achievementSessionBootstrapRef.current);
  return expectedEpoch;
};

const startAchievementSession = (
  context: StudyFocusModeLifecycleOptions,
  kind: StudySessionKind
) => {
  if (kind === 'reviews') return context.startAchievementReviewSession();
  context.achievementSessionStore?.cancelCurrentSession();
  return null;
};

const enterFocusMode = async (
  context: StudyFocusModeLifecycleOptions,
  kind: StudySessionKind = 'reviews',
  options: StudySessionLoadOptions = {}
) => {
  const expectedEpoch = prepareFocusEntry(context, kind, options);
  const achievementBootstrap = startAchievementSession(context, kind);
  context.runBackgroundTask(() => context.requestMotionPermission(), {
    label: 'Study motion-permission request',
  });
  try {
    const nextSession = await context.loadSession(kind, options, expectedEpoch);
    if (!nextSession) cancelAchievementBootstrap(context, achievementBootstrap);
  } catch {
    cancelAchievementBootstrap(context, achievementBootstrap);
    // loadSession already updates session error state for the dashboard.
  }
};

const exitFocusMode = (context: StudyFocusModeLifecycleOptions) => {
  context.sessionEpochRef.current += 1;
  cancelAchievementBootstrap(context, context.achievementSessionBootstrapRef.current);
  context.achievementCompletionRequestIdRef.current += 1;
  context.activeAchievementCompletionRequestRef.current = null;
  context.setAchievementCompletionRefreshPending(false);
  context.achievementSessionStore?.cancelCurrentSession();
  context.stopAllAudio();
  context.resetUndo();
  context.canSurfaceAsyncSessionErrorRef.current = false;
  context.setFocusMode(false);
  context.setSessionKind('reviews');
  context.setLessonPhase('preview');
  context.setSession(null);
  context.setSessionLoading(false);
  context.setSessionError(null);
  context.setReviewConflictRecovered(false);
  context.setShowSetDueControls(false);
  context.activeLessonCohortIdRef.current = null;
  context.requestGuardRef.current.reset();
  context.setReviewSubmitPending(false);
  context.pendingReviewOperationRef.current = null;
  context.setReviewRetryAvailable(false);
  resetSharedFocusState(context);
  context.runBackgroundTask(
    () => context.queryClient.invalidateQueries({ queryKey: ['study', 'overview'] }),
    { label: 'Study overview refresh' }
  );
};

const useStudyFocusModeLifecycle = (options: StudyFocusModeLifecycleOptions) => {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  return {
    enterFocusMode: useCallback(
      (kind?: StudySessionKind, loadOptions?: StudySessionLoadOptions) =>
        enterFocusMode(optionsRef.current, kind, loadOptions),
      []
    ),
    exitFocusMode: useCallback(() => exitFocusMode(optionsRef.current), []),
  };
};

export default useStudyFocusModeLifecycle;
