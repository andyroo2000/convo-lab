import type { StudyOverview } from '@languageflow/shared/src/types';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type { AchievementAward } from '../components/study/achievementModel';
import type {
  StudyAchievementSessionCompletion,
  StudyAchievementSessionStore,
} from '../components/study/studyAchievementSessionModel';
import type { StudySessionReviewRecord } from '../components/study/studySessionWrapUpModel';
import type { StudyReviewRequestGuard } from './studyReviewRequestGuard';
import type { StudyUndoAction, StudyUndoSnapshot } from './studyReviewSessionUtils';

interface StudyReviewUndoResult {
  overview: StudyOverview;
}

export interface StudyReviewUndoContext {
  achievementAwards: AchievementAward[];
  achievementCompletion: StudyAchievementSessionCompletion | null;
  achievementCompletionRequestIdRef: MutableRefObject<number>;
  achievementSessionStore: StudyAchievementSessionStore | null;
  activeAchievementCompletionRequestRef: MutableRefObject<number | null>;
  blocked: boolean;
  popUndo: () => StudyUndoAction | undefined;
  pushUndo: (action: StudyUndoAction) => void;
  requestGuardRef: MutableRefObject<StudyReviewRequestGuard>;
  restoreUndoSnapshot: (snapshot: StudyUndoSnapshot) => void;
  sessionEpochRef: MutableRefObject<number>;
  setAchievementCelebrationPresented: Dispatch<SetStateAction<boolean>>;
  setAchievementCompletion: Dispatch<SetStateAction<StudyAchievementSessionCompletion | null>>;
  setAchievementCompletionRefreshPending: Dispatch<SetStateAction<boolean>>;
  setCurrentAchievementIndex: Dispatch<SetStateAction<number>>;
  setSessionError: Dispatch<SetStateAction<string | null>>;
  setSessionReviewRecords: Dispatch<SetStateAction<StudySessionReviewRecord[]>>;
  setSessionWasEnded: Dispatch<SetStateAction<boolean>>;
  setUndoPending: Dispatch<SetStateAction<boolean>>;
  stopAllAudio: () => void;
  syncAchievements: (evaluate?: boolean, force?: boolean) => Promise<unknown>;
  syncOverview: (overview: StudyOverview) => void;
  undoAchievementReview: (reviewLogId: string) => void;
  undoReview: (reviewLogId: string) => Promise<StudyReviewUndoResult>;
}

const isCurrentSession = (context: StudyReviewUndoContext, expectedEpoch: number) =>
  context.sessionEpochRef.current === expectedEpoch;

const reopenAchievementCompletion = (context: StudyReviewUndoContext) => {
  if (!context.achievementCompletion) return;
  context.achievementCompletionRequestIdRef.current += 1;
  context.activeAchievementCompletionRequestRef.current = null;
  context.setAchievementCompletionRefreshPending(false);
  context.achievementSessionStore?.reopenCompletion(
    context.achievementCompletion.id,
    context.achievementAwards
  );
  context.setSessionWasEnded(false);
  context.setAchievementCompletion(null);
  context.setCurrentAchievementIndex(0);
  context.setAchievementCelebrationPresented(false);
};

const applyPersistedUndo = (
  context: StudyReviewUndoContext,
  action: Extract<StudyUndoAction, { kind: 'grade' }>,
  result: StudyReviewUndoResult
) => {
  context.restoreUndoSnapshot(action.snapshot);
  context.syncOverview(result.overview);
  context.setSessionReviewRecords((current) =>
    current.filter((record) => record.id !== action.reviewLogId)
  );
  reopenAchievementCompletion(context);
  context.undoAchievementReview(action.reviewLogId);
};

const refreshAchievementsAfterUndo = async (context: StudyReviewUndoContext) => {
  try {
    await context.syncAchievements(true, true);
  } catch {
    // The successful review undo is authoritative; achievement refresh retries later.
  }
};

const runPersistedUndo = async (
  context: StudyReviewUndoContext,
  action: Extract<StudyUndoAction, { kind: 'grade' }>,
  expectedEpoch: number
) => {
  const requestToken = context.requestGuardRef.current.acquire('undo', action.reviewLogId);
  if (!requestToken) {
    context.pushUndo(action);
    return;
  }
  context.setUndoPending(true);
  try {
    const result = await context.undoReview(action.reviewLogId);
    if (!isCurrentSession(context, expectedEpoch)) return;
    applyPersistedUndo(context, action, result);
    await refreshAchievementsAfterUndo(context);
  } catch (error) {
    if (!isCurrentSession(context, expectedEpoch)) return;
    context.pushUndo(action);
    context.setSessionError(
      error instanceof Error ? error.message : 'Unable to undo study action.'
    );
  } finally {
    context.requestGuardRef.current.release(requestToken);
    if (isCurrentSession(context, expectedEpoch)) {
      context.setUndoPending(false);
    }
  }
};

export const submitStudyReviewUndo = async (context: StudyReviewUndoContext) => {
  if (context.blocked) return;
  const action = context.popUndo();
  if (!action) return;
  const expectedEpoch = context.sessionEpochRef.current;
  context.stopAllAudio();

  if (action.kind !== 'grade') {
    context.restoreUndoSnapshot(action.snapshot);
    return;
  }
  await runPersistedUndo(context, action, expectedEpoch);
};
