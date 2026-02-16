import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import JapaneseCounterPracticeToolPage from '../JapaneseCounterPracticeToolPage';

vi.mock('../../logic/counterPractice', () => ({
  COUNTER_POOL: [
    { id: 'mai', symbol: '枚', hint: 'flat things' },
    { id: 'hon', symbol: '本', hint: 'long objects' },
    { id: 'hiki', symbol: '匹', hint: 'small animals' },
  ],
  DEFAULT_COUNTER_IDS: ['mai', 'hon', 'hiki'],
  toggleCounterSelection: (current: string[], counterId: string) => {
    if (current.includes(counterId)) {
      if (current.length > 1) {
        return current.filter((id) => id !== counterId);
      }
      return current;
    }
    return [...current, counterId];
  },
  createCounterPracticeCard: () => ({
    id: 'test-card',
    counterId: 'mai',
    counterSymbol: '枚',
    counterKana: 'まい',
    counterHint: 'flat things',
    quantity: 5,
    countScript: '五枚',
    countKana: 'ごまい',
    object: {
      id: 'paper',
      counterId: 'mai',
      script: '紙',
      kana: 'かみ',
      englishLabel: 'sheet of paper',
      illustrationId: 'paper-sheet',
    },
  }),
}));

describe('JapaneseCounterPracticeToolPage', () => {
  it('reveals answer with ruby furigana', () => {
    render(<JapaneseCounterPracticeToolPage />);

    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));

    expect(screen.getByText('かみ')).toBeInTheDocument();
    expect(screen.getByText('ごまい')).toBeInTheDocument();
    expect(screen.getByText('を')).toBeInTheDocument();
  });

  it('does not allow deselecting all counters', () => {
    render(<JapaneseCounterPracticeToolPage />);

    fireEvent.click(screen.getByRole('button', { name: /枚/i }));
    fireEvent.click(screen.getByRole('button', { name: /本/i }));

    const onlyRemaining = screen.getByRole('button', { name: /匹/i });
    expect(onlyRemaining).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(onlyRemaining);

    expect(onlyRemaining).toHaveAttribute('aria-pressed', 'true');
  });
});
