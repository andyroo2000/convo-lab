import { useCallback, useRef } from 'react';

interface StudyReviewWrapUpActionsOptions {
  exitFocusMode: () => void;
  exitPracticeMode: () => void;
  practiceMode: boolean;
  prepareSessionCompletion: () => void;
  sessionKind: 'reviews' | 'lessons';
  sessionReviewRecordCount: number;
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
    options.exitFocusMode();
    return;
  }
  options.prepareSessionCompletion();
};

const finishReviewSession = (options: StudyReviewWrapUpActionsOptions) => {
  options.exitFocusMode();
};

const useStudyReviewWrapUpActions = (options: StudyReviewWrapUpActionsOptions) => {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  return {
    endReviewSession: useCallback(() => endReviewSession(optionsRef.current), []),
    finishReviewSession: useCallback(() => finishReviewSession(optionsRef.current), []),
  };
};

export default useStudyReviewWrapUpActions;
