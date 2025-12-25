import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Response, NextFunction } from 'express';
import { requireAdmin, requireRole, isAdminEmail } from '../../../middleware/roleAuth.js';
import { AuthRequest } from '../../../middleware/auth.js';
import { AppError } from '../../../middleware/errorHandler.js';
import { mockPrisma } from '../../setup.js';

describe('requireAdmin middleware', () => {
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

    await requireAdmin(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
    const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(error.message).toBe('Authentication required');
    expect(error.statusCode).toBe(401);
  });

  it('should call next() with error when user is not found', async () => {
    mockReq.userId = 'user-123';
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await requireAdmin(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
    const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(error.message).toBe('User not found');
    expect(error.statusCode).toBe(404);
  });

  it('should call next() with error when user is not admin', async () => {
    mockReq.userId = 'user-123';
    mockPrisma.user.findUnique.mockResolvedValue({ role: 'user' });

    await requireAdmin(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
    const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(error.message).toBe('Admin access required');
    expect(error.statusCode).toBe(403);
  });

  it('should call next() without error when user is admin', async () => {
    mockReq.userId = 'admin-123';
    mockPrisma.user.findUnique.mockResolvedValue({ role: 'admin' });

    await requireAdmin(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith();
  });
});

describe('requireRole middleware', () => {
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

    const middleware = requireRole(['user', 'admin']);
    await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
    const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(error.message).toBe('Authentication required');
    expect(error.statusCode).toBe(401);
  });

  it('should call next() with error when user is not found', async () => {
    mockReq.userId = 'user-123';
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const middleware = requireRole(['user', 'admin']);
    await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
    const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(error.message).toBe('User not found');
    expect(error.statusCode).toBe(404);
  });

  it('should call next() when user has required role', async () => {
    mockReq.userId = 'user-123';
    mockPrisma.user.findUnique.mockResolvedValue({ role: 'user' });

    const middleware = requireRole(['user', 'admin']);
    await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith();
  });

  it('should call next() with error when user does not have required role', async () => {
    mockReq.userId = 'demo-123';
    mockPrisma.user.findUnique.mockResolvedValue({ role: 'demo' });

    const middleware = requireRole(['user', 'admin']);
    await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
    const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(error.statusCode).toBe(403);
  });

  it('should accept any role from the list', async () => {
    mockReq.userId = 'admin-123';
    mockPrisma.user.findUnique.mockResolvedValue({ role: 'admin' });

    const middleware = requireRole(['user', 'admin']);
    await middleware(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith();
  });
});

describe('isAdminEmail', () => {
  const originalEnv = process.env.ADMIN_EMAILS;

  beforeEach(() => {
    process.env.ADMIN_EMAILS = 'admin@example.com, superadmin@example.com';
  });

  afterEach(() => {
    process.env.ADMIN_EMAILS = originalEnv;
  });

  it('should return true for admin email', () => {
    expect(isAdminEmail('admin@example.com')).toBe(true);
  });

  it('should return true for admin email with different case', () => {
    expect(isAdminEmail('ADMIN@example.com')).toBe(true);
  });

  it('should return false for non-admin email', () => {
    expect(isAdminEmail('user@example.com')).toBe(false);
  });

  it('should handle missing ADMIN_EMAILS env var', () => {
    delete process.env.ADMIN_EMAILS;
    expect(isAdminEmail('admin@example.com')).toBe(false);
  });
});
