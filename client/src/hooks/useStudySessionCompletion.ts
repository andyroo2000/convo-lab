import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';

import type { AchievementAward } from '../components/study/achievementModel';
import type {
  StudyAchievementSessionCompletion,
  StudyAchievementSessionStore,
} from '../components/study/studyAchievementSessionModel';
import type useStudyBackgroundTask from './useStudyBackgroundTask';
import type { StudyAchievementSyncResult } from './useStudyAchievementSync';
import type { StudyMasteryAnimation } from './studyReviewSubmissionRules';

interface StudySessionCompletionOptions {
  achievementAwards: AchievementAward[];
  achievementCompletion: StudyAchievementSessionCompletion | null;
  achievementCompletionRequestIdRef: MutableRefObject<number>;
  achievementSessionStore: StudyAchievementSessionStore | null;
  activeAchievementCompletionRequestRef: MutableRefObject<number | null>;
  masteryAnimation: StudyMasteryAnimation | null;
  reviewQueueExhausted: boolean;
  runBackgroundTask: ReturnType<typeof useStudyBackgroundTask>;
  sessionEpochRef: MutableRefObject<number>;
  setAchievementCelebrationPresented: Dispatch<SetStateAction<boolean>>;
  setAchievementCompletion: Dispatch<SetStateAction<StudyAchievementSessionCompletion | null>>;
  setAchievementCompletionRefreshPending: Dispatch<SetStateAction<boolean>>;
  setCurrentAchievementIndex: Dispatch<SetStateAction<number>>;
  setSessionWasEnded: Dispatch<SetStateAction<boolean>>;
  syncAchievements: (evaluate?: boolean, force?: boolean) => Promise<StudyAchievementSyncResult>;
}

const applyCompletion = (
  options: StudySessionCompletionOptions,
  completion: StudyAchievementSessionCompletion | null
) => {
  options.setAchievementCompletion(completion);
  options.setCurrentAchievementIndex(0);
  options.setAchievementCelebrationPresented(completion?.celebrationPresented ?? true);
};

const isCurrentCompletionRequest = (
  options: StudySessionCompletionOptions,
  expectedEpoch: number,
  requestId: number
) =>
  options.sessionEpochRef.current === expectedEpoch &&
  options.activeAchievementCompletionRequestRef.current === requestId;

const refreshCompletion = async (
  options: StudySessionCompletionOptions,
  completion: StudyAchievementSessionCompletion | null,
  expectedEpoch: number,
  requestId: number
) => {
  try {
    const refreshedAwards = (await options.syncAchievements(true, true)).progress.awards;
    if (!isCurrentCompletionRequest(options, expectedEpoch, requestId)) return;

    const refreshedCompletion =
      options.achievementSessionStore?.prepareCurrentSessionCompletion(refreshedAwards) ?? null;
    if (!refreshedCompletion || refreshedCompletion.id !== completion?.id) return;
    applyCompletion(options, refreshedCompletion);
  } catch {
    // The wrap-up remains available offline. A later launch can recover a new award.
  } finally {
    if (isCurrentCompletionRequest(options, expectedEpoch, requestId)) {
      const { activeAchievementCompletionRequestRef } = options;
      activeAchievementCompletionRequestRef.current = null;
      options.setAchievementCompletionRefreshPending(false);
    }
  }
};

const prepareSessionCompletion = (options: StudySessionCompletionOptions) => {
  const { achievementCompletionRequestIdRef, activeAchievementCompletionRequestRef } = options;
  if (activeAchievementCompletionRequestRef.current !== null) return;
  const requestId = achievementCompletionRequestIdRef.current + 1;
  achievementCompletionRequestIdRef.current = requestId;
  activeAchievementCompletionRequestRef.current = requestId;
  options.setAchievementCompletionRefreshPending(true);
  options.setSessionWasEnded(true);

  const completion =
    options.achievementSessionStore?.prepareCurrentSessionCompletion(options.achievementAwards) ??
    null;
  applyCompletion(options, completion);

  const expectedEpoch = options.sessionEpochRef.current;
  options.runBackgroundTask(refreshCompletion(options, completion, expectedEpoch, requestId), {
    label: 'Study achievement completion refresh',
  });
};

const isAutomaticCompletionBlocked = (options: StudySessionCompletionOptions) =>
  [
    !options.reviewQueueExhausted,
    Boolean(options.achievementCompletion),
    options.masteryAnimation !== null,
  ].some(Boolean);

const useStudySessionCompletion = (options: StudySessionCompletionOptions) => {
  // Keep the callback stable so award refreshes cannot retrigger automatic completion.
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const prepareCompletion = useCallback(() => prepareSessionCompletion(optionsRef.current), []);
  const automaticCompletionBlocked = isAutomaticCompletionBlocked(options);

  useEffect(() => {
    if (automaticCompletionBlocked) return;
    prepareCompletion();
  }, [automaticCompletionBlocked, prepareCompletion]);

  return prepareCompletion;
};

export default useStudySessionCompletion;
