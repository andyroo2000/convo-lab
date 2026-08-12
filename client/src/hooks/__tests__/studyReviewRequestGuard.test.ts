import { describe, expect, it } from 'vitest';

import { createStudyReviewRequestGuard } from '../studyReviewRequestGuard';

describe('createStudyReviewRequestGuard', () => {
  it('allows only one persisted scheduler request at a time', () => {
    const guard = createStudyReviewRequestGuard();

    const reviewToken = guard.acquire('review');

    expect(reviewToken).not.toBeNull();
    expect(guard.isBusy()).toBe(true);
    expect(guard.acquire('card-action')).toBeNull();
    expect(guard.acquire('undo')).toBeNull();
  });

  it('ignores stale releases after ownership changes', () => {
    const guard = createStudyReviewRequestGuard();
    const staleToken = guard.acquire('undo');

    expect(staleToken).not.toBeNull();
    guard.reset();
    const currentToken = guard.acquire('review');

    expect(currentToken).not.toBeNull();
    expect(guard.release(staleToken!)).toBe(false);
    expect(guard.isBusy()).toBe(true);
    expect(guard.release(currentToken!)).toBe(true);
    expect(guard.isBusy()).toBe(false);
  });
});
