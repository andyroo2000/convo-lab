import type { StudyCardSummary } from '@languageflow/shared/src/types';
import { describe, expect, it } from 'vitest';

import { JsonRequestError } from '../../lib/apiClient';
import StudyReviewIdentityMismatchError from '../../lib/studyReviewIdentityMismatch';
import {
  createStudyMasteryAnimation,
  getCardsAfterCommittedReview,
  getLessonCardsAfterAgain,
  getNextReviewCardIndex,
  getPracticeCardsAfterGrade,
  getStudyReviewErrorMessage,
  isAmbiguousReviewError,
  isReviewConflictError,
  isReviewSubmissionBlocked,
  pendingReviewDoesNotMatch,
} from '../studyReviewSubmissionRules';

const makeCard = (id: string, masteryLevel = 'apprentice') =>
  ({
    id,
    masteryLevel,
    answer: { expression: id },
    prompt: { cueText: id },
    state: { dueAt: null, failedAt: null, queueState: 'new' },
  }) as StudyCardSummary;

describe('review submission guards', () => {
  const ready = {
    editing: false,
    hasCurrentCard: true,
    masteryAnimationActive: false,
    requestBusy: false,
    reviewPending: false,
    undoPending: false,
  };

  it('allows a ready review submission', () => {
    expect(isReviewSubmissionBlocked(ready)).toBe(false);
  });

  it.each([
    ['editing', true],
    ['hasCurrentCard', false],
    ['masteryAnimationActive', true],
    ['requestBusy', true],
    ['reviewPending', true],
    ['undoPending', true],
  ] as const)('blocks when %s is %s', (key, value) => {
    expect(isReviewSubmissionBlocked({ ...ready, [key]: value })).toBe(true);
  });

  it('rejects a retry that targets a different review operation', () => {
    expect(pendingReviewDoesNotMatch({ cardId: 'card-1', grade: 'good' }, 'card-1', 'again')).toBe(
      true
    );
    expect(pendingReviewDoesNotMatch({ cardId: 'card-1', grade: 'good' }, 'card-1', 'good')).toBe(
      false
    );
  });
});

describe('review queue decisions', () => {
  const first = makeCard('first');
  const second = makeCard('second');
  const third = makeCard('third');

  it('rotates an again card to the back of a practice queue', () => {
    expect(getPracticeCardsAfterGrade([first, second], 'again')).toEqual([second, first]);
  });

  it('removes a passed card from a practice queue', () => {
    expect(getPracticeCardsAfterGrade([first, second], 'good')).toEqual([second]);
  });

  it('wraps a failed lesson card behind all other cards', () => {
    expect(getLessonCardsAfterAgain([first, second, third], 1, second)).toEqual([
      third,
      first,
      second,
    ]);
  });

  it('drops a committed review when the response has no updated card', () => {
    expect(getCardsAfterCommittedReview([first, second], first.id, null, 'good')).toEqual([second]);
  });

  it('keeps the next index in range', () => {
    expect(getNextReviewCardIndex(3, 2)).toBe(1);
    expect(getNextReviewCardIndex(3, 0)).toBe(0);
  });
});

describe('review result presentation', () => {
  it('builds a normalized mastery animation from the committed card', () => {
    const before = makeCard('before', 'apprentice');
    const after = makeCard('after', 'guru');

    expect(
      createStudyMasteryAnimation({
        cardBefore: before,
        cardAfter: after,
        grade: 'good',
        reviewLogId: 'review-1',
      })
    ).toEqual({
      id: 'review-1',
      card: before,
      label: 'after',
      fromLevel: 'apprentice',
      toLevel: 'guru',
      passed: true,
    });
  });
});

describe('review error classification', () => {
  it('recognizes identity and conflict responses', () => {
    expect(isReviewConflictError(new StudyReviewIdentityMismatchError('sent', 'received'))).toBe(
      true
    );
    expect(isReviewConflictError(new JsonRequestError('Conflict', 409, null))).toBe(true);
    expect(isReviewConflictError(new JsonRequestError('Invalid', 422, null))).toBe(false);
  });

  it.each([408, 429, 500, 503])('treats HTTP %i as an ambiguous result', (status) => {
    expect(isAmbiguousReviewError(new JsonRequestError('Retry', status, null))).toBe(true);
  });

  it('treats transport failures, but not validation failures, as ambiguous', () => {
    expect(isAmbiguousReviewError(new TypeError('Network failed'))).toBe(true);
    expect(isAmbiguousReviewError(new JsonRequestError('Invalid', 422, null))).toBe(false);
  });

  it('preserves error messages and supplies a non-error fallback', () => {
    expect(getStudyReviewErrorMessage(new Error('Review unavailable'))).toBe('Review unavailable');
    expect(getStudyReviewErrorMessage('failed')).toBe('Review failed.');
  });
});
