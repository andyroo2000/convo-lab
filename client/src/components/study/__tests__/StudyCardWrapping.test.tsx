import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { StudyCardSummary } from '@languageflow/shared/src/types';

import { StudyCardFace } from '../StudyCardPreview';

const expression =
  '机はどのように並べましょうか？縦に3つ、横に4つ並べてください。はい。あ、このクラスは13人ですから、もう一つ窓側に足しましょう。はい、わかりました。';
const reading =
  '机[つくえ]はどのように並[なら]べましょうか？縦[たて]に3つ、横[よこ]に4つ並[なら]べてください。はい。あ、このクラスは13人[にん]ですから、もう一[ひと]つ窓側[まどがわ]に足[た]しましょう。はい、わかりました。';

const card: StudyCardSummary = {
  id: 'long-dialogue',
  noteId: 'long-dialogue-note',
  cardType: 'recognition',
  prompt: { cueText: expression, cueReading: reading },
  answer: { expression, expressionReading: reading, meaning: 'Arrange the classroom desks.' },
  state: { dueAt: null, queueState: 'new', scheduler: null, source: {} },
  answerAudioSource: 'missing',
  createdAt: '2026-09-27T00:00:00.000Z',
  updatedAt: '2026-09-27T00:00:00.000Z',
};

const cases = [
  { name: 'reading prompt', card, side: 'front' as const, testId: 'study-front-heading' },
  {
    name: 'listening answer',
    card: { ...card, prompt: {} },
    side: 'back' as const,
    testId: 'study-japanese-heading',
  },
  {
    name: 'cloze answer',
    card: {
      ...card,
      cardType: 'cloze' as const,
      answer: { restoredText: expression, restoredTextReading: reading },
    },
    side: 'back' as const,
    testId: 'study-cloze-heading',
  },
];

describe.each(['default', 'mobile-focus'] as const)('Study card wrapping (%s layout)', (layout) => {
  it.each(cases)('keeps the complete $name readable at every breakpoint', (example) => {
    render(<StudyCardFace card={example.card} side={example.side} layout={layout} />);

    const heading = screen.getByTestId(example.testId);
    expect(heading).toHaveTextContent('はい、わかりました。');
    expect(heading).toHaveClass('whitespace-normal', 'break-words', 'max-w-full', 'min-w-0');
    expect(heading.className).not.toMatch(/(?:^|\s)(?:\S+:)?whitespace-nowrap(?:\s|$)/);
  });

  it('also wraps answers without furigana', () => {
    render(
      <StudyCardFace
        card={{ ...card, prompt: {}, answer: { expression } }}
        side="back"
        layout={layout}
      />
    );

    const heading = screen.getByText(expression);
    expect(heading).toHaveClass('whitespace-normal', 'break-words');
    expect(heading.className).not.toMatch(/(?:^|\s)(?:\S+:)?whitespace-nowrap(?:\s|$)/);
  });
});
