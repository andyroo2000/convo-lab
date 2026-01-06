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
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateRedisConnection.mockReturnValue(mockRedisClient);
  });

  describe('checkGenerationLimit', () => {
    const userId = 'user-123';
    const monthStart = new Date('2026-01-01T00:00:00Z'); // 1st of month
    const nextMonthStart = new Date('2026-02-01T00:00:00Z'); // 1st of next month

    beforeEach(() => {
      mockGetMonthStart.mockReturnValue(monthStart);
      mockGetNextMonthStart.mockReturnValue(nextMonthStart);
    });

    describe('Admin users', () => {
      beforeEach(() => {
        mockPrisma.user.findUnique.mockResolvedValue({
          id: userId,
          tier: 'pro',
          role: 'admin',
        });
      });

      it('should allow unlimited generations for admins', async () => {
        const result = await checkGenerationLimit(userId, 'dialogue');

        expect(result).toEqual({
          allowed: true,
          used: 0,
          limit: 0,
          remaining: 0,
          resetsAt: nextMonthStart,
          unlimited: true,
        });
        expect(mockPrisma.generationLog.count).not.toHaveBeenCalled();
      });

      it('should work for any content type', async () => {
        const contentTypes: ContentType[] = [
          'dialogue',
          'course',
          'narrow_listening',
          'chunk_pack',
          'pi_session',
        ];

        for (const contentType of contentTypes) {
          const result = await checkGenerationLimit(userId, contentType);
          expect(result.allowed).toBe(true);
          expect(result.unlimited).toBe(true);
        }
      });
    });

    describe('Free tier users', () => {
      beforeEach(() => {
        mockPrisma.user.findUnique.mockResolvedValue({
          id: userId,
          tier: 'free',
          role: 'user',
        });
      });

      describe('Dialogue content type', () => {
        it('should allow up to 2 dialogues (lifetime limit)', async () => {
          mockPrisma.generationLog.count.mockResolvedValue(0);

          const result = await checkGenerationLimit(userId, 'dialogue');

          expect(mockPrisma.generationLog.count).toHaveBeenCalledWith({
            where: {
              userId,
              contentType: 'dialogue',
            },
          });
          expect(result).toEqual({
            allowed: true,
            used: 0,
            limit: 2,
            remaining: 2,
            resetsAt: new Date('9999-12-31'), // Lifetime limit, never resets
          });
        });

        it('should return allowed=false when 2 dialogues created', async () => {
          mockPrisma.generationLog.count.mockResolvedValue(2);

          const result = await checkGenerationLimit(userId, 'dialogue');

          expect(result).toEqual({
            allowed: false,
            used: 2,
            limit: 2,
            remaining: 0,
            resetsAt: new Date('9999-12-31'),
          });
        });

        it('should count lifetime generations (not just this month)', async () => {
          mockPrisma.generationLog.count.mockResolvedValue(1);

          await checkGenerationLimit(userId, 'dialogue');

          // Should NOT filter by createdAt (lifetime count)
          expect(mockPrisma.generationLog.count).toHaveBeenCalledWith({
            where: {
              userId,
              contentType: 'dialogue',
            },
          });
        });
      });

      describe('Course content type', () => {
        it('should allow 1 audio course (lifetime limit)', async () => {
          mockPrisma.generationLog.count.mockResolvedValue(0);

          const result = await checkGenerationLimit(userId, 'course');

          expect(result).toEqual({
            allowed: true,
            used: 0,
            limit: 1,
            remaining: 1,
            resetsAt: new Date('9999-12-31'),
          });
        });

        it('should return allowed=false when 1 course created', async () => {
          mockPrisma.generationLog.count.mockResolvedValue(1);

          const result = await checkGenerationLimit(userId, 'course');

          expect(result).toEqual({
            allowed: false,
            used: 1,
            limit: 1,
            remaining: 0,
            resetsAt: new Date('9999-12-31'),
          });
        });
      });

      describe('Premium content types (not available for free)', () => {
        it('should block narrow_listening content', async () => {
          const result = await checkGenerationLimit(userId, 'narrow_listening');

          expect(result).toEqual({
            allowed: false,
            used: 0,
            limit: 0,
            remaining: 0,
            resetsAt: new Date('9999-12-31'),
          });
          expect(mockPrisma.generationLog.count).not.toHaveBeenCalled();
        });

        it('should block chunk_pack content', async () => {
          const result = await checkGenerationLimit(userId, 'chunk_pack');

          expect(result.allowed).toBe(false);
          expect(result.limit).toBe(0);
        });

        it('should block pi_session content', async () => {
          const result = await checkGenerationLimit(userId, 'pi_session');

          expect(result.allowed).toBe(false);
          expect(result.limit).toBe(0);
        });
      });

      describe('Per-content-type limits are independent', () => {
        it('should track dialogue and course limits separately', async () => {
          // User has created 2 dialogues (at limit)
          mockPrisma.generationLog.count.mockImplementation(({ where }) => {
            if (where.contentType === 'dialogue') return Promise.resolve(2);
            if (where.contentType === 'course') return Promise.resolve(0);
            return Promise.resolve(0);
          });

          const dialogueResult = await checkGenerationLimit(userId, 'dialogue');
          const courseResult = await checkGenerationLimit(userId, 'course');

          expect(dialogueResult.allowed).toBe(false); // At dialogue limit
          expect(courseResult.allowed).toBe(true); // Course still available
        });
      });
    });

    describe('Paid tier (Pro) users', () => {
      beforeEach(() => {
        mockPrisma.user.findUnique.mockResolvedValue({
          id: userId,
          tier: 'pro',
          role: 'user',
        });
      });

      it('should allow 30 generations per month (combined)', async () => {
        mockPrisma.generationLog.count.mockResolvedValue(10);

        const result = await checkGenerationLimit(userId, 'dialogue');

        expect(mockGetMonthStart).toHaveBeenCalled();
        expect(mockGetNextMonthStart).toHaveBeenCalled();
        expect(mockPrisma.generationLog.count).toHaveBeenCalledWith({
          where: {
            userId,
            createdAt: { gte: monthStart },
          },
        });
        expect(result).toEqual({
          allowed: true,
          used: 10,
          limit: 30,
          remaining: 20,
          resetsAt: nextMonthStart,
        });
      });

      it('should return allowed=false when at monthly limit', async () => {
        mockPrisma.generationLog.count.mockResolvedValue(30);

        const result = await checkGenerationLimit(userId, 'dialogue');

        expect(result).toEqual({
          allowed: false,
          used: 30,
          limit: 30,
          remaining: 0,
          resetsAt: nextMonthStart,
        });
      });

      it('should count all content types together', async () => {
        mockPrisma.generationLog.count.mockResolvedValue(25);

        await checkGenerationLimit(userId, 'dialogue');

        // Should NOT filter by contentType (all types combined)
        expect(mockPrisma.generationLog.count).toHaveBeenCalledWith({
          where: {
            userId,
            createdAt: { gte: monthStart },
          },
        });
      });

      it('should only count current month generations', async () => {
        mockPrisma.generationLog.count.mockResolvedValue(5);

        await checkGenerationLimit(userId, 'course');

        expect(mockPrisma.generationLog.count).toHaveBeenCalledWith({
          where: {
            userId,
            createdAt: { gte: monthStart },
          },
        });
      });

      it('should reset quota at start of next month', async () => {
        mockPrisma.generationLog.count.mockResolvedValue(15);

        const result = await checkGenerationLimit(userId, 'narrow_listening');

        expect(result.resetsAt).toEqual(nextMonthStart);
      });

      it('should handle exactly 30 generations', async () => {
        mockPrisma.generationLog.count.mockResolvedValue(30);

        const result = await checkGenerationLimit(userId, 'chunk_pack');

        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
      });

      it('should allow all content types for paid users', async () => {
        mockPrisma.generationLog.count.mockResolvedValue(10);

        const contentTypes: ContentType[] = [
          'dialogue',
          'course',
          'narrow_listening',
          'chunk_pack',
          'pi_session',
        ];

        for (const contentType of contentTypes) {
          const result = await checkGenerationLimit(userId, contentType);
          expect(result.allowed).toBe(true);
          expect(result.limit).toBe(30);
        }
      });
    });

    describe('Error handling', () => {
      it('should throw error when user not found', async () => {
        mockPrisma.user.findUnique.mockResolvedValue(null);

        await expect(checkGenerationLimit(userId, 'dialogue')).rejects.toThrow('User not found');
      });
    });
  });

  describe('logGeneration', () => {
    const userId = 'user-123';

    it('should create GenerationLog record with correct userId and contentType', async () => {
      await logGeneration(userId, 'dialogue');

      expect(mockPrisma.generationLog.create).toHaveBeenCalledWith({
        data: {
          userId,
          contentType: 'dialogue',
          contentId: undefined,
        },
      });
    });

    it('should create GenerationLog record with contentId when provided', async () => {
      await logGeneration(userId, 'course', 'course-123');

      expect(mockPrisma.generationLog.create).toHaveBeenCalledWith({
        data: {
          userId,
          contentType: 'course',
          contentId: 'course-123',
        },
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

      for (const contentType of contentTypes) {
        await logGeneration(userId, contentType);
      }

      expect(mockPrisma.generationLog.create).toHaveBeenCalledTimes(5);
    });

    it('should persist even if content is deleted (quota gaming prevention)', async () => {
      await logGeneration(userId, 'dialogue', 'deleted-episode-id');

      expect(mockPrisma.generationLog.create).toHaveBeenCalledWith({
        data: {
          userId,
          contentType: 'dialogue',
          contentId: 'deleted-episode-id',
        },
      });
    });
  });

  describe('checkCooldown', () => {
    const userId = 'user-123';

    it('should return active=true when Redis key exists with TTL', async () => {
      mockRedisClient.ttl.mockResolvedValue(15); // 15 seconds remaining

      const result = await checkCooldown(userId);

      expect(result).toEqual({
        active: true,
        remainingSeconds: 15,
      });
      expect(mockRedisClient.ttl).toHaveBeenCalledWith('cooldown:generation:user-123');
      expect(mockRedisClient.disconnect).toHaveBeenCalled();
    });

    it('should return active=false when Redis key does not exist', async () => {
      mockRedisClient.ttl.mockResolvedValue(-2); // Key does not exist

      const result = await checkCooldown(userId);

      expect(result).toEqual({
        active: false,
        remainingSeconds: 0,
      });
    });

    it('should return active=false when Redis key has expired', async () => {
      mockRedisClient.ttl.mockResolvedValue(-1); // Key exists but has no TTL (shouldn't happen)

      const result = await checkCooldown(userId);

      expect(result.active).toBe(false);
    });

    it('should return correct remainingSeconds from Redis TTL', async () => {
      mockRedisClient.ttl.mockResolvedValue(25);

      const result = await checkCooldown(userId);

      expect(result.remainingSeconds).toBe(25);
    });

    it('should properly disconnect Redis after check', async () => {
      mockRedisClient.ttl.mockResolvedValue(10);

      await checkCooldown(userId);

      expect(mockRedisClient.disconnect).toHaveBeenCalled();
    });

    it('should disconnect Redis even if TTL check fails', async () => {
      mockRedisClient.ttl.mockRejectedValue(new Error('Redis error'));

      await expect(checkCooldown(userId)).rejects.toThrow('Redis error');
      expect(mockRedisClient.disconnect).toHaveBeenCalled();
    });

    it('should handle negative TTL values correctly', async () => {
      mockRedisClient.ttl.mockResolvedValue(-5);

      const result = await checkCooldown(userId);

      expect(result.active).toBe(false);
      expect(result.remainingSeconds).toBe(0);
    });

    it('should never return negative remainingSeconds', async () => {
      mockRedisClient.ttl.mockResolvedValue(-10);

      const result = await checkCooldown(userId);

      expect(result.remainingSeconds).toBeGreaterThanOrEqual(0);
    });
  });

  describe('setCooldown', () => {
    const userId = 'user-123';

    beforeEach(() => {
      // Reset setex to success state (in case previous test set it to reject)
      mockRedisClient.setex.mockResolvedValue(undefined);
    });

    it('should set Redis key with 30-second expiration', async () => {
      await setCooldown(userId);

      expect(mockRedisClient.setex).toHaveBeenCalledWith('cooldown:generation:user-123', 30, '1');
      expect(mockRedisClient.disconnect).toHaveBeenCalled();
    });

    it('should properly disconnect Redis after setting cooldown', async () => {
      await setCooldown(userId);

      expect(mockRedisClient.disconnect).toHaveBeenCalled();
    });

    it('should disconnect Redis even if SETEX fails', async () => {
      mockRedisClient.setex.mockRejectedValue(new Error('Redis error'));

      await expect(setCooldown(userId)).rejects.toThrow('Redis error');
      expect(mockRedisClient.disconnect).toHaveBeenCalled();
    });

    it('should use correct cooldown duration (30 seconds)', async () => {
      await setCooldown(userId);

      expect(mockRedisClient.setex).toHaveBeenCalledWith(expect.any(String), 30, expect.any(String));
    });

    it('should use consistent key format', async () => {
      await setCooldown(userId);

      const keyArg = mockRedisClient.setex.mock.calls[0][0];
      expect(keyArg).toMatch(/^cooldown:generation:.+$/);
    });

    it('should work with different user IDs', async () => {
      await setCooldown('user-1');
      await setCooldown('user-2');
      await setCooldown('user-3');

      expect(mockRedisClient.setex).toHaveBeenCalledTimes(3);
      expect(mockRedisClient.setex).toHaveBeenNthCalledWith(1, 'cooldown:generation:user-1', 30, '1');
      expect(mockRedisClient.setex).toHaveBeenNthCalledWith(2, 'cooldown:generation:user-2', 30, '1');
      expect(mockRedisClient.setex).toHaveBeenNthCalledWith(3, 'cooldown:generation:user-3', 30, '1');
    });

    it('should create new Redis connection for each operation', async () => {
      await setCooldown(userId);

      expect(mockCreateRedisConnection).toHaveBeenCalled();
    });

    it('should ensure Redis disconnects in finally block', async () => {
      mockRedisClient.setex.mockRejectedValue(new Error('Test error'));

      try {
        await setCooldown(userId);
      } catch (e) {
        // Expected to throw
      }

      expect(mockRedisClient.disconnect).toHaveBeenCalled();
    });
  });
});
