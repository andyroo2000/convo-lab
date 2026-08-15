import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import WeeklyStudyRecapCard from '../WeeklyStudyRecapCard';

const { recapMock, refetchMock } = vi.hoisted(() => ({ recapMock: vi.fn(), refetchMock: vi.fn() }));

vi.mock('../../../hooks/useWeeklyStudyRecap', () => ({
  useWeeklyStudyRecap: () => recapMock(),
}));

const data = {
  generatedAt: '2026-08-17T12:00:00Z',
  week: {
    startsAt: '2026-08-10T04:00:00Z',
    endsAt: '2026-08-17T04:00:00Z',
    totalMs: 14_400_000,
    activeDays: 5,
    bestDay: { date: '2026-08-12', totalMs: 5_400_000 },
    categories: {
      review: 7_200_000,
      listen: 3_600_000,
      create: 0,
      immerse: 1_800_000,
      conversation: 1_800_000,
      wanikani: 0,
    },
    reviewCount: 180,
    recallRate: 0.93,
    newCardsIntroduced: 25,
  },
  previousWeek: {
    totalMs: 7_200_000,
    activeDays: 3,
    reviewCount: 150,
    recallRate: 0.9,
    newCardsIntroduced: 10,
  },
};

describe('WeeklyStudyRecapCard', () => {
  beforeEach(() => {
    refetchMock.mockReset();
    recapMock.mockReset().mockReturnValue({
      data,
      isLoading: false,
      isError: false,
      refetch: refetchMock,
    });
  });

  it('tells a complete story about the last completed week', () => {
    render(<WeeklyStudyRecapCard />);

    expect(screen.getByRole('heading', { name: 'Your weekly recap' })).toBeInTheDocument();
    expect(screen.getByText('Strong recall anchored your week')).toBeInTheDocument();
    expect(screen.getByText('4h')).toBeInTheDocument();
    expect(screen.getByText('93%')).toBeInTheDocument();
    expect(screen.getByText('180')).toBeInTheDocument();
    expect(screen.getByText('Wednesday, Aug 12')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Study time split by category' })).toBeInTheDocument();
    expect(screen.getByText('+100%')).toBeInTheDocument();
    expect(screen.getByText('+3 pts')).toBeInTheDocument();
  });

  it('uses a baseline label instead of a misleading percentage when prior time is zero', () => {
    recapMock.mockReturnValue({
      data: { ...data, previousWeek: { ...data.previousWeek, totalMs: 0 } },
      isLoading: false,
      isError: false,
      refetch: refetchMock,
    });
    render(<WeeklyStudyRecapCard />);

    expect(screen.getByText('New baseline')).toBeInTheDocument();
    expect(screen.queryByText(/Infinity|NaN/)).not.toBeInTheDocument();
  });

  it('offers a thoughtful empty state for a quiet week', () => {
    recapMock.mockReturnValue({
      data: {
        ...data,
        week: {
          ...data.week,
          totalMs: 0,
          activeDays: 0,
          bestDay: null,
          categories: { review: 0, listen: 0, create: 0, immerse: 0, conversation: 0, wanikani: 0 },
          reviewCount: 0,
          recallRate: null,
          newCardsIntroduced: 0,
        },
      },
      isLoading: false,
      isError: false,
      refetch: refetchMock,
    });
    render(<WeeklyStudyRecapCard />);

    expect(screen.getByText('A quiet week is still part of the story')).toBeInTheDocument();
    expect(screen.queryByText('Where your time went')).not.toBeInTheDocument();
  });

  it('uses a neutral headline when progress has no timed category mix', () => {
    recapMock.mockReturnValue({
      data: {
        ...data,
        week: {
          ...data.week,
          totalMs: 0,
          activeDays: 0,
          recallRate: null,
          categories: { review: 0, listen: 0, create: 0, immerse: 0, conversation: 0, wanikani: 0 },
        },
      },
      isLoading: false,
      isError: false,
      refetch: refetchMock,
    });
    render(<WeeklyStudyRecapCard />);

    expect(screen.getByText('You moved your learning forward')).toBeInTheDocument();
    expect(screen.queryByText('Card review led your week')).not.toBeInTheDocument();
  });

  it('retries a failed recap request', () => {
    recapMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: refetchMock,
    });
    render(<WeeklyStudyRecapCard />);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refetchMock).toHaveBeenCalledOnce();
  });

  it('announces the loading state with an accessible section title', () => {
    recapMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: refetchMock,
    });
    render(<WeeklyStudyRecapCard />);

    expect(screen.getByRole('heading', { name: 'Your weekly recap' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/putting last week/i);
  });
});
