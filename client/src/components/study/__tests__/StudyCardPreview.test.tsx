import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StudyCardFace } from '../StudyCardPreview';
import { defineNavigatorValue } from '../../../test/utils';

const { useStudyPitchAccentMock } = vi.hoisted(() => ({
  useStudyPitchAccentMock: vi.fn(),
}));

vi.mock('../../../hooks/useStudyPitchAccent', () => ({
  default: useStudyPitchAccentMock,
}));

const baseCard = {
  id: 'card-1',
  noteId: 'note-1',
  cardType: 'recognition' as const,
  prompt: {
    cueText: '会社',
    cueReading: 'かいしゃ',
    cueMeaning: 'company',
  },
  answer: {
    expression: '会社',
    expressionReading: '会社[かいしゃ]',
    meaning: 'company',
  },
  state: {
    dueAt: new Date('2026-04-12T00:00:00.000Z').toISOString(),
    queueState: 'review' as const,
    scheduler: null,
    source: {},
  },
  answerAudioSource: 'missing' as const,
  createdAt: new Date('2026-04-01T00:00:00.000Z').toISOString(),
  updatedAt: new Date('2026-04-12T00:00:00.000Z').toISOString(),
};

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

describe('StudyCardPreview', () => {
  beforeEach(() => {
    useStudyPitchAccentMock.mockReturnValue({
      pitchAccent: null,
      isLoading: false,
    });
    defineNavigatorValue('connection', undefined);
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('renders furigana as explicit ruby text on the answer side', () => {
    render(<StudyCardFace card={baseCard} side="back" />);

    const heading = screen.getByTestId('study-japanese-heading');
    expect(within(heading).getByText('かいしゃ', { selector: 'rt' })).toBeInTheDocument();
    expect(screen.getByText('company')).toBeInTheDocument();
  });

  it('renders optional answer images on cloze reveal sides', () => {
    render(
      <StudyCardFace
        side="back"
        card={{
          ...baseCard,
          cardType: 'cloze',
          prompt: {
            clozeText: '会社で働く',
            clozeDisplayText: '[...]で働く',
          },
          answer: {
            restoredText: '会社で働く',
            restoredTextReading: '会社[かいしゃ]で働く',
            meaning: 'work at a company',
            answerImage: {
              filename: 'company.webp',
              url: 'https://example.com/company.webp',
              mediaKind: 'image',
              source: 'generated',
            },
          },
        }}
      />
    );

    expect(screen.getByAltText('Answer visual')).toHaveAttribute(
      'src',
      'https://example.com/company.webp'
    );
  });

  it('renders optional prompt images on cloze prompt sides', () => {
    render(
      <StudyCardFace
        side="front"
        card={{
          ...baseCard,
          cardType: 'cloze',
          prompt: {
            clozeText: '会社で{{c1::働く}}',
            clozeDisplayText: '会社で[...]',
            cueMeaning: 'work scene',
            cueImage: {
              filename: 'company-front.webp',
              url: 'https://example.com/company-front.webp',
              mediaKind: 'image',
              source: 'generated',
            },
          },
          answer: {
            restoredText: '会社で働く',
            meaning: 'work at a company',
            answerImage: {
              filename: 'company-back.webp',
              url: 'https://example.com/company-back.webp',
              mediaKind: 'image',
              source: 'generated',
            },
          },
        }}
      />
    );

    expect(screen.getByAltText('work scene')).toHaveAttribute(
      'src',
      'https://example.com/company-front.webp'
    );
  });

  it('renders Anki-style parenthetical furigana without showing raw parentheses', () => {
    render(
      <StudyCardFace
        side="back"
        card={{
          ...baseCard,
          answer: {
            ...baseCard.answer,
            expression: '予定が変わった。',
            expressionReading: '予定(よてい)が変(か)わった。',
            meaning: 'The plans changed.',
          },
        }}
      />
    );

    const heading = screen.getByTestId('study-japanese-heading');
    expect(within(heading).getByText('よてい', { selector: 'rt' })).toBeInTheDocument();
    expect(within(heading).getByText('か', { selector: 'rt' })).toBeInTheDocument();
    expect(screen.queryByText('予定(よてい)が変(か)わった。')).not.toBeInTheDocument();
    expect(screen.getByText('The plans changed.')).toBeInTheDocument();
  });

  it('renders cloze notes with ruby text instead of bracket notation', () => {
    render(
      <StudyCardFace
        side="back"
        card={{
          ...baseCard,
          cardType: 'cloze',
          prompt: {
            clozeDisplayText: 'お風呂に虫[...]！',
            clozeResolvedHint: 'are',
          },
          answer: {
            restoredText: 'お風呂に虫がいる！',
            restoredTextReading: 'お風呂[ふろ]に虫[むし]がいる！',
            meaning: 'There are bugs in the bath!',
            notes: 'お風呂[ふろ]に虫[むし]がいる！',
            answerAudio: {
              filename: 'cloze.mp3',
              url: 'https://example.com/cloze.mp3',
              mediaKind: 'audio',
              source: 'imported',
            },
          },
        }}
      />
    );

    expect(screen.getAllByText('ふろ', { selector: 'rt' })).toHaveLength(2);
    expect(screen.getAllByText('むし', { selector: 'rt' })).toHaveLength(2);
    expect(screen.queryByText('お風呂[ふろ]に虫[むし]がいる！')).not.toBeInTheDocument();
    expect(useStudyPitchAccentMock).toHaveBeenCalledWith(
      expect.objectContaining({ cardType: 'cloze' }),
      true
    );
  });

  it('renders derived cloze blanks instead of raw manual cloze markup', () => {
    render(
      <StudyCardFace
        side="front"
        card={{
          ...baseCard,
          cardType: 'cloze',
          prompt: {
            clozeText: '試合に{{c1::勝ちました}}。',
            clozeDisplayText: '試合に{{c1::勝ちました}}。',
          },
          answer: {
            restoredText: '試合に勝ちました。',
            meaning: 'I won the match.',
          },
        }}
      />
    );

    expect(screen.getByText('試合に[...]。')).toBeInTheDocument();
    expect(screen.queryByText(/{{c1::/)).not.toBeInTheDocument();
  });

  it('keeps helper meaning hidden on media-led prompt cards', () => {
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
            cueImage: {
              filename: 'prompt.png',
              url: 'https://example.com/prompt.png',
              mediaKind: 'image',
              source: 'imported_image',
            },
            cueMeaning: 'hidden helper meaning',
          },
        }}
      />
    );

    expect(screen.getByAltText('Study prompt')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play prompt audio' })).toBeInTheDocument();
    expect(screen.queryByText('hidden helper meaning')).not.toBeInTheDocument();
  });

  it('shows the Japanese part-of-speech label under image-only production prompts', () => {
    render(
      <StudyCardFace
        side="front"
        card={{
          ...baseCard,
          cardType: 'production',
          prompt: {
            cueImage: {
              filename: 'cloudy.png',
              url: 'https://example.com/cloudy.png',
              mediaKind: 'image',
              source: 'generated',
            },
            cueMeaning: '名詞',
          },
        }}
      />
    );

    expect(screen.getByAltText('Study prompt')).toBeInTheDocument();
    expect(screen.getByText('名詞')).toBeInTheDocument();
  });

  it('decodes HTML entities in plain study text fields', () => {
    render(
      <StudyCardFace
        card={{
          ...baseCard,
          answer: {
            ...baseCard.answer,
            meaning: 'Someone, please come. It&#x27;s an accident.',
          },
        }}
        side="back"
      />
    );

    expect(screen.getByText("Someone, please come. It's an accident.")).toBeInTheDocument();
  });

  it('derives the audio MIME type from the answer audio asset', () => {
    render(
      <StudyCardFace
        side="back"
        card={{
          ...baseCard,
          answer: {
            ...baseCard.answer,
            answerAudio: {
              filename: 'answer.ogg',
              url: 'https://example.com/answer.ogg',
              mediaKind: 'audio',
              source: 'generated',
            },
          },
        }}
      />
    );

    expect(screen.getByTestId('study-answer-audio-source')).toHaveAttribute('type', 'audio/ogg');
  });

  it('renders pitch accent diagrams on the answer side only', () => {
    useStudyPitchAccentMock.mockReturnValue({
      pitchAccent: {
        status: 'resolved',
        expression: '会社',
        reading: 'かいしゃ',
        pitchNum: 0,
        morae: ['か', 'い', 'しゃ'],
        pattern: [0, 1, 1],
        patternName: '平板',
        source: 'kanjium',
        resolvedBy: 'local-reading',
      },
      isLoading: false,
    });

    const { rerender } = render(<StudyCardFace card={baseCard} side="front" />);
    expect(screen.queryByTestId('study-pitch-accent-panel')).not.toBeInTheDocument();

    rerender(<StudyCardFace card={baseCard} side="back" />);
    expect(screen.getByTestId('study-pitch-accent-panel')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAccessibleName('Pitch accent for 会社, かいしゃ');
  });

  it('hides unresolved pitch accent data on the answer side', () => {
    useStudyPitchAccentMock.mockReturnValue({
      pitchAccent: {
        status: 'unresolved',
        expression: '日本',
        reason: 'ambiguous-reading',
        source: 'kanjium',
        resolvedBy: 'llm',
      },
      isLoading: false,
    });

    render(<StudyCardFace card={baseCard} side="back" />);

    expect(screen.queryByTestId('study-pitch-accent-panel')).not.toBeInTheDocument();
  });

  it('renders a mobile-focus answer audio replay button while preserving the audio source', () => {
    render(
      <StudyCardFace
        side="back"
        layout="mobile-focus"
        card={{
          ...baseCard,
          answer: {
            ...baseCard.answer,
            answerAudio: {
              filename: 'answer.mp3',
              url: 'https://example.com/answer.mp3',
              mediaKind: 'audio',
              source: 'generated',
            },
          },
        }}
      />
    );

    expect(screen.getByTestId('study-answer-audio-button')).toHaveAccessibleName(
      'Play answer audio'
    );
    const audioSource = screen.getByTestId('study-answer-audio-source');
    expect(audioSource).toHaveAttribute('src', 'https://example.com/answer.mp3');
    expect(screen.getByTestId('study-answer-audio-element')).toHaveAttribute('preload', 'auto');
  });

  it('only preloads answer audio metadata when the browser asks to save data', () => {
    defineNavigatorValue('connection', { saveData: true });

    render(
      <StudyCardFace
        side="back"
        layout="mobile-focus"
        card={{
          ...baseCard,
          answer: {
            ...baseCard.answer,
            answerAudio: {
              filename: 'answer.mp3',
              url: 'https://example.com/answer.mp3',
              mediaKind: 'audio',
              source: 'generated',
            },
          },
        }}
      />
    );

    expect(screen.getByTestId('study-answer-audio-element')).toHaveAttribute('preload', 'metadata');
  });

  it('does not eagerly preload signed Google Storage answer audio', () => {
    const signedUrl =
      'https://storage.googleapis.com/convolab-storage/study-media/card/answer.mp3?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Expires=300&X-Goog-Signature=abc';

    render(
      <StudyCardFace
        side="back"
        layout="mobile-focus"
        card={{
          ...baseCard,
          answer: {
            ...baseCard.answer,
            answerAudio: {
              filename: 'answer.mp3',
              url: signedUrl,
              mediaKind: 'audio',
              source: 'generated',
            },
          },
        }}
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
