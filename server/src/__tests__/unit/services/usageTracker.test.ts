import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkGenerationLimit,
  logGeneration,
  checkCooldown,
  setCooldown,
  ContentType,
} from '../../../services/usageTracker.js';

// Create hoisted mocks
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
const mockGetWeekStart = vi.hoisted(() => vi.fn());
const mockGetNextWeekStart = vi.hoisted(() => vi.fn());

vi.mock('../../../db/client.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../../config/redis.js', () => ({
  createRedisConnection: mockCreateRedisConnection,
}));

vi.mock('../../../utils/dateUtils.js', () => ({
  getWeekStart: mockGetWeekStart,
  getNextWeekStart: mockGetNextWeekStart,
}));

describe('Usage Tracker Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateRedisConnection.mockReturnValue(mockRedisClient);
  });

  describe('checkGenerationLimit', () => {
    const userId = 'user-123';
    const weekStart = new Date('2025-12-08T00:00:00Z'); // Monday
    const nextWeekStart = new Date('2025-12-15T00:00:00Z'); // Next Monday

    beforeEach(() => {
      mockGetWeekStart.mockReturnValue(weekStart);
      mockGetNextWeekStart.mockReturnValue(nextWeekStart);

      // Mock user lookup to return pro tier user by default (limit: 20)
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        tier: 'pro',
        role: 'user',
      });
    });

    it('should return allowed=true when under weekly limit', async () => {
      mockPrisma.generationLog.count.mockResolvedValue(10);

      const result = await checkGenerationLimit(userId);

      expect(mockGetWeekStart).toHaveBeenCalled();
      expect(mockGetNextWeekStart).toHaveBeenCalled();
      expect(mockPrisma.generationLog.count).toHaveBeenCalledWith({
        where: {
          userId,
          createdAt: { gte: weekStart },
        },
      });
      expect(result).toEqual({
        allowed: true,
        used: 10,
        limit: 30,
        remaining: 20,
        resetsAt: nextWeekStart,
      });
    });

    it('should return allowed=false when at weekly limit', async () => {
      mockPrisma.generationLog.count.mockResolvedValue(30);

      const result = await checkGenerationLimit(userId);

      expect(result).toEqual({
        allowed: false,
        used: 30,
        limit: 30,
        remaining: 0,
        resetsAt: nextWeekStart,
      });
    });

    it('should return allowed=false when over weekly limit', async () => {
      mockPrisma.generationLog.count.mockResolvedValue(35);

      const result = await checkGenerationLimit(userId);

      expect(result).toEqual({
        allowed: false,
        used: 35,
        limit: 30,
        remaining: 0,
        resetsAt: nextWeekStart,
      });
      expect(result.remaining).toBe(0); // Should not go negative
    });

    it('should count only generations from current week', async () => {
      mockPrisma.generationLog.count.mockResolvedValue(5);

      await checkGenerationLimit(userId);

      expect(mockPrisma.generationLog.count).toHaveBeenCalledWith({
        where: {
          userId,
          createdAt: { gte: weekStart },
        },
      });
    });

    it('should calculate correct remaining count', async () => {
      mockPrisma.generationLog.count.mockResolvedValue(3);

      const result = await checkGenerationLimit(userId);

      expect(result.remaining).toBe(27);
    });

    it('should return correct resetsAt date (next Monday 00:00 UTC)', async () => {
      mockPrisma.generationLog.count.mockResolvedValue(5);

      const result = await checkGenerationLimit(userId);

      expect(result.resetsAt).toBe(nextWeekStart);
      expect(mockGetNextWeekStart).toHaveBeenCalled();
    });

    it('should handle edge case of exactly 30 generations', async () => {
      mockPrisma.generationLog.count.mockResolvedValue(30);

      const result = await checkGenerationLimit(userId);

      expect(result).toEqual({
        allowed: false,
        used: 30,
        limit: 30,
        remaining: 0,
        resetsAt: nextWeekStart,
      });
    });

    it('should handle 0 generations', async () => {
      mockPrisma.generationLog.count.mockResolvedValue(0);

      const result = await checkGenerationLimit(userId);

      expect(result).toEqual({
        allowed: true,
        used: 0,
        limit: 30,
        remaining: 30,
        resetsAt: nextWeekStart,
      });
    });
  });

  describe('logGeneration', () => {
    const userId = 'user-123';
    const contentType: ContentType = 'dialogue';

    it('should create GenerationLog record with correct userId and contentType', async () => {
      mockPrisma.generationLog.create.mockResolvedValue({
        id: 'log-1',
        userId,
        contentType,
        contentId: null,
        createdAt: new Date(),
      });

      await logGeneration(userId, contentType);

      expect(mockPrisma.generationLog.create).toHaveBeenCalledWith({
        data: { userId, contentType, contentId: undefined },
      });
    });

    it('should create GenerationLog record with contentId when provided', async () => {
      const contentId = 'dialogue-123';
      mockPrisma.generationLog.create.mockResolvedValue({
        id: 'log-1',
        userId,
        contentType,
        contentId,
        createdAt: new Date(),
      });

      await logGeneration(userId, contentType, contentId);

      expect(mockPrisma.generationLog.create).toHaveBeenCalledWith({
        data: { userId, contentType, contentId },
      });
    });

    it('should log all supported content types', async () => {
      const contentTypes: ContentType[] = [
        'dialogue',
        'course',
        'narrow_listening',
        'chunk_pack',
        'pi_session',
      ];

      for (const type of contentTypes) {
        mockPrisma.generationLog.create.mockResolvedValue({
          id: `log-${type}`,
          userId,
          contentType: type,
          contentId: null,
          createdAt: new Date(),
        });

        await logGeneration(userId, type);

        expect(mockPrisma.generationLog.create).toHaveBeenCalledWith({
          data: { userId, contentType: type, contentId: undefined },
        });
      }
    });

    it('should persist even if content is deleted (quota gaming prevention)', async () => {
      // This test verifies the design: GenerationLog is independent of content lifecycle
      const contentId = 'dialogue-123';
      mockPrisma.generationLog.create.mockResolvedValue({
        id: 'log-1',
        userId,
        contentType: 'dialogue',
        contentId,
        createdAt: new Date(),
      });

      await logGeneration(userId, 'dialogue', contentId);

      // The log is created with contentId, but there's no cascade delete
      // This is enforced by schema design - contentId is String? (not a foreign key)
      expect(mockPrisma.generationLog.create).toHaveBeenCalledWith({
        data: { userId, contentType: 'dialogue', contentId },
      });
    });
  });

  describe('checkCooldown', () => {
    const userId = 'user-123';

    beforeEach(() => {
      mockCreateRedisConnection.mockReturnValue(mockRedisClient);
    });

    it('should return active=true when Redis key exists with TTL', async () => {
      mockRedisClient.ttl.mockResolvedValue(25);

      const result = await checkCooldown(userId);

      expect(mockCreateRedisConnection).toHaveBeenCalled();
      expect(mockRedisClient.ttl).toHaveBeenCalledWith('cooldown:generation:user-123');
      expect(result).toEqual({
        active: true,
        remainingSeconds: 25,
      });
      expect(mockRedisClient.disconnect).toHaveBeenCalled();
    });

    it('should return active=false when Redis key does not exist', async () => {
      mockRedisClient.ttl.mockResolvedValue(-2); // Redis returns -2 when key doesn't exist

      const result = await checkCooldown(userId);

      expect(result).toEqual({
        active: false,
        remainingSeconds: 0,
      });
      expect(mockRedisClient.disconnect).toHaveBeenCalled();
    });

    it('should return active=false when Redis key has expired', async () => {
      mockRedisClient.ttl.mockResolvedValue(-1); // Redis returns -1 when key exists but has no TTL

      const result = await checkCooldown(userId);

      expect(result).toEqual({
        active: false,
        remainingSeconds: 0,
      });
    });

    it('should return correct remainingSeconds from Redis TTL', async () => {
      mockRedisClient.ttl.mockResolvedValue(15);

      const result = await checkCooldown(userId);

      expect(result.remainingSeconds).toBe(15);
    });

    it('should properly disconnect Redis after check', async () => {
      mockRedisClient.ttl.mockResolvedValue(10);

      await checkCooldown(userId);

      expect(mockRedisClient.disconnect).toHaveBeenCalledTimes(1);
    });

    it('should disconnect Redis even if TTL check fails', async () => {
      mockRedisClient.ttl.mockRejectedValue(new Error('Redis connection failed'));

      await expect(checkCooldown(userId)).rejects.toThrow('Redis connection failed');

      expect(mockRedisClient.disconnect).toHaveBeenCalledTimes(1);
    });

    it('should handle negative TTL values correctly', async () => {
      mockRedisClient.ttl.mockResolvedValue(-5);

      const result = await checkCooldown(userId);

      expect(result).toEqual({
        active: false,
        remainingSeconds: 0,
      });
    });

    it('should never return negative remainingSeconds', async () => {
      // Test the Math.max(0, ttl) logic
      mockRedisClient.ttl.mockResolvedValue(-10);

      const result = await checkCooldown(userId);

      expect(result.remainingSeconds).toBe(0);
      expect(result.remainingSeconds).toBeGreaterThanOrEqual(0);
    });
  });

  describe('setCooldown', () => {
    const userId = 'user-123';

    beforeEach(() => {
      mockCreateRedisConnection.mockReturnValue(mockRedisClient);
    });

    it('should set Redis key with 30-second expiration', async () => {
      mockRedisClient.setex.mockResolvedValue('OK');

      await setCooldown(userId);

      expect(mockCreateRedisConnection).toHaveBeenCalled();
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'cooldown:generation:user-123',
        30,
        '1'
      );
      expect(mockRedisClient.disconnect).toHaveBeenCalled();
    });

    it('should properly disconnect Redis after setting cooldown', async () => {
      mockRedisClient.setex.mockResolvedValue('OK');

      await setCooldown(userId);

      expect(mockRedisClient.disconnect).toHaveBeenCalledTimes(1);
    });

    it('should disconnect Redis even if SETEX fails', async () => {
      mockRedisClient.setex.mockRejectedValue(new Error('Redis write failed'));

      await expect(setCooldown(userId)).rejects.toThrow('Redis write failed');

      expect(mockRedisClient.disconnect).toHaveBeenCalledTimes(1);
    });

    it('should use correct cooldown duration (30 seconds)', async () => {
      mockRedisClient.setex.mockResolvedValue('OK');

      await setCooldown(userId);

      const setexCall = mockRedisClient.setex.mock.calls[0];
      expect(setexCall[1]).toBe(30); // 30 seconds
    });

    it('should use consistent key format', async () => {
      mockRedisClient.setex.mockResolvedValue('OK');

      await setCooldown(userId);

      const setexCall = mockRedisClient.setex.mock.calls[0];
      expect(setexCall[0]).toBe('cooldown:generation:user-123');
    });

    it('should work with different user IDs', async () => {
      mockRedisClient.setex.mockResolvedValue('OK');

      await setCooldown('user-456');

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'cooldown:generation:user-456',
        30,
        '1'
      );
    });
  });

  describe('Redis connection management', () => {
    it('should create new Redis connection for each operation', async () => {
      mockRedisClient.ttl.mockResolvedValue(15);

      await checkCooldown('user-1');
      await checkCooldown('user-2');

      expect(mockCreateRedisConnection).toHaveBeenCalledTimes(2);
    });

    it('should ensure Redis disconnects in finally block', async () => {
      mockRedisClient.ttl.mockRejectedValue(new Error('Connection error'));

      try {
        await checkCooldown('user-123');
      } catch (e) {
        // Error expected
      }

      expect(mockRedisClient.disconnect).toHaveBeenCalled();
    });
  });
});
