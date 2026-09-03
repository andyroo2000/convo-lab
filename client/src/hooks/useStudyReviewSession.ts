import buildStudyReviewSessionResult from './studyReviewSessionResult';
import useStudyReviewSessionActions from './useStudyReviewSessionActions';
import useStudyReviewSessionCore from './useStudyReviewSessionCore';
import useStudyReviewSessionInteractions from './useStudyReviewSessionInteractions';
import useStudyReviewSessionLifecycle from './useStudyReviewSessionLifecycle';

const useStudyReviewSession = () => {
  const core = useStudyReviewSessionCore();
  const interactions = useStudyReviewSessionInteractions(core);
  const actions = useStudyReviewSessionActions(core, interactions);
  const lifecycle = useStudyReviewSessionLifecycle(core, interactions, actions);
  return buildStudyReviewSessionResult(core, interactions, actions, lifecycle);
};

export default useStudyReviewSession;
