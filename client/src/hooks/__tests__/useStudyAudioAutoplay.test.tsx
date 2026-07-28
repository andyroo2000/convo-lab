import { act, renderHook, waitFor } from '@testing-library/react';
import type { StudyCardSummary } from '@languageflow/shared/src/types';
import { describe, expect, it, vi } from 'vitest';

import useStudyAudioAutoplay from '../useStudyAudioAutoplay';

vi.mock('../../lib/audioCache', () => ({
  warmAudioCache: vi.fn().mockResolvedValue(undefined),
}));

const audioPromptCard = {
  id: 'audio-card',
  cardType: 'recognition',
  prompt: {
    cueAudio: {
      url: 'https://cdn.example.com/prompt.mp3',
    },
  },
  answer: {},
} as StudyCardSummary;

describe('useStudyAudioAutoplay', () => {
  it('waits for a mastery animation to finish before autoplaying the next prompt', async () => {
    const play = vi.fn().mockResolvedValue(true);
    const runBackgroundTask = vi.fn(
      (task?: Promise<unknown> | (() => Promise<unknown> | unknown)) => {
        if (typeof task === 'function') {
          task();
        }
      }
    );
    const ensureAnswerAudioPrepared = vi.fn();
    const { result, rerender } = renderHook(
      ({ autoplayBlocked }: { autoplayBlocked: boolean }) =>
        useStudyAudioAutoplay({
          autoplayBlocked,
          cards: [],
          currentCard: audioPromptCard,
          ensureAnswerAudioPrepared,
          focusMode: true,
          runBackgroundTask,
          revealed: false,
        }),
      { initialProps: { autoplayBlocked: true } }
    );

    act(() => {
      result.current.promptAudioRef.current = {
        play,
        stop: vi.fn(),
      };
    });

    expect(play).not.toHaveBeenCalled();

    rerender({ autoplayBlocked: false });

    await waitFor(() => expect(play).toHaveBeenCalledOnce());
  });
});
