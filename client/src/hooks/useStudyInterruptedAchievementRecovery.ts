import {
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';

import {
  StudyAchievementSessionStore,
  type StudyAchievementSessionCompletion,
} from '../components/study/studyAchievementSessionModel';
import type { StudySessionReviewRecord } from '../components/study/studySessionWrapUpModel';
import type { StudyMasteryAnimation } from './studyReviewSubmissionRules';
import type { StudySessionResponse } from './useStudy';
import type { StudyAchievementSyncResult } from './useStudyAchievementSync';

interface StudyInterruptedAchievementRecoveryOptions {
  achievementSessionStore: StudyAchievementSessionStore | null;
  canSurfaceAsyncSessionErrorRef: MutableRefObject<boolean>;
  sessionEpochRef: MutableRefObject<number>;
  setAchievementCelebrationPresented: Dispatch<SetStateAction<boolean>>;
  setAchievementCompletion: Dispatch<SetStateAction<StudyAchievementSessionCompletion | null>>;
  setCurrentAchievementIndex: Dispatch<SetStateAction<number>>;
  setCurrentIndex: Dispatch<SetStateAction<number>>;
  setEditing: Dispatch<SetStateAction<boolean>>;
  setFocusMode: Dispatch<SetStateAction<boolean>>;
  setLessonPhase: Dispatch<SetStateAction<'preview' | 'quiz' | 'complete'>>;
  setMasteryAnimation: Dispatch<SetStateAction<StudyMasteryAnimation | null>>;
  setRevealed: Dispatch<SetStateAction<boolean>>;
  setReviewConflictRecovered: Dispatch<SetStateAction<boolean>>;
  setSession: Dispatch<SetStateAction<StudySessionResponse | null>>;
  setSessionError: Dispatch<SetStateAction<string | null>>;
  setSessionKind: Dispatch<SetStateAction<'reviews' | 'lessons'>>;
  setSessionLoading: Dispatch<SetStateAction<boolean>>;
  setSessionReviewRecords: Dispatch<SetStateAction<StudySessionReviewRecord[]>>;
  setSessionWasEnded: Dispatch<SetStateAction<boolean>>;
  setShowSetDueControls: Dispatch<SetStateAction<boolean>>;
  syncAchievements: () => Promise<StudyAchievementSyncResult>;
}

const recoverInterruptedAchievement = async (
  options: StudyInterruptedAchievementRecoveryOptions,
  expectedEpoch: number,
  isCancelled: () => boolean
) => {
  const { canSurfaceAsyncSessionErrorRef, sessionEpochRef } = options;

  try {
    const { progress } = await options.syncAchievements();
    if (isCancelled() || sessionEpochRef.current !== expectedEpoch) return;
    const restoredCompletion = options.achievementSessionStore?.prepareInterruptedCompletion(
      progress.awards
    );
    if (!restoredCompletion) return;
    if (isCancelled() || sessionEpochRef.current !== expectedEpoch) return;

    sessionEpochRef.current += 1;
    canSurfaceAsyncSessionErrorRef.current = false;
    options.setFocusMode(true);
    options.setSessionKind('reviews');
    options.setLessonPhase('quiz');
    options.setSession(null);
    options.setSessionLoading(false);
    options.setSessionError(null);
    options.setReviewConflictRecovered(false);
    options.setCurrentIndex(0);
    options.setRevealed(false);
    options.setEditing(false);
    options.setShowSetDueControls(false);
    options.setMasteryAnimation(null);
    options.setSessionReviewRecords(restoredCompletion.records);
    options.setSessionWasEnded(true);
    options.setAchievementCompletion(restoredCompletion);
    options.setCurrentAchievementIndex(0);
    options.setAchievementCelebrationPresented(restoredCompletion.celebrationPresented);
  } catch {
    // Achievement recovery is best-effort and must not block study startup.
  }
};

const useStudyInterruptedAchievementRecovery = (
  options: StudyInterruptedAchievementRecoveryOptions
) => {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const { achievementSessionStore, syncAchievements } = options;

  useEffect(() => {
    if (!achievementSessionStore) return undefined;
    let cancelled = false;
    const expectedEpoch = optionsRef.current.sessionEpochRef.current;

    recoverInterruptedAchievement(optionsRef.current, expectedEpoch, () => cancelled).catch(
      () => {}
    );

    return () => {
      cancelled = true;
    };
  }, [achievementSessionStore, syncAchievements]);
};

export default useStudyInterruptedAchievementRecovery;
