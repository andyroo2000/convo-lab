import { fireEvent, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import useStudyKeyboardShortcuts from '../useStudyKeyboardShortcuts';

describe('useStudyKeyboardShortcuts', () => {
  it('blocks study input while a promotion interstitial is active', () => {
    const revealCurrentCard = vi.fn();
    const handleGrade = vi.fn(async () => undefined);

    const { rerender } = renderHook(
      ({ interactionBlocked }) =>
        useStudyKeyboardShortcuts({
          cardActionPending: false,
          editing: false,
          exitFocusMode: vi.fn(),
          focusMode: true,
          handleGrade,
          handleUndo: vi.fn(async () => undefined),
          interactionBlocked,
          onError: vi.fn(),
          revealCurrentCard,
          revealed: false,
          toggleAnswerAudio: vi.fn(() => false),
          reviewSubmitPending: false,
          reviewPending: false,
          runBackgroundTask: vi.fn(),
          setEditing: vi.fn(),
        }),
      { initialProps: { interactionBlocked: true } }
    );

    fireEvent.keyDown(window, { code: 'Space' });
    fireEvent.keyDown(window, { code: 'Digit3', key: '3' });
    expect(revealCurrentCard).not.toHaveBeenCalled();
    expect(handleGrade).not.toHaveBeenCalled();

    rerender({ interactionBlocked: false });
    fireEvent.keyDown(window, { code: 'Space' });
    expect(revealCurrentCard).toHaveBeenCalledOnce();
  });
});
