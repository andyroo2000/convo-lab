export interface AchievementAsset {
  path: string;
  width: number;
  height: number;
}

export interface AchievementTier {
  key: string;
  title: string;
  threshold: number;
  description: string;
  assets: {
    earned: { png: Record<'256' | '512', AchievementAsset> };
    locked: { png: Record<'256' | '512', AchievementAsset> };
  };
}

export interface AchievementFamily {
  key: string;
  title: string;
  metricKey: string;
  unit: string;
  tiers: AchievementTier[];
}

export interface AchievementCatalog {
  revision: string;
  presentation: {
    targetVisibleBadgeCount: number;
    fillWithLockedCandidates: boolean;
    noDataFallbackTierIds: string[];
  };
  families: AchievementFamily[];
}

export interface AchievementProgress {
  revision: string;
  metricValues: Record<string, number>;
}

export interface PresentedAchievement {
  id: string;
  family: AchievementFamily;
  tier: AchievementTier;
  earned: boolean;
  currentValue: number | null;
  remaining: number | null;
}

export class AchievementContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AchievementContractError';
  }
}

const invalidContract = (message: string): never => {
  throw new AchievementContractError(message);
};

const asRecord = (value: unknown, message: string): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return invalidContract(message);
  }
  return value as Record<string, unknown>;
};

const asString = (value: unknown, message: string) => {
  if (typeof value !== 'string' || value.length === 0) return invalidContract(message);
  return value;
};

const asNonNegativeInteger = (value: unknown, message: string) => {
  if (!Number.isSafeInteger(value) || (value as number) < 0) return invalidContract(message);
  return value as number;
};

const asPositiveInteger = (value: unknown, message: string) => {
  const integer = asNonNegativeInteger(value, message);
  if (integer === 0) return invalidContract(message);
  return integer;
};

const decodeAsset = (value: unknown): AchievementAsset => {
  const record = asRecord(value, 'Achievement asset was invalid.');
  return {
    path: asString(record.path, 'Achievement asset path was invalid.'),
    width: asNonNegativeInteger(record.width, 'Achievement asset width was invalid.'),
    height: asNonNegativeInteger(record.height, 'Achievement asset height was invalid.'),
  };
};

const decodeStateAssets = (value: unknown) => {
  const record = asRecord(value, 'Achievement state assets were invalid.');
  const png = asRecord(record.png, 'Achievement PNG assets were invalid.');
  const standard = decodeAsset(png['256']);
  const retina = decodeAsset(png['512']);
  if (
    standard.width !== 256 ||
    standard.height !== 256 ||
    retina.width !== 512 ||
    retina.height !== 512
  ) {
    return invalidContract('Achievement asset dimensions did not match the catalog contract.');
  }
  return { png: { '256': standard, '512': retina } };
};

const decodeTier = (value: unknown): AchievementTier => {
  const record = asRecord(value, 'Achievement tier was invalid.');
  const assets = asRecord(record.assets, 'Achievement tier assets were invalid.');
  return {
    key: asString(record.key, 'Achievement tier key was invalid.'),
    title: asString(record.title, 'Achievement tier title was invalid.'),
    threshold: asPositiveInteger(record.threshold, 'Achievement threshold was invalid.'),
    description: asString(record.description, 'Achievement description was invalid.'),
    assets: {
      earned: decodeStateAssets(assets.earned),
      locked: decodeStateAssets(assets.locked),
    },
  };
};

const decodeFamily = (value: unknown): AchievementFamily => {
  const record = asRecord(value, 'Achievement family was invalid.');
  if (!Array.isArray(record.tiers) || record.tiers.length === 0) {
    return invalidContract('Achievement family tiers were invalid.');
  }
  const tiers = record.tiers.map(decodeTier);
  if (tiers.some((tier, index) => index > 0 && tier.threshold <= tiers[index - 1].threshold)) {
    return invalidContract('Achievement family thresholds were not strictly increasing.');
  }
  if (new Set(tiers.map(({ key }) => key)).size !== tiers.length) {
    return invalidContract('Achievement tier keys were not unique within their family.');
  }
  return {
    key: asString(record.key, 'Achievement family key was invalid.'),
    title: asString(record.title, 'Achievement family title was invalid.'),
    metricKey: asString(record.metricKey, 'Achievement metric key was invalid.'),
    unit: asString(record.unit, 'Achievement unit was invalid.'),
    tiers,
  };
};

export const decodeAchievementCatalog = (value: unknown): AchievementCatalog => {
  const record = asRecord(value, 'Achievement catalog was invalid.');
  const presentation = asRecord(record.presentation, 'Achievement presentation was invalid.');
  if (!Array.isArray(record.families) || !Array.isArray(presentation.noDataFallbackTierIds)) {
    return invalidContract('Achievement catalog collections were invalid.');
  }

  const families = record.families.map(decodeFamily);
  if (new Set(families.map(({ key }) => key)).size !== families.length) {
    return invalidContract('Achievement family keys were not unique.');
  }
  if (new Set(families.map(({ metricKey }) => metricKey)).size !== families.length) {
    return invalidContract('Achievement metric keys were not unique.');
  }

  return {
    revision: asString(record.revision, 'Achievement catalog revision was invalid.'),
    presentation: {
      targetVisibleBadgeCount: asNonNegativeInteger(
        presentation.targetVisibleBadgeCount,
        'Achievement visible count was invalid.'
      ),
      fillWithLockedCandidates: presentation.fillWithLockedCandidates === true,
      noDataFallbackTierIds: presentation.noDataFallbackTierIds.map((id) =>
        asString(id, 'Achievement fallback ID was invalid.')
      ),
    },
    families,
  };
};

export const decodeAchievementProgress = (value: unknown): AchievementProgress => {
  const record = asRecord(value, 'Achievement progress was invalid.');
  const metricValues = asRecord(record.metricValues, 'Achievement metric values were invalid.');
  return {
    revision: asString(record.revision, 'Achievement progress revision was invalid.'),
    metricValues: Object.fromEntries(
      Object.entries(metricValues).map(([key, metricValue]) => [
        key,
        asNonNegativeInteger(metricValue, `Achievement metric ${key} was invalid.`),
      ])
    ),
  };
};

const presentAchievement = (
  family: AchievementFamily,
  tier: AchievementTier,
  metricValues: Record<string, number> | null
): PresentedAchievement => {
  const currentValue = metricValues?.[family.metricKey] ?? null;
  return {
    id: `${family.key}.${tier.key}`,
    family,
    tier,
    earned: currentValue !== null && currentValue >= tier.threshold,
    currentValue,
    remaining: currentValue === null ? null : Math.max(0, tier.threshold - currentValue),
  };
};

export const allPresentedAchievements = (
  catalog: AchievementCatalog,
  progress: AchievementProgress | null
) => {
  const metricValues = progress?.revision === catalog.revision ? progress.metricValues : null;
  return catalog.families.flatMap((family) =>
    family.tiers.map((tier) => presentAchievement(family, tier, metricValues))
  );
};

export const featuredAchievements = (
  catalog: AchievementCatalog,
  progress: AchievementProgress | null
): PresentedAchievement[] => {
  const all = allPresentedAchievements(catalog, progress);
  const count = catalog.presentation.targetVisibleBadgeCount;
  const metricValues = progress?.revision === catalog.revision ? progress.metricValues : null;
  const hasProgress =
    metricValues !== null && Object.values(metricValues).some((metricValue) => metricValue > 0);

  if (!hasProgress) {
    const byId = new Map(all.map((achievement) => [achievement.id, achievement]));
    return catalog.presentation.noDataFallbackTierIds
      .map((id) => byId.get(id))
      .filter((achievement): achievement is PresentedAchievement => achievement !== undefined)
      .slice(0, count);
  }

  const familyOrder = new Map(catalog.families.map((family, index) => [family.key, index]));
  const achievementOrder = new Map(all.map((achievement, index) => [achievement.id, index]));
  const highestEarnedByFamily = catalog.families
    .map((family) =>
      all
        .filter((achievement) => achievement.family.key === family.key && achievement.earned)
        .at(-1)
    )
    .filter((achievement): achievement is PresentedAchievement => achievement !== undefined)
    .sort((left, right) => {
      const leftDepth = left.family.tiers.findIndex(({ key }) => key === left.tier.key);
      const rightDepth = right.family.tiers.findIndex(({ key }) => key === right.tier.key);
      const leftRatio = (left.currentValue ?? 0) / left.tier.threshold;
      const rightRatio = (right.currentValue ?? 0) / right.tier.threshold;
      return (
        rightDepth - leftDepth ||
        rightRatio - leftRatio ||
        (familyOrder.get(left.family.key) ?? 0) - (familyOrder.get(right.family.key) ?? 0)
      );
    });
  const selected = highestEarnedByFamily.slice(0, count);
  const selectedIds = new Set(selected.map(({ id }) => id));
  const candidates = all
    .filter((achievement) => !achievement.earned && !selectedIds.has(achievement.id))
    .sort((left, right) => {
      const leftRatio = (left.currentValue ?? 0) / left.tier.threshold;
      const rightRatio = (right.currentValue ?? 0) / right.tier.threshold;
      return (
        rightRatio - leftRatio ||
        (left.remaining ?? left.tier.threshold) - (right.remaining ?? right.tier.threshold) ||
        (achievementOrder.get(left.id) ?? 0) - (achievementOrder.get(right.id) ?? 0)
      );
    });

  if (catalog.presentation.fillWithLockedCandidates) {
    const familySlots = Math.max(0, count - selected.length);
    const familyFill = candidates.reduce<{
      achievements: PresentedAchievement[];
      representedFamilies: Set<string>;
    }>(
      (fill, candidate) => {
        if (
          fill.achievements.length >= familySlots ||
          fill.representedFamilies.has(candidate.family.key)
        ) {
          return fill;
        }
        return {
          achievements: [...fill.achievements, candidate],
          representedFamilies: new Set([...fill.representedFamilies, candidate.family.key]),
        };
      },
      {
        achievements: [],
        representedFamilies: new Set(selected.map(({ family }) => family.key)),
      }
    );
    selected.push(...familyFill.achievements);
    selected.push(
      ...candidates
        .filter((candidate) => !selected.some(({ id }) => id === candidate.id))
        .slice(0, Math.max(0, count - selected.length))
    );
  }
  return selected.slice(0, count);
};
