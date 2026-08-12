import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import useStudyCreateActionGuard from '../useStudyCreateActionGuard';

describe('useStudyCreateActionGuard', () => {
  it('runs only one action until the active request settles', async () => {
    let resolveFirst!: () => void;
    const firstAction = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveFirst = resolve;
        })
    );
    const conflictingAction = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useStudyCreateActionGuard());

    let firstPromise!: Promise<unknown>;
    let conflictingPromise!: Promise<unknown>;
    act(() => {
      firstPromise = result.current(firstAction);
      conflictingPromise = result.current(conflictingAction);
    });

    expect(firstAction).toHaveBeenCalledTimes(1);
    expect(conflictingAction).not.toHaveBeenCalled();

    await act(async () => {
      resolveFirst();
      await Promise.all([firstPromise, conflictingPromise]);
    });

    await act(async () => result.current(conflictingAction));
    expect(conflictingAction).toHaveBeenCalledTimes(1);
  });

  it('releases ownership after an action rejects', async () => {
    const failingAction = vi.fn().mockRejectedValue(new Error('failed'));
    const nextAction = vi.fn().mockResolvedValue('completed');
    const { result } = renderHook(() => useStudyCreateActionGuard());

    await expect(result.current(failingAction)).rejects.toThrow('failed');
    await expect(result.current(nextAction)).resolves.toBe('completed');
  });
});
