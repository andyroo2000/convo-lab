import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import useStudyDraftAutosaveQueue, {
  type StudyDraftSaveRequest,
} from '../useStudyDraftAutosaveQueue';

const saveRequest = (meaning: string): StudyDraftSaveRequest => ({
  draftId: 'draft-1',
  values: {
    answer: { meaning },
  },
});

describe('useStudyDraftAutosaveQueue', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces scheduled saves to the newest draft state', async () => {
    vi.useFakeTimers();
    const saveDraft = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useStudyDraftAutosaveQueue(saveDraft));

    act(() => {
      result.current.scheduleSave(saveRequest('business'));
      result.current.scheduleSave(saveRequest('enterprise'));
      vi.advanceTimersByTime(700);
    });
    await act(async () => result.current.waitForIdle());

    expect(saveDraft).toHaveBeenCalledTimes(1);
    expect(saveDraft).toHaveBeenCalledWith(saveRequest('enterprise'));
  });

  it('flushes the latest state after an active save finishes', async () => {
    vi.useFakeTimers();
    let resolveFirstSave!: () => void;
    const saveDraft = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFirstSave = resolve;
          })
      )
      .mockResolvedValue(undefined);
    const { result } = renderHook(() => useStudyDraftAutosaveQueue(saveDraft));

    act(() => {
      result.current.scheduleSave(saveRequest('business'));
      vi.advanceTimersByTime(700);
    });
    await act(async () => Promise.resolve());

    let flushPromise!: Promise<unknown>;
    act(() => {
      flushPromise = result.current.flushSave(saveRequest('enterprise'));
    });
    expect(saveDraft).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirstSave();
      await flushPromise;
    });

    expect(saveDraft).toHaveBeenCalledTimes(2);
    expect(saveDraft).toHaveBeenLastCalledWith(saveRequest('enterprise'));
  });
});
