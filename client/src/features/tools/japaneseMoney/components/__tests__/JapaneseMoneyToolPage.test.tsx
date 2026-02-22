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
    expect(screen.getByTestId('money-reading-kana')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /go to previous amount/i }));
    expect(screen.getByRole('button', { name: /show answer/i })).toBeInTheDocument();
    expect(screen.getByTestId('money-total-amount').textContent).toBe(initialAmount);
  });

  it('changes tier and constrains generated amount to selected band', () => {
    render(<JapaneseMoneyToolPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Use amount tier < 10,000' }));

    const defaultTierButton = screen.getByRole('button', { name: 'Use amount tier < 1,000' });
    const selectedButton = screen.getByRole('button', { name: 'Use amount tier < 10,000' });
    expect(defaultTierButton).toHaveAttribute('aria-pressed', 'true');
    expect(selectedButton).toHaveAttribute('aria-pressed', 'true');

    const amount = parseDisplayedAmount();
    expect(amount).toBeGreaterThanOrEqual(1);
    expect(amount).toBeLessThan(10000);
  });

  it('allows deselecting a tier while keeping at least one tier selected', () => {
    render(<JapaneseMoneyToolPage />);

    const lt1kButton = screen.getByRole('button', { name: 'Use amount tier < 1,000' });
    const lt10kButton = screen.getByRole('button', { name: 'Use amount tier < 10,000' });

    fireEvent.click(lt10kButton);
    fireEvent.click(lt1kButton);

    expect(lt1kButton).toHaveAttribute('aria-pressed', 'false');
    expect(lt10kButton).toHaveAttribute('aria-pressed', 'true');

    const amount = parseDisplayedAmount();
    expect(amount).toBeGreaterThanOrEqual(1000);
    expect(amount).toBeLessThan(10000);
  });

  it('supports keyboard next and previous navigation', () => {
    render(<JapaneseMoneyToolPage />);

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByTestId('money-reading-kana')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(
      screen.getByText(/to reveal the japanese reading\./i, {
        selector: '.retro-money-reading-placeholder',
      })
    ).toBeInTheDocument();
  });

  it('ignores repeated right-arrow keydown events', () => {
    render(<JapaneseMoneyToolPage />);

    const initialAmount = screen.getByTestId('money-total-amount').textContent;
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowRight', repeat: true });

    expect(screen.getByTestId('money-reading-kana')).toBeInTheDocument();
    expect(screen.getByTestId('money-total-amount').textContent).toBe(initialAmount);
  });

  it('does not show the removed YODOCAM kana subtitle text', () => {
    render(<JapaneseMoneyToolPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Use amount tier < 100,000' }));

    expect(screen.queryByText('よどかむ ぷらざ')).not.toBeInTheDocument();
  });

  it('does not render separate reading title or furigana toggle button', () => {
    render(<JapaneseMoneyToolPage />);

    expect(screen.queryByRole('heading', { name: 'Japanese Reading' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /hide furigana/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /show furigana/i })).not.toBeInTheDocument();
  });
});
