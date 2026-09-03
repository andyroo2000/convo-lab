import type { StudyOverview } from '@languageflow/shared/src/types';
import { describe, expect, it, vi } from 'vitest';

import {
  getCachedStudyOverview,
  getStudyEditingHandler,
  getStudyUserId,
  isEmptySessionRefreshBlocked,
  isStudyAudioAutoplayBlocked,
  isStudyMotionUndoDisabled,
} from '../studyReviewSessionOrchestration';

describe('study review session orchestration', () => {
  it('reads the authenticated user and cached overview', () => {
    const overview = { dueCount: 3 } as StudyOverview;
    const cache = {
      getQueryData: <T>() => overview as T,
    };

    expect(getStudyUserId({ id: 'user-1' })).toBe('user-1');
    expect(getStudyUserId(null)).toBeNull();
    expect(getCachedStudyOverview(cache)).toBe(overview);
    expect(getCachedStudyOverview({ getQueryData: () => undefined })).toBeNull();
  });

  it('blocks autoplay only for a pending interaction or non-quiz lesson', () => {
    const ready = {
      lessonPhase: 'quiz' as const,
      masteryAnimation: null,
      reviewSubmitPending: false,
      sessionKind: 'reviews' as const,
    };

    expect(isStudyAudioAutoplayBlocked(ready)).toBe(false);
    expect(isStudyAudioAutoplayBlocked({ ...ready, reviewSubmitPending: true })).toBe(true);
    expect(
      isStudyAudioAutoplayBlocked({
        ...ready,
        lessonPhase: 'preview',
        sessionKind: 'lessons',
      })
    ).toBe(true);
  });

  it('disables motion undo while any conflicting session work is active', () => {
    const ready = {
      editing: false,
      masteryAnimation: null,
      sessionLoading: false,
      undoPending: false,
    };

    expect(isStudyMotionUndoDisabled(ready, false, false)).toBe(false);
    expect(isStudyMotionUndoDisabled({ ...ready, editing: true }, false, false)).toBe(true);
    expect(isStudyMotionUndoDisabled(ready, true, false)).toBe(true);
    expect(isStudyMotionUndoDisabled(ready, false, true)).toBe(true);
  });

  it('allows empty-session refresh only from an idle focused review', () => {
    const ready = {
      editing: false,
      focusMode: true,
      sessionError: null,
      sessionLoading: false,
      undoPending: false,
    };

    expect(isEmptySessionRefreshBlocked(ready, false, false, false)).toBe(false);
    expect(isEmptySessionRefreshBlocked({ ...ready, focusMode: false }, false, false, false)).toBe(
      true
    );
    expect(isEmptySessionRefreshBlocked(ready, true, false, false)).toBe(true);
    expect(isEmptySessionRefreshBlocked(ready, false, true, false)).toBe(true);
    expect(isEmptySessionRefreshBlocked(ready, false, false, true)).toBe(true);
  });

  it('ignores editing requests during practice mode', () => {
    const setEditing = vi.fn();

    getStudyEditingHandler(true, setEditing)(true);
    expect(setEditing).not.toHaveBeenCalled();

    getStudyEditingHandler(false, setEditing)(true);
    expect(setEditing).toHaveBeenCalledWith(true);
  });
});
