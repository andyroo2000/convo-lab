import { QueryClient } from '@tanstack/react-query';
import type {
  StudyCardSummary,
  StudyOverview,
  StudyReviewResult,
} from '@languageflow/shared/src/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { JsonRequestError } from '../../lib/apiClient';
import {
  submitStudyReviewOperation,
  type PendingStudyReviewOperation,
  type StudyReviewSubmissionContext,
} from '../studyReviewSubmissionFlow';

const card = {
  id: 'card-1',
  masteryLevel: 'apprentice',
  answer: { expression: '猫' },
  prompt: { cueText: 'cat' },
  state: { dueAt: null, failedAt: null, queueState: 'new' },
} as StudyCardSummary;

const overview = { dueCount: 0, failedCount: 0 } as StudyOverview;

const operation: PendingStudyReviewOperation = {
  request: {
    cardId: card.id,
    clientReviewId: 'review-1',
    durationMs: 750,
    grade: 'good',
    reviewedAt: '2026-09-02T12:00:00.000Z',
  },
  undoSnapshot: {
    answeredCardIds: [],
    currentIndex: 0,
    overview,
    revealed: true,
    session: { cards: [card], overview },
  },
};

const reviewResult: StudyReviewResult = {
  card: null,
  overview,
  reviewLogId: 'review-1',
};

const makeContext = (
  overrides: Partial<StudyReviewSubmissionContext> = {}
): StudyReviewSubmissionContext => ({
  activeLessonCohortIdRef: { current: null },
  achievementAwards: [],
  achievementSessionBootstrapRef: { current: null },
  achievementSessionStore: null,
  answeredCardIdsRef: { current: new Set() },
  applyReviewResultToSession: vi.fn(),
  autoRefreshEmptySessionRef: { current: false },
  cards: [card],
  currentCard: card,
  expectedEpoch: 0,
  fallbackDurationMs: 500,
  grade: 'good',
  loadSession: vi.fn().mockResolvedValue(null),
  operation,
  pendingReviewOperationRef: { current: operation },
  pushUndo: vi.fn(),
  queryClient: new QueryClient(),
  recordAchievementReview: vi.fn(),
  requestGuardRef: {
    current: {
      acquire: vi.fn(),
      isBusy: vi.fn().mockReturnValue(false),
      release: vi.fn().mockReturnValue(true),
      reset: vi.fn(),
    },
  },
  requestToken: Symbol('review'),
  resetStudyAudioAutoplayForCard: vi.fn(),
  resetUndo: vi.fn(),
  sessionEpochRef: { current: 0 },
  sessionKind: 'reviews',
  setAchievementCelebrationPresented: vi.fn(),
  setAchievementCompletion: vi.fn(),
  setAnsweredCardIds: vi.fn(),
  setCurrentAchievementIndex: vi.fn(),
  setCurrentIndex: vi.fn(),
  setEditing: vi.fn(),
  setLessonPhase: vi.fn(),
  setMasteryAnimation: vi.fn(),
  setRevealed: vi.fn(),
  setReviewConflictRecovered: vi.fn(),
  setReviewRetryAvailable: vi.fn(),
  setReviewSubmitPending: vi.fn(),
  setSession: vi.fn(),
  setSessionError: vi.fn(),
  setSessionReviewRecords: vi.fn(),
  setSessionWasEnded: vi.fn(),
  setShowSetDueControls: vi.fn(),
  stopAllAudio: vi.fn(),
  submitReview: vi.fn().mockResolvedValue(reviewResult),
  syncAchievements: vi.fn(),
  syncOverview: vi.fn(),
  ...overrides,
});

describe('submitStudyReviewOperation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('commits a current review result and releases the request guard', async () => {
    const context = makeContext();

    await submitStudyReviewOperation(context);

    expect(context.pendingReviewOperationRef.current).toBeNull();
    expect(context.answeredCardIdsRef.current).toContain(card.id);
    expect(context.pushUndo).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'grade', reviewLogId: 'review-1' })
    );
    expect(context.recordAchievementReview).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'review-1', durationMs: 750 })
    );
    expect(context.setReviewSubmitPending).toHaveBeenNthCalledWith(1, true);
    expect(context.setReviewSubmitPending).toHaveBeenLastCalledWith(false);
    expect(context.requestGuardRef.current.release).toHaveBeenCalledWith(context.requestToken);
  });

  it('does not commit a response from a stale session epoch', async () => {
    let resolveReview!: (result: StudyReviewResult) => void;
    const deferredReview = new Promise<StudyReviewResult>((resolve) => {
      resolveReview = resolve;
    });
    const context = makeContext({ submitReview: vi.fn().mockReturnValue(deferredReview) });

    const submission = submitStudyReviewOperation(context);
    context.sessionEpochRef.current += 1;
    resolveReview(reviewResult);
    await submission;

    expect(context.pendingReviewOperationRef.current).toBe(operation);
    expect(context.pushUndo).not.toHaveBeenCalled();
    expect(context.requestGuardRef.current.release).toHaveBeenCalledWith(context.requestToken);
  });

  it('retains an ambiguous operation for an explicit retry', async () => {
    const error = new TypeError('Network failed');
    const context = makeContext({ submitReview: vi.fn().mockRejectedValue(error) });

    await expect(submitStudyReviewOperation(context)).rejects.toBe(error);

    expect(context.pendingReviewOperationRef.current).toBe(operation);
    expect(context.setReviewRetryAvailable).toHaveBeenCalledWith(true);
    expect(context.setSessionError).toHaveBeenCalledWith('Network failed');
    expect(context.setReviewSubmitPending).toHaveBeenLastCalledWith(false);
  });

  it('clears a definitively rejected operation', async () => {
    const error = new JsonRequestError('Invalid review', 422, null);
    const context = makeContext({ submitReview: vi.fn().mockRejectedValue(error) });

    await expect(submitStudyReviewOperation(context)).rejects.toBe(error);

    expect(context.pendingReviewOperationRef.current).toBeNull();
    expect(context.setReviewRetryAvailable).toHaveBeenCalledWith(false);
    expect(context.setSessionError).toHaveBeenCalledWith('Invalid review');
  });
});
