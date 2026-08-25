import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import JlptMasteryCard from '../JlptMasteryCard';

const { overviewMock, refetchMock } = vi.hoisted(() => ({
  overviewMock: vi.fn(),
  refetchMock: vi.fn(),
}));

vi.mock('../../../hooks/useStudy', () => ({
  useStudyOverview: (...parameters: unknown[]) => overviewMock(...parameters),
}));

const mastery = {
  N5: {
    vocabulary: {
      masteryPercent: 76,
      known: 560,
      knownFromCards: 522,
      knownFromWaniKani: 110,
      knownFromBoth: 72,
      matched: 554,
      covered: 554,
      total: 684,
    },
    grammar: {
      masteryPercent: 99,
      known: 76,
      knownFromCards: 76,
      knownFromWaniKani: 0,
      knownFromBoth: 0,
      matched: 77,
      covered: 77,
      total: 77,
    },
  },
};

const setOverview = (overrides = {}) =>
  overviewMock.mockReturnValue({
    data: { jlptMastery: mastery },
    isLoading: false,
    isError: false,
    refetch: refetchMock,
    ...overrides,
  });

describe('JlptMasteryCard', () => {
  beforeEach(() => {
    overviewMock.mockReset();
    refetchMock.mockReset();
    setOverview();
  });

  it('shows separate N5 vocabulary and grammar mastery from a fresh overview', () => {
    render(<JlptMasteryCard />);

    expect(overviewMock).toHaveBeenCalledWith(true, 'always');
    expect(screen.getByRole('heading', { name: 'JLPT N5 Mastery' })).toBeInTheDocument();

    expect(screen.getByRole('progressbar', { name: 'Vocabulary mastery' })).toHaveAttribute(
      'aria-valuenow',
      '76'
    );
    expect(screen.getByRole('progressbar', { name: 'Grammar mastery' })).toHaveAttribute(
      'aria-valuenow',
      '99'
    );
    expect(screen.getByText('560 of 684')).toBeInTheDocument();
    expect(screen.getByText('522')).toBeInTheDocument();
    expect(screen.getByText('110')).toBeInTheDocument();
    expect(screen.getByText('72')).toBeInTheDocument();
    expect(screen.getByText('From ConvoLab cards')).toBeInTheDocument();
    expect(screen.getByText('From WaniKani')).toBeInTheDocument();
    expect(screen.getByText('Counted in both')).toBeInTheDocument();
    expect(screen.getByText('554 of 684')).toBeInTheDocument();
    expect(screen.getByText('76 of 77')).toBeInTheDocument();
    expect(screen.getByText('77 of 77')).toBeInTheDocument();
  });

  it('clamps inconsistent legacy values and falls back to covered for matched', () => {
    setOverview({
      data: {
        jlptMastery: {
          N5: {
            ...mastery.N5,
            vocabulary: {
              masteryPercent: 140,
              known: 120,
              covered: 110,
              total: 100,
            },
          },
        },
      },
    });

    render(<JlptMasteryCard />);

    const progress = screen.getByRole('progressbar', { name: 'Vocabulary mastery' });
    expect(progress).toHaveAttribute('aria-valuenow', '100');
    const vocabulary = screen.getAllByRole('article')[0];
    expect(within(vocabulary).getAllByText('100 of 100')).toHaveLength(2);
  });

  it('retries a failed overview request', () => {
    setOverview({ data: undefined, isError: true });
    render(<JlptMasteryCard />);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetchMock).toHaveBeenCalledOnce();
  });

  it('announces loading and handles an unavailable mastery estimate', () => {
    setOverview({ data: undefined, isLoading: true });
    const view = render(<JlptMasteryCard />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading your mastery estimate');

    setOverview({ data: {} });
    view.rerender(<JlptMasteryCard />);
    expect(screen.getByText('A mastery estimate isn’t available yet.')).toBeInTheDocument();
  });
});
