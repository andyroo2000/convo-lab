import type { NextFunction, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  requireFeatureFlag,
  resetFeatureFlagCacheForTests,
} from '../../../middleware/featureFlags.js';
import { mockPrisma } from '../../setup.js';

describe('featureFlags middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    resetFeatureFlagCacheForTests();
  });

  it('allows access when the requested feature flag is enabled', async () => {
    mockPrisma.featureFlag.findFirst.mockResolvedValue({
      dialoguesEnabled: true,
      audioCourseEnabled: true,
      flashcardsEnabled: true,
    });

    const middleware = requireFeatureFlag('flashcardsEnabled');
    const next = vi.fn() as NextFunction;

    await middleware({ userId: 'user-1', role: 'user' } as never, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('blocks non-admin users when the requested feature flag is disabled', async () => {
    mockPrisma.featureFlag.findFirst.mockResolvedValue({
      dialoguesEnabled: true,
      audioCourseEnabled: true,
      flashcardsEnabled: false,
    });

    const middleware = requireFeatureFlag('flashcardsEnabled');
    const next = vi.fn() as NextFunction;

    await middleware({ userId: 'user-1', role: 'user' } as never, {} as Response, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
      })
    );
  });

  it('fails closed for non-admin users when the feature flag row is missing', async () => {
    mockPrisma.featureFlag.findFirst.mockResolvedValue(null);

    const middleware = requireFeatureFlag('flashcardsEnabled');
    const next = vi.fn() as NextFunction;

    await middleware({ userId: 'user-1', role: 'user' } as never, {} as Response, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
      })
    );
  });

  it('allows admin users to bypass feature flag checks', async () => {
    const middleware = requireFeatureFlag('flashcardsEnabled');
    const next = vi.fn() as NextFunction;

    await middleware({ userId: 'user-1', role: 'admin' } as never, {} as Response, next);

    expect(mockPrisma.featureFlag.findFirst).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });

  it('reuses cached flags inside the TTL window', async () => {
    mockPrisma.featureFlag.findFirst.mockResolvedValue({
      dialoguesEnabled: true,
      audioCourseEnabled: true,
      flashcardsEnabled: true,
    });

    const middleware = requireFeatureFlag('flashcardsEnabled');
    const next = vi.fn() as NextFunction;

    await middleware({ userId: 'user-1', role: 'user' } as never, {} as Response, next);
    await middleware({ userId: 'user-1', role: 'user' } as never, {} as Response, next);

    expect(mockPrisma.featureFlag.findFirst).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it('refreshes the cache after the TTL expires', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-22T12:00:00.000Z'));
    mockPrisma.featureFlag.findFirst
      .mockResolvedValueOnce({
        dialoguesEnabled: true,
        audioCourseEnabled: true,
        flashcardsEnabled: true,
      })
      .mockResolvedValueOnce({
        dialoguesEnabled: true,
        audioCourseEnabled: true,
        flashcardsEnabled: true,
      });

    const middleware = requireFeatureFlag('flashcardsEnabled');
    const next = vi.fn() as NextFunction;

    await middleware({ userId: 'user-1', role: 'user' } as never, {} as Response, next);
    vi.setSystemTime(new Date('2026-04-22T12:00:31.000Z'));
    await middleware({ userId: 'user-1', role: 'user' } as never, {} as Response, next);

    expect(mockPrisma.featureFlag.findFirst).toHaveBeenCalledTimes(2);
  });
});
