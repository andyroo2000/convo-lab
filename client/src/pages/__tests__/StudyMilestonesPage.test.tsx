import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  AchievementAsset,
  AchievementCatalog,
  AchievementProgress,
} from '../../components/study/achievementModel';
import i18n from '../../i18n';
import StudyMilestonesPage from '../StudyMilestonesPage';

const { achievementState } = vi.hoisted(() => ({
  achievementState: {
    current: {} as {
      catalog: AchievementCatalog | null;
      progress: AchievementProgress | null;
      loading: boolean;
      error: Error | null;
      progressError: Error | null;
      retry: ReturnType<typeof vi.fn>;
    },
  },
}));

vi.mock('../../hooks/useAchievements', () => ({
  default: () => achievementState.current,
}));

const asset = (size: 256 | 512): AchievementAsset => ({
  path: `/achievement-assets/test-${String(size)}.png`,
  width: size,
  height: size,
});

const catalog: AchievementCatalog = {
  revision: 'catalog-v2',
  presentation: {
    targetVisibleBadgeCount: 1,
    fillWithLockedCandidates: true,
    noDataFallbackTierIds: ['reviews.first'],
  },
  families: [
    {
      key: 'reviews',
      title: 'Card Muncher',
      metricKey: 'reviews.count',
      unit: 'reviews',
      tiers: [
        {
          key: 'first',
          title: 'First Nibble',
          threshold: 25,
          earnedDescription: 'Completed 25 reviews',
          description: 'Finish 25 reviews.',
          assets: {
            earned: { png: { '256': asset(256), '512': asset(512) } },
            locked: { png: { '256': asset(256), '512': asset(512) } },
          },
        },
        {
          key: 'second',
          title: 'Big Bite',
          threshold: 100,
          earnedDescription: 'Completed 100 reviews',
          description: 'Finish 100 reviews.',
          assets: {
            earned: { png: { '256': asset(256), '512': asset(512) } },
            locked: { png: { '256': asset(256), '512': asset(512) } },
          },
        },
      ],
    },
  ],
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <StudyMilestonesPage />
    </MemoryRouter>
  );

beforeEach(async () => {
  await i18n.changeLanguage('en');
  achievementState.current = {
    catalog,
    progress: { revision: catalog.revision, metricValues: { 'reviews.count': 12 }, awards: [] },
    loading: false,
    error: null,
    progressError: null,
    retry: vi.fn(),
  };
});

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('StudyMilestonesPage', () => {
  it('toggles to earned badges and ignores progress from a mismatched catalog revision', async () => {
    achievementState.current.progress = {
      revision: 'catalog-v1',
      metricValues: { 'reviews.count': 88 },
      awards: [{ id: 'reviews.first', earnedAt: '2026-01-01T00:00:00.000Z' }],
    };
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Earned' }));

    expect(screen.getByText('Your earned badges will appear here.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'First Nibble' })).not.toBeInTheDocument();
  });

  it('shows every earned badge newest first', async () => {
    achievementState.current.progress = {
      revision: catalog.revision,
      metricValues: { 'reviews.count': 100 },
      awards: [
        { id: 'reviews.first', earnedAt: '2026-01-01T00:00:00.000Z' },
        { id: 'reviews.second', earnedAt: '2026-02-01T00:00:00.000Z' },
      ],
    };
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: 'Earned' }));

    expect(
      screen.getAllByTestId(/^achievement-/).map((badge) => badge.getAttribute('data-testid'))
    ).toEqual(['achievement-reviews.second', 'achievement-reviews.first']);
  });

  it('keeps fallback badges visible and retries after a progress-only failure', () => {
    achievementState.current.progress = null;
    achievementState.current.progressError = new Error('offline');
    renderPage();

    expect(
      screen.getByText('Your badges are here, but current progress could not be refreshed.')
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'First Nibble' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(achievementState.current.retry).toHaveBeenCalledOnce();
  });
});
