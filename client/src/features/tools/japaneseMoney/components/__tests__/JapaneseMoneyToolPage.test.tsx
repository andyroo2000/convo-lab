import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import JapaneseMoneyToolPage from '../JapaneseMoneyToolPage';

const parseDisplayedAmount = (): number => {
  const value = screen.getByTestId('money-total-amount').textContent ?? '';
  return Number.parseInt(value.replace(/[^0-9]/g, ''), 10);
};

describe('JapaneseMoneyToolPage', () => {
  it('defaults to < 1,000 tier and generates amount in range', () => {
    render(<JapaneseMoneyToolPage />);

    const defaultTierButton = screen.getByRole('button', { name: 'Use amount tier < 1,000' });
    expect(defaultTierButton).toHaveAttribute('aria-pressed', 'true');

    const amount = parseDisplayedAmount();
    expect(amount).toBeGreaterThanOrEqual(1);
    expect(amount).toBeLessThan(1000);
  });

  it('reveals reading and supports previous navigation', () => {
    render(<JapaneseMoneyToolPage />);

    const initialAmount = screen.getByTestId('money-total-amount').textContent;

    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));
    expect(screen.getByTestId('money-reading-script')).toBeInTheDocument();
    expect(screen.getByTestId('money-reading-kana')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /go to previous amount/i }));
    expect(screen.getByRole('button', { name: /show answer/i })).toBeInTheDocument();
    expect(screen.getByTestId('money-total-amount').textContent).toBe(initialAmount);
  });

  it('changes tier and constrains generated amount to selected band', () => {
    render(<JapaneseMoneyToolPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Use amount tier < 10,000' }));

    const selectedButton = screen.getByRole('button', { name: 'Use amount tier < 10,000' });
    expect(selectedButton).toHaveAttribute('aria-pressed', 'true');

    const amount = parseDisplayedAmount();
    expect(amount).toBeGreaterThanOrEqual(1000);
    expect(amount).toBeLessThan(10000);
  });

  it('supports keyboard next and previous navigation', () => {
    render(<JapaneseMoneyToolPage />);

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByTestId('money-reading-script')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByText(/press show answer to reveal/i)).toBeInTheDocument();
  });
});
