import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StudyCardFace } from '../StudyCardPreview';

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
});
