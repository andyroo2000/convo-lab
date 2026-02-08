import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { requireAuth, AuthRequest } from '../../../middleware/auth.js';
import { AppError } from '../../../middleware/errorHandler.js';

// Mock jwt
vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
    JsonWebTokenError: class extends Error {},
  },
}));

const { verify, JsonWebTokenError } = jwt;

describe('requireAuth middleware', () => {
  let mockReq: Partial<AuthRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      cookies: {},
    };
    mockRes = {};
    mockNext = vi.fn();
    vi.clearAllMocks();
  });

  it('should call next() with error when no token is provided', () => {
    mockReq.cookies = {};

    requireAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
    const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(error.message).toBe('Authentication required');
    expect(error.statusCode).toBe(401);
  });

  it('should set userId and role when token is valid', () => {
    const mockUserId = 'user-123';
    const mockRole = 'admin';
    mockReq.cookies = { token: 'valid-token' };

    vi.mocked(verify).mockImplementation(() => ({ userId: mockUserId, role: mockRole }));

    requireAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(verify).toHaveBeenCalledWith('valid-token', process.env.JWT_SECRET);
    expect(mockReq.userId).toBe(mockUserId);
    expect(mockReq.role).toBe(mockRole);
    expect(mockNext).toHaveBeenCalledWith();
  });

  it('should call next() with error when token is invalid', () => {
    mockReq.cookies = { token: 'invalid-token' };

    vi.mocked(verify).mockImplementation(() => {
      throw new JsonWebTokenError('invalid token');
    });

    requireAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
    const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(error.message).toBe('Invalid token');
    expect(error.statusCode).toBe(401);
  });

  it('should call next() with error when token is expired', () => {
    mockReq.cookies = { token: 'expired-token' };

    // TokenExpiredError extends JsonWebTokenError, so it should be handled the same way
    const expiredError = new JsonWebTokenError('jwt expired');
    vi.mocked(verify).mockImplementation(() => {
      throw expiredError;
    });

    requireAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
    const error = (mockNext as ReturnType<typeof vi.fn>).mock.calls[0][0] as AppError;
    expect(error.message).toBe('Invalid token');
    expect(error.statusCode).toBe(401);
  });

  it('should pass through non-JWT errors', () => {
    mockReq.cookies = { token: 'some-token' };
    const customError = new Error('Some other error');

    vi.mocked(verify).mockImplementation(() => {
      throw customError;
    });

    requireAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(customError);
  });
});
