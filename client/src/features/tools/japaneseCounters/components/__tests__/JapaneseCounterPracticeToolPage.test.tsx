import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import JapaneseCounterPracticeToolPage from '../JapaneseCounterPracticeToolPage';

vi.mock('../../logic/counterPractice', () => ({
  COUNTER_POOL: [
    { id: 'mai', symbol: '枚', hint: 'flat things' },
    { id: 'hon', symbol: '本', hint: 'long objects' },
    { id: 'hiki', symbol: '匹', hint: 'small animals' },
  ],
  DEFAULT_COUNTER_IDS: ['hon'],
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
    counterId: 'hon',
    counterSymbol: '本',
    counterKana: 'ほん',
    counterHint: 'long objects',
    quantity: 5,
    countScript: '五本',
    countKana: 'ごほん',
    object: {
      id: 'pencil',
      counterId: 'hon',
      script: '鉛筆',
      kana: 'えんぴつ',
      englishLabel: 'pencil',
      illustrationId: 'pencil',
    },
  }),
}));

describe('JapaneseCounterPracticeToolPage', () => {
  it('reveals answer with ruby furigana', () => {
    render(<JapaneseCounterPracticeToolPage />);

    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));

    expect(screen.getByText('えんぴつ')).toBeInTheDocument();
    expect(screen.getByText('ごほん')).toBeInTheDocument();
    expect(screen.getByText('五本')).toBeInTheDocument();
    expect(screen.getByText('を')).toBeInTheDocument();
  });

  it('defaults to long objects and starts with auto-loop off', () => {
    render(<JapaneseCounterPracticeToolPage />);

    expect(screen.getByRole('button', { name: /本/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /枚/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /匹/i })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /auto-loop/i })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('does not allow deselecting all counters', () => {
    render(<JapaneseCounterPracticeToolPage />);

    const longObjects = screen.getByRole('button', { name: /本/i });
    fireEvent.click(longObjects);
    expect(longObjects).toHaveAttribute('aria-pressed', 'true');
  });
});
