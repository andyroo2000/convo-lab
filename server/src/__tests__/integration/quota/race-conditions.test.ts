import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  checkCooldown,
  checkGenerationLimit,
  setCooldown,
} from '../../../services/usageTracker.js';
import { mockPrisma } from '../../setup.js';

const mockRedis = {
  ttl: vi.fn(),
  setex: vi.fn(),
  disconnect: vi.fn(),
};

vi.mock('../../../config/redis.js', () => ({
  createRedisConnection: () => mockRedis,
}));

describe('Quota concurrency behavior', () => {
  const userId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MONTHLY_GENERATION_LIMIT;
    mockPrisma.user.findUnique.mockResolvedValue({ role: 'user' });
  });

  it('applies the monthly limit to concurrent checks', async () => {
    mockPrisma.generationLog.count
      .mockResolvedValueOnce(29)
      .mockResolvedValueOnce(30)
      .mockResolvedValueOnce(30);

    const checks = await Promise.all([
      checkGenerationLimit(userId, 'dialogue'),
      checkGenerationLimit(userId, 'script'),
      checkGenerationLimit(userId, 'course'),
    ]);

    expect(checks.map((check) => check.allowed)).toEqual([true, false, false]);
    expect(checks.every((check) => check.limit === 30)).toBe(true);
  });

  it('counts every content type in the same monthly window', async () => {
    mockPrisma.generationLog.count.mockResolvedValue(12);

    await checkGenerationLimit(userId, 'course');

    expect(mockPrisma.generationLog.count).toHaveBeenCalledWith({
      where: {
        userId,
        createdAt: { gte: expect.any(Date) },
      },
    });
  });

  it('keeps the cooldown sequence observable', async () => {
    mockRedis.ttl.mockResolvedValue(-2);
    mockRedis.setex.mockResolvedValue('OK');
    mockPrisma.generationLog.count.mockResolvedValue(0);

    expect((await checkCooldown(userId)).active).toBe(false);
    expect((await checkGenerationLimit(userId, 'dialogue')).allowed).toBe(true);
    await setCooldown(userId);

    expect(mockRedis.setex).toHaveBeenCalledWith(`cooldown:generation:${userId}`, 30, '1');
    expect(mockRedis.setex.mock.invocationCallOrder[0]).toBeGreaterThan(
      mockRedis.ttl.mock.invocationCallOrder[0]
    );
  });
});
