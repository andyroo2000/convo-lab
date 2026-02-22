import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import JapaneseVerbConjugationToolPage from '../JapaneseVerbConjugationToolPage';

const verbConjugationMocks = vi.hoisted(() => {
  const makeCard = (overrides: Record<string, unknown> = {}) => ({
    id: 'test-verb-card',
    verb: {
      id: 'miru',
      dictionary: '見る',
      reading: 'みる',
      meaning: 'to see; to watch',
      jlptLevel: 'N5',
      group: '2',
    },
    conjugation: {
      id: 'potential-colloquial',
      label: 'Potential (Colloquial)',
      conjugationBadge: 'potential',
      registers: ['spoken', 'colloquial'],
      promptHint: 'Use the colloquial ら抜き potential form on this card.',
    },
    answer: {
      script: '見れる',
      reading: 'みれる',
    },
    referenceAnswer: {
      script: '見られる',
      reading: 'みられる',
    },
    ...overrides,
  });

  const state: { card: ReturnType<typeof makeCard> | null } = {
    card: makeCard(),
  };

  const createCard = vi.fn(() => state.card);

  return {
    makeCard,
    state,
    createCard,
  };
});

vi.mock('../../logic/verbConjugation', () => ({
  CONJUGATION_BADGE_LABELS: {
    present: 'Present',
    past: 'Past',
    'te-form': 'Te-form',
    negative: 'Negative',
    potential: 'Potential',
  },
  REGISTER_BADGE_LABELS: {
    formal: 'Formal',
    casual: 'Casual',
    spoken: 'Spoken',
    colloquial: 'Colloquial',
  },
  JLPT_LEVEL_OPTIONS: ['N5', 'N4'],
  VERB_GROUP_OPTIONS: ['1', '2', '3'],
  VERB_CONJUGATION_OPTIONS: [
    {
      id: 'present-polite',
      label: 'Present Polite',
      registers: ['formal'],
      conjugationBadge: 'present',
    },
    {
      id: 'potential-colloquial',
      label: 'Potential (Colloquial)',
      registers: ['spoken', 'colloquial'],
      conjugationBadge: 'potential',
      promptHint: 'Use the colloquial ら抜き potential form on this card.',
    },
  ],
  DEFAULT_JLPT_LEVELS: ['N5'],
  DEFAULT_VERB_GROUPS: ['1', '2', '3'],
  DEFAULT_CONJUGATION_IDS: ['potential-colloquial'],
  toggleSelection: (current: string[], value: string) => {
    if (current.includes(value)) {
      if (current.length === 1) {
        return [...current];
      }
      return current.filter((entry) => entry !== value);
    }

    return [...current, value];
  },
  createVerbPracticeCard: verbConjugationMocks.createCard,
}));

describe('JapaneseVerbConjugationToolPage', () => {
  beforeEach(() => {
    verbConjugationMocks.createCard.mockClear();
    verbConjugationMocks.state.card = verbConjugationMocks.makeCard();
  });

  it('renders card badges and colloquial hint', () => {
    render(<JapaneseVerbConjugationToolPage />);
    const quizCard = screen.getByRole('region', { name: 'Verb conjugation quiz card' });
    const quizCardQueries = within(quizCard);

    expect(quizCardQueries.getByText('Group 2')).toBeInTheDocument();
    expect(quizCardQueries.getByText('N5')).toBeInTheDocument();
    expect(quizCardQueries.getByText('Spoken')).toBeInTheDocument();
    expect(quizCardQueries.getByText('Colloquial')).toBeInTheDocument();
    expect(quizCardQueries.getByText('Potential')).toBeInTheDocument();
    expect(screen.getByTestId('verb-colloquial-hint')).toBeInTheDocument();
  });

  it('reveals answer and textbook reference', () => {
    render(<JapaneseVerbConjugationToolPage />);

    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));

    expect(screen.getByText('れる')).toBeInTheDocument();
    expect(screen.getByText(/Textbook: 見られる/)).toBeInTheDocument();
  });

  it('shows furigana only for kanji and not okurigana', () => {
    render(<JapaneseVerbConjugationToolPage />);

    expect(screen.getAllByText('み')).toHaveLength(1);
    expect(screen.queryByText('みる')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));
    expect(screen.getAllByText('み').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('れる')).toBeInTheDocument();
    expect(screen.queryByText('みれる')).not.toBeInTheDocument();
  });

  it('supports arrow key next and previous navigation', () => {
    render(<JapaneseVerbConjugationToolPage />);

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByRole('button', { name: /advance to the next item/i })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByRole('button', { name: /show answer/i })).toBeInTheDocument();
  });

  it('does not allow deselecting the only active JLPT level', () => {
    render(<JapaneseVerbConjugationToolPage />);

    const n5Button = screen.getByRole('button', { name: 'N5' });
    fireEvent.click(n5Button);

    expect(n5Button).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows an empty state when filters produce no cards', () => {
    verbConjugationMocks.state.card = null;
    render(<JapaneseVerbConjugationToolPage />);

    expect(screen.getByText('No matching cards.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show answer/i })).toBeDisabled();
  });
});
