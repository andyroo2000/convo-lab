import type { StudyOverview } from '@languageflow/shared/src/types';
import { describe, expect, it, vi } from 'vitest';

import { createStudyReviewRequestGuard } from '../studyReviewRequestGuard';
import { submitStudyReviewUndo, type StudyReviewUndoContext } from '../studyReviewUndoFlow';
import type { StudyUndoAction, StudyUndoSnapshot } from '../studyReviewSessionUtils';

const overview = { dueCount: 1, failedCount: 0 } as StudyOverview;
const snapshot: StudyUndoSnapshot = {
  answeredCardIds: ['card-1'],
  currentIndex: 0,
  overview,
  revealed: true,
  session: null,
};
const gradeAction: StudyUndoAction = {
  kind: 'grade',
  reviewLogId: 'review-1',
  snapshot,
};

const makeContext = (overrides: Partial<StudyReviewUndoContext> = {}): StudyReviewUndoContext => ({
  achievementAwards: [],
  achievementCompletion: null,
  achievementCompletionRequestIdRef: { current: 0 },
  achievementSessionStore: null,
  activeAchievementCompletionRequestRef: { current: null },
  blocked: false,
  popUndo: vi.fn().mockReturnValue(gradeAction),
  pushUndo: vi.fn(),
  requestGuardRef: { current: createStudyReviewRequestGuard() },
  restoreUndoSnapshot: vi.fn(),
  sessionEpochRef: { current: 0 },
  setAchievementCelebrationPresented: vi.fn(),
  setAchievementCompletion: vi.fn(),
  setAchievementCompletionRefreshPending: vi.fn(),
  setCurrentAchievementIndex: vi.fn(),
  setSessionError: vi.fn(),
  setSessionReviewRecords: vi.fn(),
  setSessionWasEnded: vi.fn(),
  setUndoPending: vi.fn(),
  stopAllAudio: vi.fn(),
  syncAchievements: vi.fn().mockResolvedValue(undefined),
  syncOverview: vi.fn(),
  undoAchievementReview: vi.fn(),
  undoReview: vi.fn().mockResolvedValue({ overview }),
  ...overrides,
});

describe('submitStudyReviewUndo', () => {
  it('leaves the undo stack untouched while review activity blocks undo', async () => {
    const context = makeContext({ blocked: true });

    await submitStudyReviewUndo(context);

    expect(context.popUndo).not.toHaveBeenCalled();
    expect(context.undoReview).not.toHaveBeenCalled();
  });

  it('restores local reveal actions without calling the review API', async () => {
    const action: StudyUndoAction = { kind: 'reveal', snapshot };
    const context = makeContext({ popUndo: vi.fn().mockReturnValue(action) });

    await submitStudyReviewUndo(context);

    expect(context.stopAllAudio).toHaveBeenCalledOnce();
    expect(context.restoreUndoSnapshot).toHaveBeenCalledWith(snapshot);
    expect(context.undoReview).not.toHaveBeenCalled();
  });

  it('commits a persisted grade undo and refreshes achievements', async () => {
    const context = makeContext();

    await submitStudyReviewUndo(context);

    expect(context.undoReview).toHaveBeenCalledWith('review-1');
    expect(context.restoreUndoSnapshot).toHaveBeenCalledWith(snapshot);
    expect(context.syncOverview).toHaveBeenCalledWith(overview);
    expect(context.undoAchievementReview).toHaveBeenCalledWith('review-1');
    expect(context.syncAchievements).toHaveBeenCalledWith(true, true);
    expect(context.setUndoPending).toHaveBeenNthCalledWith(1, true);
    expect(context.setUndoPending).toHaveBeenLastCalledWith(false);
  });

  it('returns a persisted action to the stack when the request guard is busy', async () => {
    const requestGuard = createStudyReviewRequestGuard();
    requestGuard.acquire('review', 'review-in-flight');
    const context = makeContext({ requestGuardRef: { current: requestGuard } });

    await submitStudyReviewUndo(context);

    expect(context.pushUndo).toHaveBeenCalledWith(gradeAction);
    expect(context.undoReview).not.toHaveBeenCalled();
    expect(context.setUndoPending).not.toHaveBeenCalled();
  });

  it.each([
    ['successful', false],
    ['failed', true],
  ])('ignores a %s undo response from a stale session epoch', async (_label, rejects) => {
    let resolveUndo!: (result: { overview: StudyOverview }) => void;
    let rejectUndo!: (error: Error) => void;
    const deferredUndo = new Promise<{ overview: StudyOverview }>((resolve, reject) => {
      resolveUndo = resolve;
      rejectUndo = reject;
    });
    const context = makeContext({ undoReview: vi.fn().mockReturnValue(deferredUndo) });

    const submission = submitStudyReviewUndo(context);
    context.sessionEpochRef.current += 1;
    if (rejects) rejectUndo(new Error('Late failure'));
    else resolveUndo({ overview });
    await submission;

    expect(context.restoreUndoSnapshot).not.toHaveBeenCalled();
    expect(context.pushUndo).not.toHaveBeenCalled();
    expect(context.setSessionError).not.toHaveBeenCalled();
    expect(context.setUndoPending).not.toHaveBeenCalledWith(false);
  });

  it('restores a failed persisted undo to the stack', async () => {
    const error = new Error('Undo failed');
    const context = makeContext({ undoReview: vi.fn().mockRejectedValue(error) });

    await submitStudyReviewUndo(context);

    expect(context.pushUndo).toHaveBeenCalledWith(gradeAction);
    expect(context.setSessionError).toHaveBeenCalledWith('Undo failed');
    expect(context.restoreUndoSnapshot).not.toHaveBeenCalled();
    expect(context.setUndoPending).toHaveBeenLastCalledWith(false);
  });
});
