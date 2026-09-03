import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import useTimePracticeAudio, { getTimePracticeStatusText } from '../useTimePracticeAudio';

const mockBuildTimeAudioClipUrls = vi.hoisted(() => vi.fn());
const mockPlayAudioClipSequence = vi.hoisted(() => vi.fn());
const mockTrackTimePracticeEvent = vi.hoisted(() => vi.fn());

vi.mock('../../../japaneseDate/logic/preRenderedTimeAudio', () => ({
  buildTimeAudioClipUrls: mockBuildTimeAudioClipUrls,
}));

vi.mock('../../../logic/audioClipPlayback', () => ({
  playAudioClipSequence: mockPlayAudioClipSequence,
}));

vi.mock('../../logic/analytics', () => ({
  default: mockTrackTimePracticeEvent,
}));

const card = { id: 'jp-time:24h:9:30', hour24: 9, minute: 30 };

describe('useTimePracticeAudio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBuildTimeAudioClipUrls.mockReturnValue(['/audio/hour.mp3', '/audio/minute.mp3']);
  });

  it('plays the current card at the selected volume', async () => {
    const playback = { stop: vi.fn(), setVolume: vi.fn(), finished: Promise.resolve() };
    mockPlayAudioClipSequence.mockReturnValue(playback);
    const { result } = renderHook(() => useTimePracticeAudio(card, 0.75));

    await act(() => result.current.playCurrentCardAudio());

    expect(mockBuildTimeAudioClipUrls).toHaveBeenCalledWith({
      hour24: 9,
      minute: 30,
      hourFormat: '24h',
    });
    expect(mockPlayAudioClipSequence).toHaveBeenCalledWith(
      ['/audio/hour.mp3', '/audio/minute.mp3'],
      { volume: 0.75 }
    );
    expect(result.current.playbackHint).toBeNull();
  });

  it('reports a non-abort playback failure', async () => {
    mockPlayAudioClipSequence.mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useTimePracticeAudio(card, 1));

    await act(() => result.current.playCurrentCardAudio());

    expect(mockTrackTimePracticeEvent).toHaveBeenCalledWith('audio_play_error', 'random');
    expect(result.current.playbackHint).toBe(
      'Autoplay was blocked. Tap Play or Next to hear audio.'
    );
  });

  it('ignores an aborted playback', async () => {
    mockPlayAudioClipSequence.mockImplementation(() => {
      throw new DOMException('stopped', 'AbortError');
    });
    const { result } = renderHook(() => useTimePracticeAudio(card, 1));

    await act(() => result.current.playCurrentCardAudio());

    expect(mockTrackTimePracticeEvent).not.toHaveBeenCalled();
    expect(result.current.playbackHint).toBeNull();
  });

  it.each([
    [{ countdownSeconds: null, isPlaying: false, isPowerOn: true, isRevealed: false }, ''],
    [{ countdownSeconds: 4, isPlaying: false, isPowerOn: true, isRevealed: false }, 'answer in 4s'],
    [
      { countdownSeconds: 3, isPlaying: false, isPowerOn: true, isRevealed: true },
      'replaying in 3s',
    ],
    [{ countdownSeconds: 2, isPlaying: true, isPowerOn: true, isRevealed: true }, ''],
  ])('derives the playback status text', (input, expected) => {
    expect(getTimePracticeStatusText(input)).toBe(expected);
  });
});
