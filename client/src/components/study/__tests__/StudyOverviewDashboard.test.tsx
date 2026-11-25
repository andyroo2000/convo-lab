import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import estimateReviewMinutes, {
  calendarDayLabel,
  reviewEstimateLabel,
} from '../../../utils/studyTodayPresentation';
import StudyOverviewDashboard from '../StudyOverviewDashboard';

vi.mock('../../../hooks/useStudyPiles', () => ({
  useStudyPiles: () => ({ data: { piles: [] }, isLoading: false, isError: false }),
}));

vi.mock('../../../pages/DailyAudioPracticePage', () => ({
  default: () => <section aria-label="Daily Audio" />,
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
    displayStatus: 'Ready to learn',
    displaySummary:
      'Recent recall is 91% against a 90% target. 12 Apprentice cards need reinforcement, with 83 reviews projected over seven days.',
  },
  masterySpread: {
    apprentice: 12,
    guru: 8,
    master: 4,
    enlightened: 2,
    burned: 1,
  },
};

describe('StudyOverviewDashboard', () => {
  it('estimates a whole-number review duration', () => {
    expect(estimateReviewMinutes(14)).toBe(6);
    expect(estimateReviewMinutes(74)).toBe(29);
    expect(estimateReviewMinutes(0)).toBeNull();
  });

  it('formats short estimates in minutes and rounds longer estimates to half hours', () => {
    expect(reviewEstimateLabel(1, 'en').duration).toBe('1 minute');
    expect(reviewEstimateLabel(59, 'en').duration).toBe('59 minutes');
    expect(reviewEstimateLabel(60, 'en').key).toBe('overview.reviewHour');
    expect(reviewEstimateLabel(100, 'en').key).toBe('overview.reviewHourAndHalf');
    expect(reviewEstimateLabel(105, 'en').duration).toBe('2 hours');
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
          reviewAvailableCount={259}
          loading={false}
          error={null}
          onBeginReview={onBeginReview}
          onBeginLesson={onBeginLesson}
          isStartingSession={false}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('region', { name: 'Daily Audio' })).toBeVisible();
    expect(screen.getByText('About an hour and a half')).toBeVisible();
    expect(screen.queryByRole('link', { name: /WaniKani/ })).toBeNull();
    expect(screen.queryByText('Item spread')).toBeNull();
    const reviewsButton = screen.getByRole('button', { name: 'Start review' });
    const lessonsButton = screen.getByRole('button', { name: 'Start lesson' });
    expect(reviewsButton).toHaveAccessibleDescription('259 cards due About an hour and a half');
    expect(screen.getByRole('link', { name: /View queue/ })).toHaveAttribute(
      'href',
      '/app/study/cards'
    );
    expect(screen.getByRole('link', { name: 'Manage piles' })).toBeVisible();
    fireEvent.click(reviewsButton);
    fireEvent.click(lessonsButton);
    expect(onBeginReview).toHaveBeenCalledOnce();
    expect(onBeginLesson).toHaveBeenCalledOnce();
  });
});
