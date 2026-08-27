import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import i18n from '../../../i18n';
import { AchievementBadgeCard } from '../StudyAchievementViews';
import type { PresentedAchievement } from '../achievementModel';

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
