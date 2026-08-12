import { fireEvent, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Sentence } from '../../types';
import usePlaybackKeyboardControls from '../usePlaybackKeyboardControls';

const sentences: Sentence[] = [
  {
    id: 'sentence-1',
    dialogueId: 'dialogue-1',
    speakerId: 'speaker-1',
    text: '最初',
    translation: 'First',
    order: 0,
    selected: false,
    metadata: {},
    startTime: 1000,
    endTime: 3000,
    startTime_0_85: 1000,
    endTime_0_85: 3000,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'sentence-2',
    dialogueId: 'dialogue-1',
    speakerId: 'speaker-2',
    text: '次',
    translation: 'Next',
    order: 1,
    selected: false,
    metadata: {},
    startTime: 4000,
    endTime: 6000,
    startTime_0_85: 4000,
    endTime_0_85: 6000,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const createOptions = () => ({
  currentTimeSeconds: 0,
  isPlaying: false,
  pause: vi.fn(),
  play: vi.fn(),
  seek: vi.fn(),
  selectedSpeed: 'medium' as const,
  sentences,
});

describe('usePlaybackKeyboardControls', () => {
  it('toggles playback with an unmodified Space press', () => {
    const options = createOptions();
    const { rerender } = renderHook((props) => usePlaybackKeyboardControls(props), {
      initialProps: options,
    });

    fireEvent.keyDown(window, { code: 'Space' });
    expect(options.play).toHaveBeenCalledOnce();

    rerender({ ...options, isPlaying: true });
    fireEvent.keyDown(window, { code: 'Space' });
    expect(options.pause).toHaveBeenCalledOnce();
  });

  it('uses the latest playback time for sentence navigation', () => {
    const options = createOptions();
    const { rerender } = renderHook((props) => usePlaybackKeyboardControls(props), {
      initialProps: options,
    });

    fireEvent.keyDown(window, { code: 'ArrowRight' });
    expect(options.seek).toHaveBeenLastCalledWith(1);

    rerender({ ...options, currentTimeSeconds: 2 });
    fireEvent.keyDown(window, { code: 'ArrowRight' });
    expect(options.seek).toHaveBeenLastCalledWith(4);
  });

  it('leaves keyboard events on interactive and editable controls alone', () => {
    const options = createOptions();
    renderHook(() => usePlaybackKeyboardControls(options));

    const button = document.createElement('button');
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    document.body.append(button, editable);

    expect(fireEvent.keyDown(button, { code: 'Space' })).toBe(true);
    expect(fireEvent.keyDown(editable, { code: 'ArrowRight' })).toBe(true);
    expect(options.play).not.toHaveBeenCalled();
    expect(options.seek).not.toHaveBeenCalled();

    button.remove();
    editable.remove();
  });

  it('ignores repeated and modified shortcuts', () => {
    const options = createOptions();
    renderHook(() => usePlaybackKeyboardControls(options));

    fireEvent.keyDown(window, { code: 'Space', repeat: true });
    fireEvent.keyDown(window, { code: 'ArrowRight', metaKey: true });
    fireEvent.keyDown(window, { code: 'ArrowLeft', shiftKey: true });

    expect(options.play).not.toHaveBeenCalled();
    expect(options.seek).not.toHaveBeenCalled();
  });
});
