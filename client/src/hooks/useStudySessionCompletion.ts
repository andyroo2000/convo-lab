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
  StudyAchievementRefresh,
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

interface CompletionRefreshRequest {
  completion: StudyAchievementSessionCompletion | null;
  expectedEpoch: number;
  requestId: number;
  refresh: StudyAchievementRefresh | null;
}

const applyRefreshedCompletion = (
  options: StudySessionCompletionOptions,
  request: CompletionRefreshRequest,
  awards: AchievementAward[]
) => {
  if (!request.refresh) return;
  options.achievementSessionStore?.completeDeferredRefresh(request.refresh, awards);
  if (!isCurrentCompletionRequest(options, request.expectedEpoch, request.requestId)) return;
  const completion = options.achievementSessionStore?.completeCurrentRefresh(
    request.refresh,
    awards
  );
  if (!completion || completion.id !== request.completion?.id) return;
  applyCompletion(options, completion);
};

const refreshCompletion = async (
  options: StudySessionCompletionOptions,
  request: CompletionRefreshRequest
) => {
  try {
    const { progress } = await options.syncAchievements(true, true);
    applyRefreshedCompletion(options, request, progress.awards);
  } catch {
    // Failed evaluations remain persisted for recovery on the next Study visit.
  } finally {
    if (isCurrentCompletionRequest(options, request.expectedEpoch, request.requestId)) {
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
  const refresh = completion
    ? (options.achievementSessionStore?.beginCompletionRefresh(completion) ?? null)
    : null;

  const expectedEpoch = options.sessionEpochRef.current;
  options.runBackgroundTask(
    refreshCompletion(options, { completion, expectedEpoch, requestId, refresh }),
    {
      label: 'Study achievement completion refresh',
    }
  );
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
