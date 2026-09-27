import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StudyCardFace, type AudioPlayerHandle } from '../StudyCardPreview';
import { defineNavigatorValue } from '../../../test/utils';
import { baseCard, mockStudyCardMedia } from './studyCardPreviewFixtures';

const withAnswerAudio = (filename = 'answer.mp3', url = `https://example.com/${filename}`) => ({
  ...baseCard,
  answer: {
    ...baseCard.answer,
    answerAudio: { filename, url, mediaKind: 'audio' as const, source: 'generated' as const },
  },
});

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

describe('StudyCardPreview audio', () => {
  beforeEach(mockStudyCardMedia);

  it('derives the audio MIME type from the answer audio asset', () => {
    render(<StudyCardFace side="back" card={withAnswerAudio('answer.ogg')} />);

    expect(screen.getByTestId('study-answer-audio-source')).toHaveAttribute('type', 'audio/ogg');
  });

  it('reuses prompt-only card audio on the answer side', () => {
    render(
      <StudyCardFace
        side="back"
        card={{
          ...baseCard,
          prompt: {
            cueAudio: {
              filename: 'listening-example.mp3',
              url: 'https://example.com/listening-example.mp3',
              mediaKind: 'audio',
              source: 'imported',
            },
          },
        }}
      />
    );

    expect(screen.getByTestId('study-answer-audio-source')).toHaveAttribute(
      'src',
      'https://example.com/listening-example.mp3'
    );
    expect(
      screen.queryByText('Answer audio is being backfilled for this card.')
    ).not.toBeInTheDocument();
  });

  it('derives prompt audio MIME type from its filename when the media URL has no extension', () => {
    render(
      <StudyCardFace
        side="front"
        card={{
          ...baseCard,
          prompt: {
            cueAudio: {
              filename: 'recognition-prompt.m4a',
              url: '/api/study/media/01K123456789ABCDEFGHJKMNPQ',
              mediaKind: 'audio',
              source: 'imported',
            },
          },
        }}
      />
    );

    expect(screen.getByTestId('study-prompt-audio-source')).toHaveAttribute('type', 'audio/mp4');
  });

  it('renders a mobile-focus answer audio replay button while preserving the audio source', () => {
    render(<StudyCardFace side="back" layout="mobile-focus" card={withAnswerAudio()} />);

    expect(screen.queryByTestId('study-answer-audio-button')).not.toBeInTheDocument();
    const audioSource = screen.getByTestId('study-answer-audio-source');
    expect(audioSource).toHaveAttribute('src', 'https://example.com/answer.mp3');
    expect(screen.getByTestId('study-answer-audio-element')).toHaveAttribute('preload', 'auto');
    expect(screen.getByTestId('study-answer-audio-element')).toHaveClass('sr-only');
    expect(screen.getByTestId('study-answer-audio-element')).not.toHaveClass('hidden');
  });

  it('only preloads answer audio metadata when the browser asks to save data', () => {
    defineNavigatorValue('connection', { saveData: true });

    render(<StudyCardFace side="back" layout="mobile-focus" card={withAnswerAudio()} />);

    expect(screen.getByTestId('study-answer-audio-element')).toHaveAttribute('preload', 'metadata');
  });

  it('does not eagerly preload signed Google Storage answer audio', () => {
    const signedUrl =
      'https://storage.googleapis.com/convolab-storage/study-media/card/answer.mp3?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Expires=300&X-Goog-Signature=abc';

    render(
      <StudyCardFace
        side="back"
        layout="mobile-focus"
        card={withAnswerAudio('answer.mp3', signedUrl)}
      />
    );

    expect(screen.getByTestId('study-answer-audio-element')).toHaveAttribute('preload', 'none');
  });

  it('shows a visible audio playback error when playback fails', async () => {
    const playMock = vi.fn().mockRejectedValueOnce(new Error('blocked'));
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: playMock,
    });

    render(
      <StudyCardFace
        side="front"
        card={{
          ...baseCard,
          prompt: {
            cueAudio: {
              filename: 'prompt.mp3',
              url: 'https://example.com/prompt.mp3',
              mediaKind: 'audio',
              source: 'imported',
            },
          },
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Replay prompt audio' }));

    expect(await screen.findByText('Audio playback failed. Try again.')).toBeInTheDocument();
  });

  it('restarts card audio from the beginning on every play button click', async () => {
    const playMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: playMock,
    });

    render(
      <StudyCardFace
        side="front"
        card={{
          ...baseCard,
          prompt: {
            cueAudio: {
              filename: 'prompt.mp3',
              url: 'https://example.com/prompt.mp3',
              mediaKind: 'audio',
              source: 'imported',
            },
          },
        }}
      />
    );

    const button = screen.getByRole('button', { name: 'Replay prompt audio' });
    const audio = screen.getByTestId('study-prompt-audio-element') as HTMLAudioElement;

    fireEvent.click(button);
    await waitFor(() => expect(playMock).toHaveBeenCalledTimes(1));

    audio.currentTime = 4;
    fireEvent.click(button);

    await waitFor(() => expect(playMock).toHaveBeenCalledTimes(2));
    expect(audio.currentTime).toBe(0);
  });

  it('does not pause already-paused audio before replaying it', async () => {
    const playMock = vi.fn().mockResolvedValue(undefined);
    const pauseMock = vi.fn();
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: playMock,
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      value: pauseMock,
    });

    render(
      <StudyCardFace
        side="front"
        card={{
          ...baseCard,
          prompt: {
            cueAudio: {
              filename: 'prompt.mp3',
              url: 'https://example.com/prompt.mp3',
              mediaKind: 'audio',
              source: 'imported',
            },
          },
        }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Replay prompt audio' }));

    await waitFor(() => expect(playMock).toHaveBeenCalledTimes(1));
    expect(pauseMock).not.toHaveBeenCalled();
  });

  it('still plays when mobile browsers reject an early seek', async () => {
    const playMock = vi.fn().mockResolvedValue(undefined);
    const pauseMock = vi.fn();
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: playMock,
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      value: pauseMock,
    });

    render(
      <StudyCardFace
        side="front"
        card={{
          ...baseCard,
          prompt: {
            cueAudio: {
              filename: 'prompt.mp3',
              url: 'https://example.com/prompt.mp3',
              mediaKind: 'audio',
              source: 'imported',
            },
          },
        }}
      />
    );

    const audio = screen.getByTestId('study-prompt-audio-element') as HTMLAudioElement;
    Object.defineProperty(audio, 'currentTime', {
      configurable: true,
      get: () => 0,
      set: () => {
        throw new DOMException('Cannot seek before metadata is loaded.', 'InvalidStateError');
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Replay prompt audio' }));

    await waitFor(() => expect(playMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByText('Audio playback failed. Try again.')).not.toBeInTheDocument();
  });

  it('stops card audio even when mobile browsers reject an early seek', () => {
    const promptAudioRef = createRef<AudioPlayerHandle>();

    render(
      <StudyCardFace
        side="front"
        promptAudioRef={promptAudioRef}
        card={{
          ...baseCard,
          prompt: {
            cueAudio: {
              filename: 'prompt.mp3',
              url: 'https://example.com/prompt.mp3',
              mediaKind: 'audio',
              source: 'imported',
            },
          },
        }}
      />
    );

    const audio = screen.getByTestId('study-prompt-audio-element') as HTMLAudioElement;
    Object.defineProperty(audio, 'currentTime', {
      configurable: true,
      get: () => 0,
      set: () => {
        throw new DOMException('Cannot seek before metadata is loaded.', 'InvalidStateError');
      },
    });

    expect(() => promptAudioRef.current?.stop()).not.toThrow();
  });

  it('ignores a stale interrupted play request after a newer replay succeeds', async () => {
    const originalPlayDescriptor = Object.getOwnPropertyDescriptor(
      HTMLMediaElement.prototype,
      'play'
    );
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const firstPlay = createDeferred<void>();
    const playMock = vi
      .fn()
      .mockReturnValueOnce(firstPlay.promise)
      .mockResolvedValueOnce(undefined);

    try {
      Object.defineProperty(HTMLMediaElement.prototype, 'play', {
        configurable: true,
        value: playMock,
      });

      render(
        <StudyCardFace
          side="front"
          card={{
            ...baseCard,
            prompt: {
              cueAudio: {
                filename: 'prompt.mp3',
                url: 'https://example.com/prompt.mp3',
                mediaKind: 'audio',
                source: 'imported',
              },
            },
          }}
        />
      );

      const button = screen.getByRole('button', { name: 'Replay prompt audio' });
      fireEvent.click(button);
      fireEvent.click(button);

      await waitFor(() => expect(playMock).toHaveBeenCalledTimes(2));
      firstPlay.reject(
        new DOMException('The play() request was interrupted by a call to pause().', 'AbortError')
      );
      await firstPlay.promise.catch(() => undefined);

      await waitFor(() => expect(consoleErrorSpy).not.toHaveBeenCalled());
      expect(screen.queryByText('Audio playback failed. Try again.')).not.toBeInTheDocument();
    } finally {
      consoleErrorSpy.mockRestore();
      if (originalPlayDescriptor) {
        Object.defineProperty(HTMLMediaElement.prototype, 'play', originalPlayDescriptor);
      }
    }
  });

  it('ignores interrupted audio play requests without surfacing an error', async () => {
    const originalPlayDescriptor = Object.getOwnPropertyDescriptor(
      HTMLMediaElement.prototype,
      'play'
    );
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const abortError = new DOMException(
        'The play() request was interrupted by a call to pause().',
        'AbortError'
      );
      const playMock = vi.fn().mockRejectedValueOnce(abortError);
      Object.defineProperty(HTMLMediaElement.prototype, 'play', {
        configurable: true,
        value: playMock,
      });

      render(
        <StudyCardFace
          side="front"
          card={{
            ...baseCard,
            prompt: {
              cueAudio: {
                filename: 'prompt.mp3',
                url: 'https://example.com/prompt.mp3',
                mediaKind: 'audio',
                source: 'imported',
              },
            },
          }}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Replay prompt audio' }));

      await waitFor(() => expect(playMock).toHaveBeenCalled());

      expect(screen.queryByText('Audio playback failed. Try again.')).not.toBeInTheDocument();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
      if (originalPlayDescriptor) {
        Object.defineProperty(HTMLMediaElement.prototype, 'play', originalPlayDescriptor);
      }
    }
  });
});
