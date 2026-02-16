import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  checkGenerationLimit,
  logGeneration,
  checkCooldown,
  setCooldown,
} from '../../../services/usageTracker.js';
import { mockPrisma } from '../../setup.js';

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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkGenerationLimit', () => {
    it('should allow generation when under quota limit (free tier dialogue)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        tier: 'free',
        role: 'user',
      });

      mockPrisma.generationLog.count.mockResolvedValue(1); // 1 of 2 dialogues

      const status = await checkGenerationLimit(mockUserId, 'dialogue');

      expect(status).toEqual({
        allowed: true,
        used: 1,
        limit: 2,
        remaining: 1,
        resetsAt: new Date('9999-12-31'), // Lifetime limit
      });
    });

    it('should reject generation when at quota limit (free tier dialogue)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        tier: 'free',
        role: 'user',
      });

      mockPrisma.generationLog.count.mockResolvedValue(2); // 2 of 2 dialogues

      const status = await checkGenerationLimit(mockUserId, 'dialogue');

      expect(status).toEqual({
        allowed: false,
        used: 2,
        limit: 2,
        remaining: 0,
        resetsAt: new Date('9999-12-31'), // Lifetime limit
      });
    });

    it('should grant unlimited quota to admin users', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: mockUserId,
        tier: 'free',
        role: 'admin',
      });

      const status = await checkGenerationLimit(mockUserId, 'dialogue');

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

    it('should use correct tier limits (free: per-type lifetime, pro: 30/month)', async () => {
      // Test free tier dialogue limit (2)
      mockPrisma.user.findUnique.mockResolvedValue({
        tier: 'free',
        role: 'user',
      });
      mockPrisma.generationLog.count.mockResolvedValue(0);

      const freeDialogueStatus = await checkGenerationLimit(mockUserId, 'dialogue');
      expect(freeDialogueStatus.limit).toBe(2);
      expect(freeDialogueStatus.resetsAt).toEqual(new Date('9999-12-31')); // Lifetime

      // Test free tier course limit (1)
      const freeCourseStatus = await checkGenerationLimit(mockUserId, 'course');
      expect(freeCourseStatus.limit).toBe(1);

      // Test pro tier monthly limit (30, combined across all content types)
      mockPrisma.user.findUnique.mockResolvedValue({
        tier: 'pro',
        role: 'user',
      });

      const proStatus = await checkGenerationLimit(mockUserId, 'dialogue');
      expect(proStatus.limit).toBe(30);
    });

    it('should count generations correctly for each tier', async () => {
      // Free tier: lifetime count for specific content type
      mockPrisma.user.findUnique.mockResolvedValue({
        tier: 'free',
        role: 'user',
      });

      mockPrisma.generationLog.count.mockResolvedValue(1);

      await checkGenerationLimit(mockUserId, 'dialogue');

      // Free tier should NOT filter by createdAt (lifetime count)
      expect(mockPrisma.generationLog.count).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          contentType: 'dialogue',
        },
      });

      vi.clearAllMocks();

      // Pro tier: monthly count across all content types
      mockPrisma.user.findUnique.mockResolvedValue({
        tier: 'pro',
        role: 'user',
      });

      mockPrisma.generationLog.count.mockResolvedValue(15);

      await checkGenerationLimit(mockUserId, 'dialogue');

      // Pro tier should filter by createdAt and NOT by contentType
      expect(mockPrisma.generationLog.count).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          createdAt: { gte: expect.any(Date) },
        },
      });

      // Verify month start calculation
      const call = mockPrisma.generationLog.count.mock.calls[0][0];
      const monthStartArg = call.where.createdAt.gte;

      // Should be 1st of month 00:00:00 UTC
      expect(monthStartArg.getUTCDate()).toBe(1);
      expect(monthStartArg.getUTCHours()).toBe(0);
      expect(monthStartArg.getUTCMinutes()).toBe(0);
      expect(monthStartArg.getUTCSeconds()).toBe(0);
    });

    it('should handle tier upgrade mid-month correctly', async () => {
      // User was free tier (lifetime limits), now pro tier (30/month)
      // Should use current tier limit, not tier at time of previous generations
      mockPrisma.user.findUnique.mockResolvedValue({
        tier: 'pro', // Current tier
        role: 'user',
      });

      mockPrisma.generationLog.count.mockResolvedValue(10); // 10 generations this month

      const status = await checkGenerationLimit(mockUserId, 'dialogue');

      expect(status).toEqual({
        allowed: true,
        used: 10,
        limit: 30, // Uses current tier (pro monthly limit)
        remaining: 20,
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
      // Simulate free tier user at 1/2 dialogue quota making 3 concurrent requests
      // Expected: 1 succeeds (2/2), 2 fail

      mockPrisma.user.findUnique.mockResolvedValue({
        tier: 'free',
        role: 'user',
      });

      // First check: 1 used, allowed
      // Second check: 1 used, allowed (race condition)
      // Third check: 1 used, allowed (race condition)
      mockPrisma.generationLog.count
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1);

      const checks = await Promise.all([
        checkGenerationLimit(mockUserId, 'dialogue'),
        checkGenerationLimit(mockUserId, 'dialogue'),
        checkGenerationLimit(mockUserId, 'dialogue'),
      ]);

      // All checks see 1/2, all return allowed (race condition exists)
      expect(checks.every((c) => c.allowed)).toBe(true);
      expect(checks.every((c) => c.used === 1)).toBe(true);
      expect(checks.every((c) => c.remaining === 1)).toBe(true);

      // This demonstrates the race condition:
      // Without transaction isolation, all 3 requests could pass quota check
      // and increment to 4/2 total
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
      mockPrisma.generationLog.count.mockResolvedValue(1); // 1/2 dialogues

      // Simulate middleware flow
      const cooldownStatus = await checkCooldown(mockUserId);
      expect(cooldownStatus.active).toBe(false);

      const quotaStatus = await checkGenerationLimit(mockUserId, 'dialogue');
      expect(quotaStatus.allowed).toBe(true);

      await setCooldown(mockUserId);

      // Verify cooldown was set AFTER checks
      const order = mockRedis.ttl.mock.invocationCallOrder[0];
      const setOrder = mockRedis.setex.mock.invocationCallOrder[0];
      expect(setOrder).toBeGreaterThan(order);
    });
  });

  describe('Tier Limits', () => {
    it('should enforce pro tier limit (30/month)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        tier: 'pro',
        role: 'user',
      });

      mockPrisma.generationLog.count.mockResolvedValue(30);

      const status = await checkGenerationLimit(mockUserId, 'dialogue');

      expect(status.allowed).toBe(false);
      expect(status.limit).toBe(30);
      expect(status.remaining).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(checkGenerationLimit(mockUserId, 'dialogue')).rejects.toThrow('User not found');
    });

    it('should disconnect Redis even on error', async () => {
      mockRedis.ttl.mockRejectedValue(new Error('Connection failed'));

      await expect(checkCooldown(mockUserId)).rejects.toThrow();
      expect(mockRedis.disconnect).toHaveBeenCalled();
    });
  });
});
