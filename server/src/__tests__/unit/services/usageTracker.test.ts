import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  checkCooldown,
  checkGenerationLimit,
  logGeneration,
  setCooldown,
} from '../../../services/usageTracker.js';

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
  generationLog: {
    count: vi.fn(),
    create: vi.fn(),
  },
}));

const mockRedisClient = vi.hoisted(() => ({
  ttl: vi.fn(),
  setex: vi.fn(),
  disconnect: vi.fn(),
}));

const mockCreateRedisConnection = vi.hoisted(() => vi.fn());
const mockGetMonthStart = vi.hoisted(() => vi.fn());
const mockGetNextMonthStart = vi.hoisted(() => vi.fn());

vi.mock('../../../db/client.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../../config/redis.js', () => ({
  createRedisConnection: mockCreateRedisConnection,
}));

vi.mock('../../../utils/dateUtils.js', () => ({
  getMonthStart: mockGetMonthStart,
  getNextMonthStart: mockGetNextMonthStart,
}));

describe('Usage Tracker Service', () => {
  const userId = 'user-123';
  const monthStart = new Date('2026-01-01T00:00:00Z');
  const nextMonthStart = new Date('2026-02-01T00:00:00Z');

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MONTHLY_GENERATION_LIMIT;
    mockCreateRedisConnection.mockReturnValue(mockRedisClient);
    mockGetMonthStart.mockReturnValue(monthStart);
    mockGetNextMonthStart.mockReturnValue(nextMonthStart);
  });

  afterEach(() => {
    delete process.env.MONTHLY_GENERATION_LIMIT;
  });

  describe('checkGenerationLimit', () => {
    it('gives admins unlimited access without counting generations', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: 'admin' });

      await expect(checkGenerationLimit(userId, 'dialogue')).resolves.toEqual({
        allowed: true,
        used: 0,
        limit: 0,
        remaining: 0,
        resetsAt: nextMonthStart,
        unlimited: true,
      });
      expect(mockPrisma.generationLog.count).not.toHaveBeenCalled();
    });

    it('uses one monthly limit across all content types', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: 'user' });
      mockPrisma.generationLog.count.mockResolvedValue(10);

      await expect(checkGenerationLimit(userId, 'course')).resolves.toEqual({
        allowed: true,
        used: 10,
        limit: 30,
        remaining: 20,
        resetsAt: nextMonthStart,
      });
      expect(mockPrisma.generationLog.count).toHaveBeenCalledWith({
        where: {
          userId,
          createdAt: { gte: monthStart },
        },
      });
    });

    it('denies generation at the monthly limit', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: 'user' });
      mockPrisma.generationLog.count.mockResolvedValue(30);

      const result = await checkGenerationLimit(userId, 'dialogue');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('supports a positive configured monthly limit', async () => {
      process.env.MONTHLY_GENERATION_LIMIT = '50';
      mockPrisma.user.findUnique.mockResolvedValue({ role: 'user' });
      mockPrisma.generationLog.count.mockResolvedValue(12);

      const result = await checkGenerationLimit(userId, 'script');

      expect(result.limit).toBe(50);
      expect(result.remaining).toBe(38);
    });

    it.each(['0', '-1', 'invalid'])(
      'falls back to the default for invalid configured limit %s',
      async (configuredLimit) => {
        process.env.MONTHLY_GENERATION_LIMIT = configuredLimit;
        mockPrisma.user.findUnique.mockResolvedValue({ role: 'user' });
        mockPrisma.generationLog.count.mockResolvedValue(0);

        const result = await checkGenerationLimit(userId, 'dialogue');

        expect(result.limit).toBe(30);
      }
    );

    it('throws when the user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(checkGenerationLimit(userId, 'dialogue')).rejects.toThrow('User not found');
    });
  });

  describe('logGeneration', () => {
    it('persists the content type and optional content id', async () => {
      await logGeneration(userId, 'course', 'course-123');

      expect(mockPrisma.generationLog.create).toHaveBeenCalledWith({
        data: {
          userId,
          contentType: 'course',
          contentId: 'course-123',
        },
      });
    });
  });

  describe('cooldown operations', () => {
    it('reports the remaining cooldown and disconnects', async () => {
      mockRedisClient.ttl.mockResolvedValue(15);

      await expect(checkCooldown(userId)).resolves.toEqual({
        active: true,
        remainingSeconds: 15,
      });
      expect(mockRedisClient.disconnect).toHaveBeenCalled();
    });

    it('clamps missing cooldowns to zero', async () => {
      mockRedisClient.ttl.mockResolvedValue(-2);

      await expect(checkCooldown(userId)).resolves.toEqual({
        active: false,
        remainingSeconds: 0,
      });
    });

    it('sets a 30-second cooldown and disconnects', async () => {
      mockRedisClient.setex.mockResolvedValue(undefined);

      await setCooldown(userId);

      expect(mockRedisClient.setex).toHaveBeenCalledWith('cooldown:generation:user-123', 30, '1');
      expect(mockRedisClient.disconnect).toHaveBeenCalled();
    });

    it('disconnects when a Redis operation fails', async () => {
      mockRedisClient.ttl.mockRejectedValue(new Error('Redis error'));

      await expect(checkCooldown(userId)).rejects.toThrow('Redis error');
      expect(mockRedisClient.disconnect).toHaveBeenCalled();
    });
  });
});
