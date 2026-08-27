import { describe, expect, it } from 'vitest';

import {
  AchievementContractError,
  decodeAchievementCatalog,
  decodeAchievementProgress,
  featuredAchievements,
  type AchievementAsset,
  type AchievementCatalog,
} from '../achievementModel';

const asset = (size: 256 | 512): AchievementAsset => ({
  path: `/achievement-assets/test-${size}.png`,
  width: size,
  height: size,
});

const catalog = (): AchievementCatalog => ({
  revision: 'achievement-collection-v1',
  presentation: {
    targetVisibleBadgeCount: 3,
    fillWithLockedCandidates: true,
    noDataFallbackTierIds: ['reviews.first', 'voice.first', 'stable.first'],
  },
  families: [
    ['stable', 'Stable', 'stable.count', 'cards'],
    ['reviews', 'Reviews', 'reviews.count', 'reviews'],
    ['voice', 'Voice', 'voice.minutes', 'minutes'],
  ].map(([key, title, metricKey, unit]) => ({
    key,
    title,
    metricKey,
    unit,
    tiers: [25, 100].map((threshold, index) => ({
      key: index === 0 ? 'first' : 'second',
      title: `${title} ${String(index + 1)}`,
      threshold,
      description: `${String(threshold)} ${unit}`,
      assets: {
        earned: { png: { '256': asset(256), '512': asset(512) } },
        locked: { png: { '256': asset(256), '512': asset(512) } },
      },
    })),
  })),
});

describe('achievementModel', () => {
  it('uses the catalog fallback order when progress has no meaningful data', () => {
    expect(featuredAchievements(catalog(), null).map(({ id }) => id)).toEqual([
      'reviews.first',
      'voice.first',
      'stable.first',
    ]);
  });

  it('shows the strongest earned tier per family and fills open slots with closest candidates', () => {
    expect(
      featuredAchievements(catalog(), {
        revision: 'achievement-collection-v1',
        metricValues: { 'stable.count': 0, 'reviews.count': 120, 'voice.minutes': 20 },
      }).map(({ id, earned }) => [id, earned])
    ).toEqual([
      ['reviews.second', true],
      ['voice.first', false],
      ['stable.first', false],
    ]);
  });

  it('ranks earned families by tier depth and progress when they outnumber visible slots', () => {
    const crowdedCatalog = catalog();
    const extraFamily = structuredClone(crowdedCatalog.families[0]);
    extraFamily.key = 'extra';
    extraFamily.metricKey = 'extra.count';
    extraFamily.title = 'Extra';
    extraFamily.tiers = extraFamily.tiers.map((tier) => ({
      ...tier,
      title: `Extra ${tier.key}`,
    }));
    crowdedCatalog.families.push(extraFamily);

    expect(
      featuredAchievements(crowdedCatalog, {
        revision: crowdedCatalog.revision,
        metricValues: {
          'stable.count': 25,
          'reviews.count': 120,
          'voice.minutes': 30,
          'extra.count': 500,
        },
      }).map(({ id }) => id)
    ).toEqual(['extra.second', 'reviews.second', 'voice.first']);
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
        revision: 'achievement-collection-v1',
        metricValues: { 'reviews.count': -1 },
      })
    ).toThrow('Achievement metric reviews.count was invalid');
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
