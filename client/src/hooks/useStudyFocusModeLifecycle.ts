import type { QueryClient } from '@tanstack/react-query';
import {
  useCallback,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';

import type { StudyCardSummary } from '@languageflow/shared/src/types';

import type { StudySessionReviewRecord } from '../components/study/studySessionWrapUpModel';
import type useStudyBackgroundTask from './useStudyBackgroundTask';

import type { StudyReviewRequestGuard } from './studyReviewRequestGuard';
import type { PendingStudyReviewOperation } from './studyReviewSubmissionFlow';
import type { StudyMasteryAnimation } from './studyReviewSubmissionRules';
import type { StudySessionResponse } from './useStudy';
import type { StudySessionKind, StudySessionLoadOptions } from './useStudySessionLoader';

interface StudyFocusModeLifecycleOptions {
  activeLessonCohortIdRef: MutableRefObject<string | null>;
  activePileIdRef: MutableRefObject<string | null>;
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
  setAnsweredCardIds: Dispatch<SetStateAction<string[]>>;
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
  stopAllAudio: () => void;
}

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
  context.setReviewRetryAvailable(false);
  context.setReviewConflictRecovered(false);
  context.canSurfaceAsyncSessionErrorRef.current = true;
  context.setSession(null);
  context.setSessionLoading(true);
  context.setFocusMode(true);
  context.setSessionKind(kind);
  context.activePileIdRef.current = kind === 'lessons' ? (options.pileId ?? null) : null;
  context.activeLessonCohortIdRef.current =
    kind === 'lessons' ? (options.lessonCohortId ?? null) : null;
  context.setLessonPhase(kind === 'lessons' ? 'preview' : 'quiz');
  resetSharedFocusState(context);
  return expectedEpoch;
};

const enterFocusMode = async (
  context: StudyFocusModeLifecycleOptions,
  kind: StudySessionKind = 'reviews',
  options: StudySessionLoadOptions = {}
) => {
  const expectedEpoch = prepareFocusEntry(context, kind, options);
  context.runBackgroundTask(() => context.requestMotionPermission(), {
    label: 'Study motion-permission request',
  });
  try {
    await context.loadSession(kind, options, expectedEpoch);
  } catch {
    // loadSession already updates session error state for the dashboard.
  }
};

const exitFocusMode = (context: StudyFocusModeLifecycleOptions) => {
  context.sessionEpochRef.current += 1;
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
  context.activePileIdRef.current = null;
  context.requestGuardRef.current.reset();
  context.setReviewSubmitPending(false);
  context.pendingReviewOperationRef.current = null;
  context.setReviewRetryAvailable(false);
  resetSharedFocusState(context);
  context.runBackgroundTask(
    () =>
      Promise.all(
        ['overview', 'piles'].map((scope) =>
          context.queryClient.invalidateQueries({ queryKey: ['study', scope] })
        )
      ),
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
