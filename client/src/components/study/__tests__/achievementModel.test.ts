import { describe, expect, it } from 'vitest';

import {
  AchievementContractError,
  closestInProgressAchievements,
  decodeAchievementCatalog,
  decodeAchievementProgress,
  recentEarnedAchievements,
  type AchievementAsset,
  type AchievementCatalog,
} from '../achievementModel';

const asset = (size: 256 | 512): AchievementAsset => ({
  path: `/achievement-assets/test-${size}.png`,
  width: size,
  height: size,
});

const catalog = (): AchievementCatalog => ({
  revision: 'achievement-collection-v2',
  presentation: {
    targetVisibleBadgeCount: 3,
    fillWithLockedCandidates: true,
    noDataFallbackTierIds: ['reviews.first', 'voice.first', 'stable.first'],
  },
  families: [
    ['stable', 'Stable', 'stable.count', 'cards'],
    ['reviews', 'Reviews', 'reviews.count', 'reviews'],
    ['voice', 'Voice', 'voice.hours', 'hours'],
  ].map(([key, title, metricKey, unit]) => ({
    key,
    title,
    metricKey,
    unit,
    tiers: [25, 100].map((threshold, index) => ({
      key: index === 0 ? 'first' : 'second',
      title: `${title} ${String(index + 1)}`,
      threshold,
      earnedDescription: `Completed ${String(threshold)} ${unit}`,
      description: `${String(threshold)} ${unit}`,
      assets: {
        earned: { png: { '256': asset(256), '512': asset(512) } },
        locked: { png: { '256': asset(256), '512': asset(512) } },
      },
    })),
  })),
});

describe('achievementModel', () => {
  it('uses the catalog fallback order when progress is unavailable', () => {
    expect(closestInProgressAchievements(catalog(), null).map(({ id }) => id)).toEqual([
      'reviews.first',
      'voice.first',
      'stable.first',
    ]);
  });

  it('shows only locked badges ranked by percentage complete', () => {
    expect(
      closestInProgressAchievements(catalog(), {
        revision: 'achievement-collection-v2',
        metricValues: { 'stable.count': 0, 'reviews.count': 120, 'voice.hours': 20 },
        awards: [
          { id: 'reviews.first', earnedAt: '2026-01-01T00:00:00.000Z' },
          { id: 'reviews.second', earnedAt: '2026-02-01T00:00:00.000Z' },
        ],
      }).map(({ id, earned }) => [id, earned])
    ).toEqual([
      ['voice.first', false],
      ['stable.first', false],
    ]);
  });

  it('returns every earned badge in reverse chronological order', () => {
    expect(
      recentEarnedAchievements(
        catalog(),
        {
          revision: 'achievement-collection-v2',
          metricValues: { 'stable.count': 100, 'reviews.count': 100, 'voice.hours': 100 },
          awards: [
            { id: 'stable.first', earnedAt: '2026-01-01T00:00:00.000Z' },
            { id: 'reviews.second', earnedAt: '2026-03-01T00:00:00.000Z' },
            { id: 'voice.first', earnedAt: '2026-02-01T00:00:00.000Z' },
          ],
        },
        Number.MAX_SAFE_INTEGER
      ).map(({ id }) => id)
    ).toEqual(['reviews.second', 'voice.first', 'stable.first']);
  });

  it('rejects mismatched retina dimensions and progress from malformed metric values', () => {
    const invalidCatalog = structuredClone(catalog()) as unknown as Record<string, unknown>;
    const families = invalidCatalog.families as Array<Record<string, unknown>>;
    const tiers = families[0].tiers as Array<Record<string, unknown>>;
    const assets = tiers[0].assets as Record<string, Record<string, Record<string, unknown>>>;
    (assets.earned.png['512'] as AchievementAsset).width = 256;

    expect(() => decodeAchievementCatalog(invalidCatalog)).toThrow(
      'Achievement asset dimensions did not match'
    );
    expect(() =>
      decodeAchievementProgress({
        revision: 'achievement-collection-v2',
        metricValues: { 'reviews.count': -1 },
        awards: [],
      })
    ).toThrow('Achievement metric reviews.count was invalid');
  });

  it('rejects malformed award dates and duplicate award IDs', () => {
    expect(() =>
      decodeAchievementProgress({
        revision: 'achievement-collection-v2',
        metricValues: {},
        awards: [{ id: 'reviews.first', earnedAt: 'not-a-date' }],
      })
    ).toThrow('Achievement award date was invalid.');

    expect(() =>
      decodeAchievementProgress({
        revision: 'achievement-collection-v2',
        metricValues: {},
        awards: [
          { id: 'reviews.first', earnedAt: '2026-01-01T00:00:00.000Z' },
          { id: 'reviews.first', earnedAt: '2026-02-01T00:00:00.000Z' },
        ],
      })
    ).toThrow('Achievement award IDs were not unique.');
  });

  it('rejects zero and out-of-order tier thresholds as contract errors', () => {
    const invalidCatalog = structuredClone(catalog()) as unknown as Record<string, unknown>;
    const families = invalidCatalog.families as Array<Record<string, unknown>>;
    const tiers = families[0].tiers as Array<Record<string, unknown>>;
    tiers[1].threshold = 25;

    expect(() => decodeAchievementCatalog(invalidCatalog)).toThrow(AchievementContractError);
    expect(() => decodeAchievementCatalog(invalidCatalog)).toThrow(
      'Achievement family thresholds were not strictly increasing.'
    );

    tiers[0].threshold = 0;
    expect(() => decodeAchievementCatalog(invalidCatalog)).toThrow(
      'Achievement threshold was invalid.'
    );
  });
});
