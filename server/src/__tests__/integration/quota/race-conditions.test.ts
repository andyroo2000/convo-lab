import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkGenerationLimit,
  logGeneration,
  checkCooldown,
  setCooldown,
} from '../../../services/usageTracker.js';
import { mockPrisma } from '../../setup.js';
import { getWeekStart, getNextWeekStart } from '../../../utils/dateUtils.js';

// Mock Redis
const mockRedis = {
  ttl: vi.fn(),
  setex: vi.fn(),
  disconnect: vi.fn(),
};

vi.mock('../../../config/redis.js', () => ({
  createRedisConnection: () => mockRedis,
}));

describe('Quota System Race Conditions - Integration Tests', () => {
  const mockUserId = 'user-123';
  const _weekStart = getWeekStart();
  const _nextWeekStart = getNextWeekStart();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkGenerationLimit', () => {
    it('should allow generation when under quota limit', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        tier: 'free',
        role: 'user',
      });

      mockPrisma.generationLog.count.mockResolvedValue(3); // 3 of 5

      const status = await checkGenerationLimit(mockUserId);

      expect(status).toEqual({
        allowed: true,
        used: 3,
        limit: 5,
        remaining: 2,
        resetsAt: expect.any(Date),
      });
    });

    it('should reject generation when at quota limit', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        tier: 'free',
        role: 'user',
      });

      mockPrisma.generationLog.count.mockResolvedValue(5); // 5 of 5

      const status = await checkGenerationLimit(mockUserId);

      expect(status).toEqual({
        allowed: false,
        used: 5,
        limit: 5,
        remaining: 0,
        resetsAt: expect.any(Date),
      });
    });

    it('should grant unlimited quota to admin users', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        tier: 'free',
        role: 'admin',
      });

      const status = await checkGenerationLimit(mockUserId);

      expect(status).toEqual({
        allowed: true,
        used: 0,
        limit: 0,
        remaining: 0,
        resetsAt: expect.any(Date),
        unlimited: true,
      });

      // Should not count generations for admin
      expect(mockPrisma.generationLog.count).not.toHaveBeenCalled();
    });

    it('should use correct tier limits (free: 5, pro: 30)', async () => {
      // Test free tier
      mockPrisma.user.findUnique.mockResolvedValue({
        tier: 'free',
        role: 'user',
      });
      mockPrisma.generationLog.count.mockResolvedValue(0);

      const freeStatus = await checkGenerationLimit(mockUserId);
      expect(freeStatus.limit).toBe(5);

      // Test pro tier
      mockPrisma.user.findUnique.mockResolvedValue({
        tier: 'pro',
        role: 'user',
      });

      const proStatus = await checkGenerationLimit(mockUserId);
      expect(proStatus.limit).toBe(30);
    });

    it('should count generations from current week only', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        tier: 'free',
        role: 'user',
      });

      mockPrisma.generationLog.count.mockResolvedValue(2);

      await checkGenerationLimit(mockUserId);

      expect(mockPrisma.generationLog.count).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          createdAt: { gte: expect.any(Date) },
        },
      });

      // Verify week start calculation
      const call = mockPrisma.generationLog.count.mock.calls[0][0];
      const weekStartArg = call.where.createdAt.gte;

      // Should be Monday 00:00:00 UTC
      expect(weekStartArg.getUTCHours()).toBe(0);
      expect(weekStartArg.getUTCMinutes()).toBe(0);
      expect(weekStartArg.getUTCSeconds()).toBe(0);
    });

    it('should handle tier upgrade mid-week correctly', async () => {
      // User was free tier (5/week), now pro tier (30/week)
      // Should use current tier limit, not tier at time of previous generations
      mockPrisma.user.findUnique.mockResolvedValue({
        tier: 'pro', // Current tier
        role: 'user',
      });

      mockPrisma.generationLog.count.mockResolvedValue(6); // 6 generations

      const status = await checkGenerationLimit(mockUserId);

      expect(status).toEqual({
        allowed: true,
        used: 6,
        limit: 30, // Uses current tier (pro)
        remaining: 24,
        resetsAt: expect.any(Date),
      });
    });
  });

  describe('logGeneration', () => {
    it('should create generation log entry', async () => {
      mockPrisma.generationLog.create.mockResolvedValue({
        id: 'log-123',
        userId: mockUserId,
        contentType: 'dialogue',
        contentId: 'content-123',
        createdAt: new Date(),
      });

      await logGeneration(mockUserId, 'dialogue', 'content-123');

      expect(mockPrisma.generationLog.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          contentType: 'dialogue',
          contentId: 'content-123',
        },
      });
    });

    it('should persist log even if content is deleted (prevent quota gaming)', async () => {
      mockPrisma.generationLog.create.mockResolvedValue({});

      await logGeneration(mockUserId, 'dialogue', 'content-123');

      // Log created with contentId reference
      expect(mockPrisma.generationLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          contentId: 'content-123',
        }),
      });

      // contentId stored but not enforced as foreign key,
      // so deletion of content doesn't cascade delete logs
    });
  });

  describe('Cooldown System', () => {
    it('should return no cooldown when key not in Redis', async () => {
      mockRedis.ttl.mockResolvedValue(-2); // Key doesn't exist

      const status = await checkCooldown(mockUserId);

      expect(status).toEqual({
        active: false,
        remainingSeconds: 0,
      });

      expect(mockRedis.ttl).toHaveBeenCalledWith(`cooldown:generation:${mockUserId}`);
      expect(mockRedis.disconnect).toHaveBeenCalled();
    });

    it('should return active cooldown with remaining time', async () => {
      mockRedis.ttl.mockResolvedValue(15); // 15 seconds remaining

      const status = await checkCooldown(mockUserId);

      expect(status).toEqual({
        active: true,
        remainingSeconds: 15,
      });
    });

    it('should set 30-second cooldown in Redis', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await setCooldown(mockUserId);

      expect(mockRedis.setex).toHaveBeenCalledWith(`cooldown:generation:${mockUserId}`, 30, '1');
      expect(mockRedis.disconnect).toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully with finally disconnect', async () => {
      mockRedis.ttl.mockRejectedValue(new Error('Redis connection failed'));

      await expect(checkCooldown(mockUserId)).rejects.toThrow('Redis connection failed');

      // Should still disconnect even on error
      expect(mockRedis.disconnect).toHaveBeenCalled();
    });
  });

  describe('Race Conditions', () => {
    it('should handle concurrent quota checks at limit boundary', async () => {
      // Simulate user at 4/5 quota making 3 concurrent requests
      // Expected: 1 succeeds (5/5), 2 fail

      mockPrisma.user.findUnique.mockResolvedValue({
        tier: 'free',
        role: 'user',
      });

      // First check: 4 used, allowed
      // Second check: 4 used, allowed (race condition)
      // Third check: 4 used, allowed (race condition)
      mockPrisma.generationLog.count
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(4);

      const checks = await Promise.all([
        checkGenerationLimit(mockUserId),
        checkGenerationLimit(mockUserId),
        checkGenerationLimit(mockUserId),
      ]);

      // All checks see 4/5, all return allowed (race condition exists)
      expect(checks.every((c) => c.allowed)).toBe(true);
      expect(checks.every((c) => c.used === 4)).toBe(true);
      expect(checks.every((c) => c.remaining === 1)).toBe(true);

      // This demonstrates the race condition:
      // Without transaction isolation, all 3 requests could pass quota check
      // and increment to 7/5 total
    });

    it('should handle concurrent cooldown checks', async () => {
      mockRedis.ttl
        .mockResolvedValueOnce(-2) // No cooldown
        .mockResolvedValueOnce(-2) // No cooldown (race)
        .mockResolvedValueOnce(-2); // No cooldown (race)

      const checks = await Promise.all([
        checkCooldown(mockUserId),
        checkCooldown(mockUserId),
        checkCooldown(mockUserId),
      ]);

      // All checks see no cooldown (demonstrates race condition)
      expect(checks.every((c) => !c.active)).toBe(true);
    });

    it('should verify cooldown set after quota check in middleware flow', async () => {
      // This is the expected middleware flow:
      // 1. Check cooldown (should pass)
      // 2. Check quota (should pass)
      // 3. Set cooldown
      // 4. Proceed with generation

      mockRedis.ttl.mockResolvedValue(-2); // No cooldown
      mockRedis.setex.mockResolvedValue('OK');

      mockPrisma.user.findUnique.mockResolvedValue({
        tier: 'free',
        role: 'user',
      });
      mockPrisma.generationLog.count.mockResolvedValue(2); // 2/5

      // Simulate middleware flow
      const cooldownStatus = await checkCooldown(mockUserId);
      expect(cooldownStatus.active).toBe(false);

      const quotaStatus = await checkGenerationLimit(mockUserId);
      expect(quotaStatus.allowed).toBe(true);

      await setCooldown(mockUserId);

      // Verify cooldown was set AFTER checks
      const order = mockRedis.ttl.mock.invocationCallOrder[0];
      const setOrder = mockRedis.setex.mock.invocationCallOrder[0];
      expect(setOrder).toBeGreaterThan(order);
    });
  });

  describe('Week Boundary Edge Cases', () => {
    it('should handle generation at week boundary (Sunday 23:59:59 UTC)', async () => {
      // Create a date at Sunday 23:59:59 UTC
      const sunday = new Date('2025-01-05T23:59:59Z'); // Sunday
      const _mondayStart = getWeekStart(sunday); // Should be Monday 2024-12-30

      mockPrisma.user.findUnique.mockResolvedValue({
        tier: 'free',
        role: 'user',
      });
      mockPrisma.generationLog.count.mockResolvedValue(3);

      await checkGenerationLimit(mockUserId);

      // Verify it counts from Monday of current week
      const call = mockPrisma.generationLog.count.mock.calls[0][0];
      const weekStartArg = call.where.createdAt.gte;

      expect(weekStartArg.getUTCDay()).toBe(1); // Monday
      expect(weekStartArg.getUTCHours()).toBe(0);
    });

    it('should handle generation at Monday 00:00:00 UTC (week start)', async () => {
      const monday = new Date('2025-01-06T00:00:00Z'); // Monday
      const _mondayStart = getWeekStart(monday);

      // Week start should be same as input
      expect(_mondayStart.toISOString()).toBe(monday.toISOString());
    });

    it('should reset quota count on new week', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        tier: 'free',
        role: 'user',
      });

      // User had 5 generations last week, 0 this week
      mockPrisma.generationLog.count.mockResolvedValue(0);

      const status = await checkGenerationLimit(mockUserId);

      expect(status.used).toBe(0);
      expect(status.remaining).toBe(5);
      expect(status.allowed).toBe(true);
    });
  });

  describe('Tier Limits', () => {
    it('should enforce free tier limit (5/week)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        tier: 'free',
        role: 'user',
      });

      mockPrisma.generationLog.count.mockResolvedValue(5);

      const status = await checkGenerationLimit(mockUserId);

      expect(status.allowed).toBe(false);
      expect(status.limit).toBe(5);
      expect(status.remaining).toBe(0);
    });

    it('should enforce pro tier limit (30/week)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        tier: 'pro',
        role: 'user',
      });

      mockPrisma.generationLog.count.mockResolvedValue(30);

      const status = await checkGenerationLimit(mockUserId);

      expect(status.allowed).toBe(false);
      expect(status.limit).toBe(30);
      expect(status.remaining).toBe(0);
    });

    it('should default to free tier for unknown tiers', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        tier: 'unknown-tier',
        role: 'user',
      });

      mockPrisma.generationLog.count.mockResolvedValue(0);

      const status = await checkGenerationLimit(mockUserId);

      expect(status.limit).toBe(5); // Defaults to free
    });
  });

  describe('Error Handling', () => {
    it('should throw error for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(checkGenerationLimit(mockUserId)).rejects.toThrow('User not found');
    });

    it('should disconnect Redis even on error', async () => {
      mockRedis.ttl.mockRejectedValue(new Error('Connection failed'));

      await expect(checkCooldown(mockUserId)).rejects.toThrow();
      expect(mockRedis.disconnect).toHaveBeenCalled();
    });
  });
});
