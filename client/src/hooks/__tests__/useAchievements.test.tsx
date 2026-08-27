import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  AchievementCatalog,
  AchievementProgress,
} from '../../components/study/achievementModel';
import useAchievements from '../useAchievements';

const { getAchievementCatalogMock, getAchievementProgressMock } = vi.hoisted(() => ({
  getAchievementCatalogMock: vi.fn(),
  getAchievementProgressMock: vi.fn(),
}));

vi.mock('../../lib/achievementApi', () => ({
  getAchievementCatalog: getAchievementCatalogMock,
  getAchievementProgress: getAchievementProgressMock,
}));

const catalog: AchievementCatalog = {
  revision: 'achievement-collection-v1',
  presentation: {
    targetVisibleBadgeCount: 3,
    fillWithLockedCandidates: true,
    noDataFallbackTierIds: [],
  },
  families: [],
};

const progress: AchievementProgress = {
  revision: catalog.revision,
  metricValues: { 'reviews.count': 25 },
  awards: [],
};

describe('useAchievements', () => {
  beforeEach(() => {
    getAchievementCatalogMock.mockReset().mockResolvedValue(catalog);
    getAchievementProgressMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the catalog visible, reports degraded progress, and retries successfully', async () => {
    const progressFailure = new Error('Progress service unavailable');
    getAchievementProgressMock.mockRejectedValueOnce(progressFailure).mockResolvedValue(progress);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { result } = renderHook(() => useAchievements());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.catalog).toBe(catalog);
    expect(result.current.progress).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.progressError).toBe(progressFailure);
    expect(consoleError).toHaveBeenCalledWith(
      'Achievement progress could not be loaded.',
      progressFailure
    );

    act(() => result.current.retry());
    expect(result.current.loading).toBe(false);
    expect(result.current.catalog).toBe(catalog);
    await waitFor(() => expect(result.current.progress).toBe(progress));
    expect(result.current.progressError).toBeNull();
    expect(getAchievementCatalogMock).toHaveBeenCalledTimes(2);
    expect(getAchievementProgressMock).toHaveBeenCalledTimes(2);
  });

  it('keeps a compatible achievement snapshot when a later refresh fails', async () => {
    const progressFailure = new Error('Progress service unavailable');
    getAchievementProgressMock
      .mockResolvedValueOnce(progress)
      .mockRejectedValueOnce(progressFailure);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { result } = renderHook(() => useAchievements());

    await waitFor(() => expect(result.current.progress).toBe(progress));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.progressError).toBe(progressFailure));
    expect(result.current.progress).toBe(progress);
  });
});
