import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import useAudioCourseLinePlayback from './useAudioCourseLinePlayback';

const narrationUnit = {
  type: 'narration_L1' as const,
  text: 'Welcome to the lesson.',
  voiceId: 'narrator-voice',
};

const successfulResponse = (audioUrl: string): Response =>
  ({
    ok: true,
    json: vi.fn().mockResolvedValue({ audioUrl }),
  }) as unknown as Response;

const failedResponse = (message: string): Response =>
  ({
    ok: false,
    json: vi.fn().mockResolvedValue({ message }),
  }) as unknown as Response;

describe('useAudioCourseLinePlayback', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('ignores script units without spoken audio', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useAudioCourseLinePlayback(vi.fn()));

    await act(async () => {
      await result.current.playLine({ type: 'pause', seconds: 1 }, 0);
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.playingIndex).toBeNull();
  });

  it('synthesizes a playable line and reuses the cached URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(successfulResponse('/audio/line.mp3'));
    const reportError = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useAudioCourseLinePlayback(reportError));

    await act(async () => {
      await result.current.playLine(narrationUnit, 2);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          text: narrationUnit.text,
          voiceId: narrationUnit.voiceId,
        }),
      })
    );
    expect(reportError).toHaveBeenCalledWith('');
    expect(result.current.playingIndex).toBe(2);
    expect(result.current.playingUrl).toBe('/audio/line.mp3');

    await act(async () => {
      await result.current.playLine(narrationUnit, 2);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports synthesis failures and clears the loading state', async () => {
    const fetchMock = vi.fn().mockResolvedValue(failedResponse('Voice service unavailable'));
    const reportError = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useAudioCourseLinePlayback(reportError));

    await act(async () => {
      await result.current.playLine(narrationUnit, 1);
    });

    expect(reportError).toHaveBeenLastCalledWith('Voice service unavailable');
    expect(result.current.lineLoadingIndex).toBeNull();
    expect(result.current.playingUrl).toBeNull();
  });

  it('resets cached playback state after loading another script', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(successfulResponse('/audio/line.mp3')));
    const { result } = renderHook(() => useAudioCourseLinePlayback(vi.fn()));

    await act(async () => {
      await result.current.playLine(narrationUnit, 3);
      result.current.resetPlayback();
    });

    expect(result.current.playingIndex).toBeNull();
    expect(result.current.playingUrl).toBeNull();
  });
});
