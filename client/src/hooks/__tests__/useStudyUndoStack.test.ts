import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import useStudyUndoStack from '../useStudyUndoStack';

describe('useStudyUndoStack', () => {
  it('caps the undo stack and drops the oldest actions first', () => {
    const { result } = renderHook(() => useStudyUndoStack<number>(3));

    act(() => {
      result.current.pushUndo(1);
      result.current.pushUndo(2);
      result.current.pushUndo(3);
      result.current.pushUndo(4);
    });

    expect(result.current.stackRef.current).toEqual([2, 3, 4]);
    expect(result.current.popUndo()).toBe(4);
    expect(result.current.popUndo()).toBe(3);
    expect(result.current.popUndo()).toBe(2);
  });
});
