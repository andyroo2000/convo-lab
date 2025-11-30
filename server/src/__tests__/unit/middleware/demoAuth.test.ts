import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response, NextFunction } from 'express';
import { blockDemoUser, getLibraryUserId } from '../../../middleware/demoAuth.js';
import { AuthRequest } from '../../../middleware/auth.js';
import { AppError } from '../../../middleware/errorHandler.js';
import { mockPrisma } from '../../setup.js';

describe('blockDemoUser middleware', () => {
  let mockReq: Partial<AuthRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {};
    mockRes = {};
    mockNext = vi.fn();
    vi.clearAllMocks();
  });

  it('should call next() with error when userId is not set', async () => {
    mockReq.userId = undefined;

    await blockDemoUser(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
    const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(error.message).toBe('Authentication required');
    expect(error.statusCode).toBe(401);
  });

  it('should call next() with error when user is not found', async () => {
    mockReq.userId = 'user-123';
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await blockDemoUser(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
    const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(error.message).toBe('User not found');
    expect(error.statusCode).toBe(404);
  });

  it('should call next() with error when user is demo user', async () => {
    mockReq.userId = 'demo-123';
    mockPrisma.user.findUnique.mockResolvedValue({ role: 'demo' });

    await blockDemoUser(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
    const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(error.statusCode).toBe(403);
    expect(error.message).toContain('demo mode');
  });

  it('should call next() without error for regular user', async () => {
    mockReq.userId = 'user-123';
    mockPrisma.user.findUnique.mockResolvedValue({ role: 'user' });

    await blockDemoUser(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith();
  });

  it('should call next() without error for admin user', async () => {
    mockReq.userId = 'admin-123';
    mockPrisma.user.findUnique.mockResolvedValue({ role: 'admin' });

    await blockDemoUser(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith();
  });
});

describe('getLibraryUserId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return user ID for regular user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: 'user' });

    const result = await getLibraryUserId('user-123');

    expect(result).toBe('user-123');
  });

  it('should return admin ID for demo user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: 'demo' });
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'admin-456' });

    const result = await getLibraryUserId('demo-123');

    expect(result).toBe('admin-456');
  });

  it('should return user ID if no admin found for demo user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: 'demo' });
    mockPrisma.user.findFirst.mockResolvedValue(null);

    const result = await getLibraryUserId('demo-123');

    expect(result).toBe('demo-123');
  });

  it('should return user ID for admin user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: 'admin' });

    const result = await getLibraryUserId('admin-123');

    expect(result).toBe('admin-123');
  });
});
