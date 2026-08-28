import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import i18n from '../../../i18n';
import { AchievementBadgeCard, StudyAchievementSpotlight } from '../StudyAchievementViews';
import type {
  AchievementCatalog,
  AchievementProgress,
  PresentedAchievement,
} from '../achievementModel';

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

vi.mock('../../../hooks/useAchievements', () => ({
  default: () => achievementState.current,
}));

const achievement = (earned: boolean): PresentedAchievement => ({
  id: 'reviews.card-muncher',
  earned,
  earnedAt: earned ? '2026-01-01T00:00:00.000Z' : null,
  currentValue: earned ? 25 : 23,
  remaining: earned ? 0 : 2,
  family: {
    key: 'reviews',
    title: 'Card Muncher',
    metricKey: 'reviews.count',
    unit: 'reviews',
    tiers: [],
  },
  tier: {
    key: 'card-muncher',
    title: 'Card Muncher',
    threshold: 25,
    earnedDescription: 'Completed 25 reviews',
    description: 'A hungry kaiju discovers its first review cards.',
    assets: {
      earned: {
        png: {
          '256': { path: '/achievement-assets/card-muncher-256.png', width: 256, height: 256 },
          '512': { path: '/achievement-assets/card-muncher-512.png', width: 512, height: 512 },
        },
      },
      locked: {
        png: {
          '256': {
            path: '/achievement-assets/card-muncher-locked-256.png',
            width: 256,
            height: 256,
          },
          '512': {
            path: '/achievement-assets/card-muncher-locked-512.png',
            width: 512,
            height: 512,
          },
        },
      },
    },
  },
});

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('AchievementBadgeCard', () => {
  it('renders the 256 image with its 512 retina source inside the client-owned caption', () => {
    render(<AchievementBadgeCard achievement={achievement(true)} />);

    const image = screen.getByRole('img', {
      name: 'A hungry kaiju discovers its first review cards.',
    });
    expect(image).toHaveAttribute('src', '/achievement-assets/card-muncher-256.png');
    expect(image).toHaveAttribute(
      'srcset',
      '/achievement-assets/card-muncher-256.png 1x, /achievement-assets/card-muncher-512.png 2x'
    );
    expect(image).toHaveAttribute('width', '128');
    expect(image).toHaveAttribute('height', '128');
    expect(screen.getByTestId('achievement-reviews.card-muncher')).toHaveClass('is-earned');
    expect(screen.getByText('Completed 25 reviews')).toBeInTheDocument();
  });

  it('localizes locked progress units while keeping canonical badge names', async () => {
    await i18n.changeLanguage('ja');
    render(<AchievementBadgeCard achievement={achievement(false)} />);

    expect(screen.getByRole('heading', { name: 'Card Muncher' })).toBeInTheDocument();
    expect(screen.getByText('あと2 回のレビュー')).toBeInTheDocument();
    expect(screen.getByTestId('achievement-reviews.card-muncher')).toHaveClass('is-locked');
  });
});

describe('StudyAchievementSpotlight', () => {
  it('shows every earned badge newest first, then the closest in-progress badges', () => {
    const { assets } = achievement(true).tier;
    const catalog: AchievementCatalog = {
      revision: 'catalog-v3',
      presentation: {
        targetVisibleBadgeCount: 2,
        fillWithLockedCandidates: true,
        noDataFallbackTierIds: ['reviews.first', 'voice.first'],
      },
      families: [
        {
          key: 'reviews',
          title: 'Card Muncher',
          metricKey: 'reviews.count',
          unit: 'reviews',
          tiers: [
            ['first', 'First Nibble', 25],
            ['second', 'Big Bite', 100],
            ['third', 'Full Plate', 500],
          ].map(([key, title, threshold]) => ({
            key: String(key),
            title: String(title),
            threshold: Number(threshold),
            earnedDescription: `Completed ${String(threshold)} reviews`,
            description: `Finish ${String(threshold)} reviews.`,
            assets,
          })),
        },
        {
          key: 'voice',
          title: 'Roarer',
          metricKey: 'voice.hours',
          unit: 'hours',
          tiers: [
            ['first', 'First Roar', 10],
            ['second', 'Big Roar', 100],
          ].map(([key, title, threshold]) => ({
            key: String(key),
            title: String(title),
            threshold: Number(threshold),
            earnedDescription: `Spoke for ${String(threshold)} hours`,
            description: `Speak for ${String(threshold)} hours.`,
            assets,
          })),
        },
      ],
    };
    achievementState.current = {
      catalog,
      progress: {
        revision: catalog.revision,
        metricValues: { 'reviews.count': 250, 'voice.hours': 50 },
        awards: [
          { id: 'reviews.first', earnedAt: '2026-01-01T00:00:00.000Z' },
          { id: 'voice.first', earnedAt: '2026-02-01T00:00:00.000Z' },
          { id: 'reviews.second', earnedAt: '2026-03-01T00:00:00.000Z' },
        ],
      },
      loading: false,
      error: null,
      progressError: null,
      retry: vi.fn(),
    };

    render(<StudyAchievementSpotlight />);

    expect(
      screen.getAllByTestId(/^achievement-/).map((badge) => badge.getAttribute('data-testid'))
    ).toEqual([
      'achievement-reviews.second',
      'achievement-voice.first',
      'achievement-reviews.first',
      'achievement-voice.second',
      'achievement-reviews.third',
    ]);
    expect(screen.getByRole('group', { name: 'Next up' })).toContainElement(
      screen.getByTestId('achievement-voice.second')
    );
    expect(screen.queryByText('View all')).not.toBeInTheDocument();
  });
});
