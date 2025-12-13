import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../../middleware/auth.js';
import { rateLimitGeneration } from '../../../middleware/rateLimit.js';
import { AppError } from '../../../middleware/errorHandler.js';

// Create hoisted mocks
const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
}));

const mockCheckGenerationLimit = vi.hoisted(() => vi.fn());
const mockCheckCooldown = vi.hoisted(() => vi.fn());
const mockSetCooldown = vi.hoisted(() => vi.fn());

vi.mock('../../../db/client.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../../services/usageTracker.js', () => ({
  checkGenerationLimit: mockCheckGenerationLimit,
  checkCooldown: mockCheckCooldown,
  setCooldown: mockSetCooldown,
}));

describe('rateLimitGeneration middleware', () => {
  let mockReq: Partial<AuthRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      userId: 'user-123',
    };
    mockRes = {};
    mockNext = vi.fn();
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should throw 401 when userId is missing', async () => {
      mockReq.userId = undefined;

      await rateLimitGeneration(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
      expect(error.message).toBe('Authentication required');
      expect(error.statusCode).toBe(401);
    });

    it('should throw 404 when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await rateLimitGeneration(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        select: { role: true },
      });
      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
      expect(error.message).toBe('User not found');
      expect(error.statusCode).toBe(404);
    });
  });

  describe('Admin bypass', () => {
    it('should allow admin users to bypass all rate limits', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: 'admin' });

      await rateLimitGeneration(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        select: { role: true },
      });
      expect(mockCheckCooldown).not.toHaveBeenCalled();
      expect(mockCheckGenerationLimit).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('Cooldown enforcement', () => {
    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: 'user' });
    });

    it('should block request when cooldown is active', async () => {
      mockCheckCooldown.mockResolvedValue({
        active: true,
        remainingSeconds: 25,
      });

      await rateLimitGeneration(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockCheckCooldown).toHaveBeenCalledWith('user-123');
      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
      expect(error.message).toBe('Please wait 25 seconds before generating more content.');
      expect(error.statusCode).toBe(429);
      expect(error.metadata).toEqual({
        cooldown: {
          remainingSeconds: 25,
          retryAfter: expect.any(Date),
        },
      });
    });

    it('should include correct retryAfter date in cooldown error', async () => {
      const now = Date.now();
      mockCheckCooldown.mockResolvedValue({
        active: true,
        remainingSeconds: 30,
      });

      await rateLimitGeneration(mockReq as AuthRequest, mockRes as Response, mockNext);

      const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
      const retryAfter = error.metadata?.cooldown.retryAfter;
      expect(retryAfter).toBeInstanceOf(Date);
      // Should be approximately 30 seconds in the future (with 1 second tolerance)
      expect(retryAfter.getTime()).toBeGreaterThanOrEqual(now + 29000);
      expect(retryAfter.getTime()).toBeLessThanOrEqual(now + 31000);
    });

    it('should check cooldown before quota (fail-fast)', async () => {
      mockCheckCooldown.mockResolvedValue({
        active: true,
        remainingSeconds: 15,
      });

      await rateLimitGeneration(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockCheckCooldown).toHaveBeenCalled();
      expect(mockCheckGenerationLimit).not.toHaveBeenCalled();
    });
  });

  describe('Weekly quota enforcement', () => {
    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: 'user' });
      mockCheckCooldown.mockResolvedValue({
        active: false,
        remainingSeconds: 0,
      });
    });

    it('should block request when weekly quota exceeded', async () => {
      mockCheckGenerationLimit.mockResolvedValue({
        allowed: false,
        used: 20,
        limit: 20,
        remaining: 0,
        resetsAt: new Date('2025-12-16T00:00:00Z'),
      });

      await rateLimitGeneration(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockCheckGenerationLimit).toHaveBeenCalledWith('user-123');
      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
      expect(error.message).toBe(
        "Weekly quota exceeded. You've used 20 of 20 content generations this week."
      );
      expect(error.statusCode).toBe(429);
      expect(error.metadata).toEqual({
        quota: {
          limit: 20,
          used: 20,
          remaining: 0,
          resetsAt: new Date('2025-12-16T00:00:00Z'),
        },
      });
    });

    it('should proceed when quota is available', async () => {
      mockCheckGenerationLimit.mockResolvedValue({
        allowed: true,
        used: 10,
        limit: 20,
        remaining: 10,
        resetsAt: new Date('2025-12-16T00:00:00Z'),
      });

      await rateLimitGeneration(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockCheckGenerationLimit).toHaveBeenCalledWith('user-123');
      expect(mockSetCooldown).toHaveBeenCalledWith('user-123');
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('Successful rate limit pass', () => {
    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: 'user' });
      mockCheckCooldown.mockResolvedValue({
        active: false,
        remainingSeconds: 0,
      });
      mockCheckGenerationLimit.mockResolvedValue({
        allowed: true,
        used: 5,
        limit: 20,
        remaining: 15,
        resetsAt: new Date('2025-12-16T00:00:00Z'),
      });
    });

    it('should set cooldown after allowing request', async () => {
      await rateLimitGeneration(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockSetCooldown).toHaveBeenCalledWith('user-123');
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should call next() without arguments when all checks pass', async () => {
      await rateLimitGeneration(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should perform checks in correct order: auth -> role -> cooldown -> quota -> setCooldown', async () => {
      const callOrder: string[] = [];

      mockPrisma.user.findUnique.mockImplementation(async () => {
        callOrder.push('findUser');
        return { role: 'user' };
      });

      mockCheckCooldown.mockImplementation(async () => {
        callOrder.push('checkCooldown');
        return { active: false, remainingSeconds: 0 };
      });

      mockCheckGenerationLimit.mockImplementation(async () => {
        callOrder.push('checkQuota');
        return {
          allowed: true,
          used: 5,
          limit: 20,
          remaining: 15,
          resetsAt: new Date(),
        };
      });

      mockSetCooldown.mockImplementation(async () => {
        callOrder.push('setCooldown');
      });

      await rateLimitGeneration(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(callOrder).toEqual(['findUser', 'checkCooldown', 'checkQuota', 'setCooldown']);
    });
  });

  describe('Error handling', () => {
    it('should pass through errors from Prisma', async () => {
      const dbError = new Error('Database connection failed');
      mockPrisma.user.findUnique.mockRejectedValue(dbError);

      await rateLimitGeneration(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(dbError);
    });

    it('should pass through errors from checkCooldown', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: 'user' });
      const redisError = new Error('Redis connection failed');
      mockCheckCooldown.mockRejectedValue(redisError);

      await rateLimitGeneration(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(redisError);
    });

    it('should pass through errors from checkGenerationLimit', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: 'user' });
      mockCheckCooldown.mockResolvedValue({ active: false, remainingSeconds: 0 });
      const dbError = new Error('Database query failed');
      mockCheckGenerationLimit.mockRejectedValue(dbError);

      await rateLimitGeneration(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(dbError);
    });

    it('should pass through errors from setCooldown', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: 'user' });
      mockCheckCooldown.mockResolvedValue({ active: false, remainingSeconds: 0 });
      mockCheckGenerationLimit.mockResolvedValue({
        allowed: true,
        used: 5,
        limit: 20,
        remaining: 15,
        resetsAt: new Date(),
      });
      const redisError = new Error('Redis SETEX failed');
      mockSetCooldown.mockRejectedValue(redisError);

      await rateLimitGeneration(mockReq as AuthRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(redisError);
    });
  });
});
