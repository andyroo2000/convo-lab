/* eslint-disable testing-library/no-container, testing-library/no-node-access */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ScriptTrackPlayer from '../ScriptTrackPlayer';
import { StudyActivityProvider } from '../../../contexts/StudyActivityContext';

const { saveSessionsMock } = vi.hoisted(() => ({
  saveSessionsMock: vi.fn(),
}));

vi.mock('../../../hooks/useStudyActivity', () => ({
  saveStudyActivitySessions: saveSessionsMock,
  studyActivityKeys: { all: ['study-activity'] },
}));

describe('ScriptTrackPlayer completion tracking', () => {
  beforeEach(() => {
    localStorage.clear();
    saveSessionsMock.mockReset().mockResolvedValue([]);
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '018f22d2-6d38-7000-8000-000000000001'
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('records a bounded zero-duration marker only after audio reaches its end', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const title = 'A'.repeat(150);
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <StudyActivityProvider userId={42}>
          <ScriptTrackPlayer
            title={title}
            status="ready"
            audioUrl="https://example.com/daily-audio.mp3"
            targetLanguage="ja"
          />
        </StudyActivityProvider>
      </QueryClientProvider>
    );
    const audio = container.querySelector('audio');
    expect(audio).not.toBeNull();

    fireEvent(audio!, new Event('ended'));

    await waitFor(() => expect(saveSessionsMock).toHaveBeenCalledTimes(1));
    const marker = saveSessionsMock.mock.calls[0][0][0];
    expect(marker).toEqual(
      expect.objectContaining({
        category: 'listen',
        activity: 'daily_audio',
        source: 'automatic',
        durationMs: 0,
        audioPlaybackMs: 0,
      })
    );
    expect(marker.name).toHaveLength(120);
    expect(marker.name).toMatch(/^Daily Audio completed: /);
  });

  it('persists one listen session and one marker for a realistic playback completion', async () => {
    vi.mocked(globalThis.crypto.randomUUID)
      .mockReturnValueOnce('018f22d2-6d38-7000-8000-000000000001')
      .mockReturnValueOnce('018f22d2-6d38-7000-8000-000000000002');
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <StudyActivityProvider userId={42}>
          <ScriptTrackPlayer
            title="Morning dialogue"
            status="ready"
            audioUrl="https://example.com/daily-audio.mp3"
            targetLanguage="ja"
          />
        </StudyActivityProvider>
      </QueryClientProvider>
    );
    const audio = container.querySelector('audio');
    expect(audio).not.toBeNull();

    fireEvent(audio!, new Event('play'));
    await waitFor(() =>
      expect(localStorage.getItem('convolab.studyActivity.active.v1.42')).not.toBeNull()
    );
    fireEvent(audio!, new Event('ended'));

    await waitFor(() => expect(saveSessionsMock).toHaveBeenCalledTimes(2));
    const sessions = saveSessionsMock.mock.calls.flatMap(([batch]) => batch);
    expect(sessions).toHaveLength(2);
    expect(sessions.filter(({ name }) => name === 'Morning dialogue')).toHaveLength(1);
    expect(sessions.filter(({ name }) => name.startsWith('Daily Audio completed: '))).toHaveLength(
      1
    );
  });
});
