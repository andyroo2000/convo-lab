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

  it('keeps undo available while editing and exits editing on Escape', async () => {
    const handleUndo = vi.fn(async () => undefined);
    const runBackgroundTask = vi.fn();
    const setEditing = vi.fn();

    renderHook(() =>
      useStudyKeyboardShortcuts({
        cardActionPending: false,
        editing: true,
        exitFocusMode: vi.fn(),
        focusMode: true,
        handleGrade: vi.fn(async () => undefined),
        handleUndo,
        interactionBlocked: false,
        onError: vi.fn(),
        revealCurrentCard: vi.fn(),
        revealed: false,
        toggleAnswerAudio: vi.fn(() => false),
        reviewSubmitPending: false,
        reviewPending: false,
        runBackgroundTask,
        setEditing,
      })
    );

    fireEvent.keyDown(window, { ctrlKey: true, key: 'z' });
    expect(runBackgroundTask).toHaveBeenCalledOnce();
    await runBackgroundTask.mock.calls[0][0]();
    expect(handleUndo).toHaveBeenCalledOnce();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(setEditing).toHaveBeenCalledWith(false);
  });

  it('routes reveal, answer audio, grading, and focus exit shortcuts', async () => {
    const exitFocusMode = vi.fn();
    const handleGrade = vi.fn(async () => undefined);
    const revealCurrentCard = vi.fn();
    const runBackgroundTask = vi.fn();
    const toggleAnswerAudio = vi.fn(() => false);

    const { rerender } = renderHook(
      ({ revealed }) =>
        useStudyKeyboardShortcuts({
          cardActionPending: false,
          editing: false,
          exitFocusMode,
          focusMode: true,
          handleGrade,
          handleUndo: vi.fn(async () => undefined),
          interactionBlocked: false,
          onError: vi.fn(),
          revealCurrentCard,
          revealed,
          toggleAnswerAudio,
          reviewSubmitPending: false,
          reviewPending: false,
          runBackgroundTask,
          setEditing: vi.fn(),
        }),
      { initialProps: { revealed: false } }
    );

    fireEvent.keyDown(window, { code: 'Space' });
    expect(revealCurrentCard).toHaveBeenCalledOnce();
    expect(toggleAnswerAudio).not.toHaveBeenCalled();

    rerender({ revealed: true });
    fireEvent.keyDown(window, { code: 'Space' });
    expect(toggleAnswerAudio).toHaveBeenCalledOnce();
    expect(revealCurrentCard).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(window, { code: 'Digit3', key: '3' });
    await runBackgroundTask.mock.calls[0][0]();
    expect(handleGrade).toHaveBeenCalledWith('good');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(exitFocusMode).toHaveBeenCalledOnce();
  });
});
