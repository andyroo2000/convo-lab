import type { Prisma } from '@prisma/client';

export const CLIENT_FEATURE_FLAG_SELECT = {
  id: true,
  dialoguesEnabled: true,
  scriptsEnabled: true,
  audioCourseEnabled: true,
  flashcardsEnabled: true,
  updatedAt: true,
} satisfies Prisma.FeatureFlagSelect;

export const DEFAULT_CLIENT_FEATURE_FLAGS = {
  dialoguesEnabled: true,
  scriptsEnabled: true,
  audioCourseEnabled: true,
  flashcardsEnabled: true,
} satisfies Prisma.FeatureFlagCreateInput;
