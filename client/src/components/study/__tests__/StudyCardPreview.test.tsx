import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StudyCardFace } from '../StudyCardPreview';

const defineNavigatorValue = (key: string, value: unknown) => {
  Object.defineProperty(window.navigator, key, {
    configurable: true,
    value,
  });
};

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

describe('StudyCardPreview', () => {
  beforeEach(() => {
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
});
