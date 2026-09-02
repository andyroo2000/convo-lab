import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';

import type {
  StudyAchievementSessionCompletion,
  StudyAchievementSessionStore,
} from '../components/study/studyAchievementSessionModel';

interface StudyReviewWrapUpActionsOptions {
  achievementCompletion: StudyAchievementSessionCompletion | null;
  achievementCompletionRefreshPending: boolean;
  achievementSessionStore: StudyAchievementSessionStore | null;
  completionAchievementCount: number;
  currentAchievementIndex: number;
  exitFocusMode: () => void;
  exitPracticeMode: () => void;
  practiceMode: boolean;
  prepareSessionCompletion: () => void;
  sessionKind: 'reviews' | 'lessons';
  sessionReviewRecordCount: number;
  setAchievementCelebrationPresented: Dispatch<SetStateAction<boolean>>;
  setCurrentAchievementIndex: Dispatch<SetStateAction<number>>;
}

const endReviewSession = (options: StudyReviewWrapUpActionsOptions) => {
  if (options.practiceMode) {
    options.exitPracticeMode();
    return;
  }
  if (options.sessionKind === 'lessons') {
    options.exitFocusMode();
    return;
  }
  if (options.sessionReviewRecordCount === 0) {
    options.achievementSessionStore?.cancelCurrentSession();
    options.exitFocusMode();
    return;
  }
  options.prepareSessionCompletion();
};

const advanceAchievement = (options: StudyReviewWrapUpActionsOptions) => {
  const { achievementCompletion } = options;
  if (!achievementCompletion) return;

  if (options.currentAchievementIndex + 1 < options.completionAchievementCount) {
    options.setCurrentAchievementIndex((current) => current + 1);
    return;
  }

  options.achievementSessionStore?.markCelebrationPresented(achievementCompletion.id);
  options.setAchievementCelebrationPresented(true);
  if (achievementCompletion.records.length === 0) options.exitFocusMode();
};

const finishReviewSession = (options: StudyReviewWrapUpActionsOptions) => {
  if (options.achievementCompletionRefreshPending) return;
  if (options.achievementCompletion) {
    options.achievementSessionStore?.consumeCompletion(options.achievementCompletion.id);
  }
  options.exitFocusMode();
};

const useStudyReviewWrapUpActions = (options: StudyReviewWrapUpActionsOptions) => {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  return {
    advanceAchievement: useCallback(() => advanceAchievement(optionsRef.current), []),
    endReviewSession: useCallback(() => endReviewSession(optionsRef.current), []),
    finishReviewSession: useCallback(() => finishReviewSession(optionsRef.current), []),
  };
};

export default useStudyReviewWrapUpActions;
