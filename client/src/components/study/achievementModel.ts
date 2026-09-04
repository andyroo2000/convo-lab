export interface AchievementAsset {
  path: string;
  width: number;
  height: number;
}

export interface AchievementTier {
  key: string;
  title: string;
  threshold: number;
  earnedDescription: string;
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
  hiddenUntilEarned?: boolean;
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
  awards: AchievementAward[];
}

export interface AchievementAward {
  id: string;
  earnedAt: string;
}

export interface PresentedAchievement {
  id: string;
  family: AchievementFamily;
  tier: AchievementTier;
  earned: boolean;
  earnedAt: string | null;
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
  if (typeof value !== 'object') return invalidContract(message);
  if (value === null) return invalidContract(message);
  if (Array.isArray(value)) return invalidContract(message);
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

const asIsoTimestamp = (value: unknown, message: string) => {
  const timestamp = asString(value, message);
  if (!Number.isFinite(Date.parse(timestamp))) return invalidContract(message);
  return timestamp;
};

const decodeAsset = (value: unknown): AchievementAsset => {
  const record = asRecord(value, 'Achievement asset was invalid.');
  return {
    path: asString(record.path, 'Achievement asset path was invalid.'),
    width: asNonNegativeInteger(record.width, 'Achievement asset width was invalid.'),
    height: asNonNegativeInteger(record.height, 'Achievement asset height was invalid.'),
  };
};

const validateAssetDimensions = (asset: AchievementAsset, size: number) => {
  if (asset.width !== size) {
    invalidContract('Achievement asset dimensions did not match the catalog contract.');
  }
  if (asset.height !== size) {
    invalidContract('Achievement asset dimensions did not match the catalog contract.');
  }
};

const decodeStateAssets = (value: unknown) => {
  const record = asRecord(value, 'Achievement state assets were invalid.');
  const png = asRecord(record.png, 'Achievement PNG assets were invalid.');
  const standard = decodeAsset(png['256']);
  const retina = decodeAsset(png['512']);
  validateAssetDimensions(standard, 256);
  validateAssetDimensions(retina, 512);
  return { png: { '256': standard, '512': retina } };
};

const decodeTier = (value: unknown): AchievementTier => {
  const record = asRecord(value, 'Achievement tier was invalid.');
  const assets = asRecord(record.assets, 'Achievement tier assets were invalid.');
  return {
    key: asString(record.key, 'Achievement tier key was invalid.'),
    title: asString(record.title, 'Achievement tier title was invalid.'),
    threshold: asPositiveInteger(record.threshold, 'Achievement threshold was invalid.'),
    earnedDescription: asString(
      record.earnedDescription,
      'Achievement earned description was invalid.'
    ),
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
    hiddenUntilEarned: record.hiddenUntilEarned === true,
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
  if (!Array.isArray(record.awards)) {
    return invalidContract('Achievement awards were invalid.');
  }
  const awards = record.awards.map((awardValue) => {
    const award = asRecord(awardValue, 'Achievement award was invalid.');
    return {
      id: asString(award.id, 'Achievement award ID was invalid.'),
      earnedAt: asIsoTimestamp(award.earnedAt, 'Achievement award date was invalid.'),
    };
  });
  if (new Set(awards.map(({ id }) => id)).size !== awards.length) {
    return invalidContract('Achievement award IDs were not unique.');
  }
  return {
    revision: asString(record.revision, 'Achievement progress revision was invalid.'),
    metricValues: Object.fromEntries(
      Object.entries(metricValues).map(([key, metricValue]) => [
        key,
        asNonNegativeInteger(metricValue, `Achievement metric ${key} was invalid.`),
      ])
    ),
    awards,
  };
};

const presentAchievement = (
  family: AchievementFamily,
  tier: AchievementTier,
  metricValues: Record<string, number> | null,
  earnedAt: string | null
): PresentedAchievement => {
  const currentValue = metricValues?.[family.metricKey] ?? null;
  return {
    id: `${family.key}.${tier.key}`,
    family,
    tier,
    earned: earnedAt !== null,
    earnedAt,
    currentValue,
    remaining: currentValue === null ? null : Math.max(0, tier.threshold - currentValue),
  };
};

export const allPresentedAchievements = (
  catalog: AchievementCatalog,
  progress: AchievementProgress | null
) => {
  const compatibleProgress = progress?.revision === catalog.revision ? progress : null;
  const metricValues = compatibleProgress?.metricValues ?? null;
  const awardsById = new Map(
    (compatibleProgress?.awards ?? []).map((award) => [award.id, award.earnedAt])
  );
  return catalog.families.flatMap((family) =>
    family.tiers.map((tier) => {
      const id = `${family.key}.${tier.key}`;
      return presentAchievement(family, tier, metricValues, awardsById.get(id) ?? null);
    })
  );
};

export const recentEarnedAchievements = (
  catalog: AchievementCatalog,
  progress: AchievementProgress | null,
  count = catalog.presentation.targetVisibleBadgeCount
): PresentedAchievement[] =>
  allPresentedAchievements(catalog, progress)
    .filter(
      (achievement): achievement is PresentedAchievement & { earnedAt: string } =>
        achievement.earnedAt !== null
    )
    .sort((left, right) => Date.parse(right.earnedAt) - Date.parse(left.earnedAt))
    .slice(0, count);

const visibleAchievementFamilies = (catalog: AchievementCatalog) =>
  catalog.families.filter((family) => !family.hiddenUntilEarned);

const hasVisibleProgress = (
  families: AchievementFamily[],
  progress: AchievementProgress | null
) => {
  if (!progress) return false;
  const metricKeys = new Set(families.map((family) => family.metricKey));
  const tierIds = new Set(
    families.flatMap((family) => family.tiers.map((tier) => `${family.key}.${tier.key}`))
  );
  const hasMetricProgress = Object.entries(progress.metricValues).some(
    ([metricKey, metricValue]) => metricKeys.has(metricKey) && metricValue > 0
  );
  if (hasMetricProgress) return true;
  return progress.awards.some((award) => tierIds.has(award.id));
};

const fallbackAchievements = (
  catalog: AchievementCatalog,
  achievements: PresentedAchievement[],
  count: number
) => {
  const byId = new Map(achievements.map((achievement) => [achievement.id, achievement]));
  return catalog.presentation.noDataFallbackTierIds
    .map((id) => byId.get(id))
    .filter(
      (achievement): achievement is PresentedAchievement =>
        achievement !== undefined && !achievement.family.hiddenUntilEarned
    )
    .slice(0, count);
};

const nextLockedAchievement = (family: AchievementFamily, achievements: PresentedAchievement[]) => {
  const familyAchievements = achievements.filter(
    (achievement) => achievement.family.key === family.key
  );
  let highestEarnedIndex = -1;
  familyAchievements.forEach((achievement, index) => {
    if (achievement.earned) highestEarnedIndex = index;
  });
  return familyAchievements
    .slice(highestEarnedIndex + 1)
    .find((achievement) => !achievement.earned);
};

const compareAchievementProgress = (
  left: PresentedAchievement,
  right: PresentedAchievement,
  achievementOrder: Map<string, number>
) => {
  const leftRatio = (left.currentValue ?? 0) / left.tier.threshold;
  const rightRatio = (right.currentValue ?? 0) / right.tier.threshold;
  const ratioDifference = rightRatio - leftRatio;
  if (ratioDifference !== 0) return ratioDifference;

  const remainingDifference =
    (left.remaining ?? left.tier.threshold) - (right.remaining ?? right.tier.threshold);
  if (remainingDifference !== 0) return remainingDifference;

  return (achievementOrder.get(left.id) ?? 0) - (achievementOrder.get(right.id) ?? 0);
};

export const closestInProgressAchievements = (
  catalog: AchievementCatalog,
  progress: AchievementProgress | null,
  count = catalog.presentation.targetVisibleBadgeCount
): PresentedAchievement[] => {
  const all = allPresentedAchievements(catalog, progress);
  const compatibleProgress = progress?.revision === catalog.revision ? progress : null;
  const visibleFamilies = visibleAchievementFamilies(catalog);

  if (!hasVisibleProgress(visibleFamilies, compatibleProgress)) {
    return fallbackAchievements(catalog, all, count);
  }

  if (!catalog.presentation.fillWithLockedCandidates) return [];

  const achievementOrder = new Map(all.map((achievement, index) => [achievement.id, index]));
  const candidates = visibleFamilies
    .map((family) => nextLockedAchievement(family, all))
    .filter((achievement): achievement is PresentedAchievement => achievement !== undefined)
    .sort((left, right) => compareAchievementProgress(left, right, achievementOrder));

  return candidates.slice(0, count);
};
