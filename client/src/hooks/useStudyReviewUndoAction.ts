import {
  useCallback,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import type { StudyMasteryAnimation } from './studyReviewSubmissionRules';
import type { PendingStudyReviewOperation } from './studyReviewSubmissionFlow';
import { cloneStudySnapshot, type StudyUndoSnapshot } from './studyReviewSessionUtils';
import { submitStudyReviewUndo, type StudyReviewUndoContext } from './studyReviewUndoFlow';
import { undoStudyReview, type StudySessionResponse } from './useStudy';

type UndoSubmissionOptions = Omit<
  StudyReviewUndoContext,
  'blocked' | 'restoreUndoSnapshot' | 'undoReview'
>;

interface StudyReviewUndoActionOptions extends UndoSubmissionOptions {
  answeredCardIdsRef: MutableRefObject<Set<string>>;
  cardActionPending: boolean;
  editing: boolean;
  masteryAnimation: StudyMasteryAnimation | null;
  pendingReviewOperationRef: MutableRefObject<PendingStudyReviewOperation | null>;
  reviewPending: boolean;
  sessionLoading: boolean;
  setAnsweredCardIds: Dispatch<SetStateAction<string[]>>;
  setCurrentIndex: Dispatch<SetStateAction<number>>;
  setRevealed: Dispatch<SetStateAction<boolean>>;
  setSession: Dispatch<SetStateAction<StudySessionResponse | null>>;
  setShowSetDueControls: Dispatch<SetStateAction<boolean>>;
  undoPending: boolean;
}

const restoreUndoSnapshot = (
  options: StudyReviewUndoActionOptions,
  snapshot: StudyUndoSnapshot
) => {
  const { answeredCardIdsRef } = options;

  options.stopAllAudio();
  const restored = cloneStudySnapshot(snapshot);
  options.setSession(restored.session);
  if (restored.overview) {
    options.syncOverview(restored.overview);
  }
  options.setCurrentIndex(restored.currentIndex);
  options.setRevealed(restored.revealed);
  answeredCardIdsRef.current = new Set(restored.answeredCardIds);
  options.setAnsweredCardIds(restored.answeredCardIds);
  options.setSessionError(null);
  options.setShowSetDueControls(false);
};

const hasPendingUndoRequest = (options: StudyReviewUndoActionOptions) => {
  if (options.undoPending) return true;
  if (options.pendingReviewOperationRef.current) return true;
  return options.requestGuardRef.current.isBusy();
};

const hasPendingStudyMutation = (options: StudyReviewUndoActionOptions) => {
  if (options.reviewPending) return true;
  if (options.cardActionPending) return true;
  return options.sessionLoading;
};

const hasBlockedUndoInteraction = (options: StudyReviewUndoActionOptions) => {
  if (options.editing) return true;
  return options.masteryAnimation !== null;
};

const isUndoBlocked = (options: StudyReviewUndoActionOptions) =>
  hasPendingUndoRequest(options) ||
  hasPendingStudyMutation(options) ||
  hasBlockedUndoInteraction(options);

const useStudyReviewUndoAction = (options: StudyReviewUndoActionOptions) => {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  return useCallback(async () => {
    const currentOptions = optionsRef.current;
    await submitStudyReviewUndo({
      ...currentOptions,
      blocked: isUndoBlocked(currentOptions),
      restoreUndoSnapshot: (snapshot) => restoreUndoSnapshot(currentOptions, snapshot),
      undoReview: undoStudyReview,
    });
  }, []);
};

export default useStudyReviewUndoAction;
