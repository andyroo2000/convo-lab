import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import estimateReviewMinutes, { calendarDayLabel } from '../../../utils/studyTodayPresentation';
import StudyOverviewDashboard from '../StudyOverviewDashboard';

const useKnownKanji = vi.fn();
const useGoogleCalendarConnection = vi.fn();

vi.mock('../../../hooks/useKnownKanji', () => ({
  useKnownKanji: () => useKnownKanji(),
}));

vi.mock('../../../hooks/useGoogleCalendarConnection', () => ({
  useGoogleCalendarConnection: () => useGoogleCalendarConnection(),
}));

const overview = {
  dueCount: 14,
  failedCount: 0,
  totalCards: 6851,
  newCount: 5,
  newCardsAvailableToday: 5,
  learningCount: 12,
  reviewCount: 14,
  suspendedCount: 0,
  learningReadiness: {
    recommendation: 'ready' as const,
    sufficientData: true,
    sampleSize: 30,
    recentRecall: 0.91,
    targetRecall: 0.9,
    dueBacklog: 14,
    apprenticeCount: 12,
    projectedSevenDayReviews: 83,
    medianReviewDurationSeconds: 25,
    suggestedBatchSize: 5,
  },
};

describe('StudyOverviewDashboard', () => {
  beforeEach(() => {
    useKnownKanji.mockReturnValue({
      data: {
        wanikani: {
          connected: true,
          lastSyncedAt: '2026-08-24T12:00:00Z',
          reviewCount: 32,
          reviewCountUpdatedAt: '2026-08-24T12:00:00Z',
        },
      },
    });
    useGoogleCalendarConnection.mockReturnValue({
      data: {
        nextLesson: {
          title: 'iTalki',
          startsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          endsAt: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
        },
      },
    });
  });

  it('estimates a whole-number review duration', () => {
    expect(estimateReviewMinutes(14)).toBe(6);
    expect(estimateReviewMinutes(74)).toBe(29);
    expect(estimateReviewMinutes(0)).toBeNull();
  });

  it('labels calendar lessons across day boundaries', () => {
    const now = new Date(2026, 7, 24, 12);

    expect(calendarDayLabel(new Date(2026, 7, 24, 19), 'en-US', now)).toBe('Today');
    expect(calendarDayLabel(new Date(2026, 7, 25, 19), 'en-US', now)).toBe('Tomorrow');
    expect(calendarDayLabel(new Date(2026, 7, 27, 19), 'en-US', now)).toBe('Aug 27');
  });

  it('puts the study plan and integrations in one place', () => {
    const onBeginReview = vi.fn();
    const onBeginLesson = vi.fn();

    render(
      <MemoryRouter>
        <StudyOverviewDashboard
          overview={overview}
          reviewAvailableCount={14}
          loading={false}
          error={null}
          onBeginReview={onBeginReview}
          onBeginLesson={onBeginLesson}
          isStartingSession={false}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('14 reviews')).toBeInTheDocument();
    expect(screen.getByText('About 6 min')).toBeInTheDocument();
    expect(screen.getByText('5 new cards')).toBeInTheDocument();
    expect(screen.getByText('32 reviews')).toBeInTheDocument();
    expect(screen.getByText('iTalki')).toBeInTheDocument();
    expect(screen.getByText('6,851 cards total')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /WaniKani/ })).toHaveAttribute(
      'href',
      'https://www.wanikani.com/subjects/review'
    );

    const reviewsButton = screen.getByRole('button', { name: 'Reviews' });
    const lessonsButton = screen.getByRole('button', { name: 'Lessons' });
    expect(reviewsButton).toHaveAccessibleDescription('14 reviews About 6 min');
    expect(lessonsButton).toHaveAccessibleDescription('5 new cards');
    fireEvent.click(reviewsButton);
    fireEvent.click(lessonsButton);
    expect(onBeginReview).toHaveBeenCalledOnce();
    expect(onBeginLesson).toHaveBeenCalledOnce();
  });

  it('degrades cleanly while integration summaries are unavailable', () => {
    useKnownKanji.mockReturnValue({ data: { wanikani: { connected: false } } });
    useGoogleCalendarConnection.mockReturnValue({ data: { nextLesson: null } });

    render(
      <MemoryRouter>
        <StudyOverviewDashboard
          overview={overview}
          reviewAvailableCount={14}
          loading={false}
          error={null}
          onBeginReview={vi.fn()}
          onBeginLesson={vi.fn()}
          isStartingSession={false}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Open reviews')).toBeInTheDocument();
    expect(screen.queryByText('Next lesson')).not.toBeInTheDocument();
  });
});
