import { useCallback, useEffect, type Dispatch, type SetStateAction } from 'react';
import type { StudyMasteryAnimation } from './studyReviewSubmissionRules';

interface StudySessionCompletionOptions {
  masteryAnimation: StudyMasteryAnimation | null;
  reviewQueueExhausted: boolean;
  setSessionWasEnded: Dispatch<SetStateAction<boolean>>;
}

const useStudySessionCompletion = ({
  masteryAnimation,
  reviewQueueExhausted,
  setSessionWasEnded,
}: StudySessionCompletionOptions) => {
  const prepareCompletion = useCallback(() => setSessionWasEnded(true), [setSessionWasEnded]);
  useEffect(() => {
    if (reviewQueueExhausted && !masteryAnimation) prepareCompletion();
  }, [masteryAnimation, reviewQueueExhausted, prepareCompletion]);
  return prepareCompletion;
};
export default useStudySessionCompletion;
