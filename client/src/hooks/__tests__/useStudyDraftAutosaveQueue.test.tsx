import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import useStudyDraftAutosaveQueue, {
  type StudyDraftSaveRequest,
} from '../useStudyDraftAutosaveQueue';

const saveRequest = (meaning: string): StudyDraftSaveRequest => ({
  ownerId: 'user-1',
  draftId: 'draft-1',
  baseRevision: 4,
  values: {
    answer: { meaning },
  },
});

describe('useStudyDraftAutosaveQueue', () => {
  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('debounces scheduled saves to the newest draft state', async () => {
    vi.useFakeTimers();
    const saveDraft = vi.fn().mockResolvedValue({ revision: 5 });
    const { result } = renderHook(() => useStudyDraftAutosaveQueue(saveDraft));

    act(() => {
      result.current.scheduleSave(saveRequest('business'));
      result.current.scheduleSave(saveRequest('enterprise'));
      vi.advanceTimersByTime(700);
    });
    await act(async () => result.current.waitForIdle());

    expect(saveDraft).toHaveBeenCalledTimes(1);
    expect(saveDraft).toHaveBeenCalledWith({
      draftId: 'draft-1',
      values: { answer: { meaning: 'enterprise' }, expectedRevision: 4 },
    });
  });

  it('writes the newest intent before waiting for the debounce timer', () => {
    vi.useFakeTimers();
    const saveDraft = vi.fn().mockResolvedValue({ revision: 5 });
    const { result } = renderHook(() => useStudyDraftAutosaveQueue(saveDraft));

    act(() => result.current.scheduleSave(saveRequest('enterprise')));

    expect(
      JSON.parse(
        window.localStorage.getItem('convolab.studyDraftIntent.v2.user-1.draft-1') ?? 'null'
      )
    ).toEqual(
      expect.objectContaining({
        baseRevision: 4,
        draftId: 'draft-1',
        values: { answer: { meaning: 'enterprise' } },
      })
    );
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it('does not send an edit when durable storage fails', () => {
    vi.useFakeTimers();
    const saveDraft = vi.fn().mockResolvedValue({ revision: 5 });
    const onStorageError = vi.fn();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    const { result } = renderHook(() => useStudyDraftAutosaveQueue(saveDraft, { onStorageError }));

    act(() => {
      result.current.scheduleSave(saveRequest('enterprise'));
      vi.advanceTimersByTime(700);
    });

    expect(onStorageError).toHaveBeenCalledTimes(1);
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it('chains the acknowledged revision into a newer serialized save', async () => {
    vi.useFakeTimers();
    let resolveFirstSave!: (draft: { revision: number }) => void;
    const saveDraft = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<{ revision: number }>((resolve) => {
            resolveFirstSave = resolve;
          })
      )
      .mockResolvedValueOnce({ revision: 6 });
    const { result } = renderHook(() => useStudyDraftAutosaveQueue(saveDraft));

    act(() => {
      result.current.scheduleSave(saveRequest('business'));
      vi.advanceTimersByTime(700);
    });
    await act(async () => Promise.resolve());
    act(() => {
      result.current.scheduleSave(saveRequest('enterprise'));
      vi.advanceTimersByTime(700);
    });

    await act(async () => resolveFirstSave({ revision: 5 }));
    await act(async () => result.current.waitForIdle());

    expect(saveDraft).toHaveBeenNthCalledWith(1, {
      draftId: 'draft-1',
      values: { answer: { meaning: 'business' }, expectedRevision: 4 },
    });
    expect(saveDraft).toHaveBeenNthCalledWith(2, {
      draftId: 'draft-1',
      values: { answer: { meaning: 'enterprise' }, expectedRevision: 5 },
    });
    expect(window.localStorage.getItem('convolab.studyDraftIntent.v2.user-1.draft-1')).toBeNull();
  });

  it('flushes the latest state after an active save finishes', async () => {
    vi.useFakeTimers();
    let resolveFirstSave!: (draft: { revision: number }) => void;
    const saveDraft = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<{ revision: number }>((resolve) => {
            resolveFirstSave = resolve;
          })
      )
      .mockResolvedValue({ revision: 6 });
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
      resolveFirstSave({ revision: 5 });
      await flushPromise;
    });

    expect(saveDraft).toHaveBeenCalledTimes(2);
    expect(saveDraft).toHaveBeenLastCalledWith({
      draftId: 'draft-1',
      values: { answer: { meaning: 'enterprise' }, expectedRevision: 5 },
    });
  });

  it('flushes a scheduled save immediately without replaying its timer', async () => {
    vi.useFakeTimers();
    const saveDraft = vi.fn().mockResolvedValue({ revision: 5 });
    const { result } = renderHook(() => useStudyDraftAutosaveQueue(saveDraft));

    let flushPromise: Promise<unknown> | null = null;
    act(() => {
      result.current.scheduleSave(saveRequest('business'));
      flushPromise = result.current.flushScheduledSave();
    });
    await act(async () => flushPromise);

    expect(saveDraft).toHaveBeenCalledTimes(1);
    expect(saveDraft).toHaveBeenCalledWith({
      draftId: 'draft-1',
      values: { answer: { meaning: 'business' }, expectedRevision: 4 },
    });

    await act(async () => vi.advanceTimersByTimeAsync(700));
    expect(saveDraft).toHaveBeenCalledTimes(1);
  });

  it('flushes a scheduled save through the normal queue on unmount', async () => {
    vi.useFakeTimers();
    const saveDraft = vi.fn().mockResolvedValue({ revision: 5 });
    const { result, unmount } = renderHook(() => useStudyDraftAutosaveQueue(saveDraft));

    act(() => result.current.scheduleSave(saveRequest('business')));
    unmount();
    await act(async () => Promise.resolve());

    expect(saveDraft).toHaveBeenCalledWith({
      draftId: 'draft-1',
      values: { answer: { meaning: 'business' }, expectedRevision: 4 },
    });
  });
});
