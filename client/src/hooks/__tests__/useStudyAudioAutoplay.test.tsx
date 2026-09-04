import { act, renderHook, waitFor } from '@testing-library/react';
import type { StudyCardSummary } from '@languageflow/shared/src/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import useStudyAudioAutoplay from '../useStudyAudioAutoplay';
import { warmAudioCache } from '../../lib/audioCache';

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

const answerAudioCard = {
  ...audioPromptCard,
  id: 'answer-card',
  prompt: {},
  answer: {
    answerAudio: {
      filename: 'answer.mp3',
      mediaKind: 'audio',
      source: 'generated',
      url: 'https://cdn.example.com/answer.mp3',
    },
  },
} as StudyCardSummary;

describe('useStudyAudioAutoplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('autoplays the first prompt when its player mounts after the card effect', async () => {
    const play = vi.fn().mockResolvedValue(true);
    const runBackgroundTask = vi.fn(
      (task?: Promise<unknown> | (() => Promise<unknown> | unknown)) => {
        if (typeof task === 'function') {
          task();
        }
      }
    );
    const ensureAnswerAudioPrepared = vi.fn();
    const { result } = renderHook(() =>
      useStudyAudioAutoplay({
        autoplayBlocked: false,
        cards: [],
        currentCard: audioPromptCard,
        ensureAnswerAudioPrepared,
        focusMode: true,
        runBackgroundTask,
        revealed: false,
      })
    );

    expect(play).not.toHaveBeenCalled();

    act(() => {
      result.current.promptAudioRef({
        play,
        stop: vi.fn(),
      });
    });

    await waitFor(() => expect(play).toHaveBeenCalledOnce());
  });

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
      result.current.promptAudioRef({
        play,
        stop: vi.fn(),
      });
    });

    expect(play).not.toHaveBeenCalled();

    rerender({ autoplayBlocked: false });

    await waitFor(() => expect(play).toHaveBeenCalledOnce());
  });

  it('autoplays answer audio once per card until that card is reset', () => {
    const play = vi.fn().mockResolvedValue(true);
    const runBackgroundTask = vi.fn();
    const options = {
      autoplayBlocked: false,
      cards: [],
      currentCard: answerAudioCard,
      ensureAnswerAudioPrepared: vi.fn(),
      focusMode: true,
      runBackgroundTask,
    };
    const { result, rerender } = renderHook(
      ({ revealed }: { revealed: boolean }) => useStudyAudioAutoplay({ ...options, revealed }),
      { initialProps: { revealed: false } }
    );

    result.current.answerAudioRef.current = { play, stop: vi.fn() };
    rerender({ revealed: true });
    rerender({ revealed: false });
    rerender({ revealed: true });

    expect(play).toHaveBeenCalledOnce();
    expect(runBackgroundTask).toHaveBeenCalledWith(expect.any(Promise), {
      label: 'Study answer-audio autoplay',
    });

    act(() => result.current.resetAutoplayForCard(answerAudioCard.id));
    act(() => result.current.autoplayAnswerAudioForCard(answerAudioCard));
    expect(play).toHaveBeenCalledTimes(2);
  });

  it('prewarms only the next three cards and prepares cards missing answer audio', async () => {
    const secondAudioCard = { ...answerAudioCard, id: 'answer-card-2' };
    const missingAudioCard = { ...answerAudioCard, id: 'missing-card', answer: {} };
    const outsideWindowCard = { ...answerAudioCard, id: 'outside-window', answer: {} };
    const ensureAnswerAudioPrepared = vi.fn().mockResolvedValue(missingAudioCard);
    const runBackgroundTask = vi.fn(
      (task?: Promise<unknown> | (() => Promise<unknown> | unknown)) => {
        if (typeof task === 'function') task();
      }
    );

    renderHook(() =>
      useStudyAudioAutoplay({
        autoplayBlocked: false,
        cards: [answerAudioCard, missingAudioCard, secondAudioCard, outsideWindowCard],
        currentCard: null,
        ensureAnswerAudioPrepared,
        focusMode: true,
        runBackgroundTask,
        revealed: false,
      })
    );

    await waitFor(() => {
      expect(warmAudioCache).toHaveBeenCalledWith([
        'https://cdn.example.com/answer.mp3',
        'https://cdn.example.com/answer.mp3',
      ]);
      expect(ensureAnswerAudioPrepared).toHaveBeenCalledWith('missing-card');
    });
    expect(ensureAnswerAudioPrepared).not.toHaveBeenCalledWith('outside-window');
  });
});
