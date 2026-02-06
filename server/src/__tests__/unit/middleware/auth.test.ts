import { Response, NextFunction } from 'express';
// eslint-disable-next-line import/no-named-as-default-member
import jwt from 'jsonwebtoken';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { requireAuth, AuthRequest } from '../../../middleware/auth.js';
import { AppError } from '../../../middleware/errorHandler.js';

// Mock jwt
vi.mock('jsonwebtoken');

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

  it('should set userId and call next() when token is valid', () => {
    const mockUserId = 'user-123';
    mockReq.cookies = { token: 'valid-token' };

    // eslint-disable-next-line import/no-named-as-default-member
    vi.mocked(jwt.verify).mockImplementation(() => ({ userId: mockUserId }));

    requireAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

    // eslint-disable-next-line import/no-named-as-default-member
    expect(jwt.verify).toHaveBeenCalledWith('valid-token', process.env.JWT_SECRET);
    expect(mockReq.userId).toBe(mockUserId);
    expect(mockNext).toHaveBeenCalledWith();
  });

  it('should call next() with error when token is invalid', () => {
    mockReq.cookies = { token: 'invalid-token' };

    // eslint-disable-next-line import/no-named-as-default-member
    vi.mocked(jwt.verify).mockImplementation(() => {
      // eslint-disable-next-line import/no-named-as-default-member
      throw new jwt.JsonWebTokenError('invalid token');
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
    // eslint-disable-next-line import/no-named-as-default-member
    const expiredError = new jwt.JsonWebTokenError('jwt expired');
    // eslint-disable-next-line import/no-named-as-default-member
    vi.mocked(jwt.verify).mockImplementation(() => {
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

    // eslint-disable-next-line import/no-named-as-default-member
    vi.mocked(jwt.verify).mockImplementation(() => {
      throw customError;
    });

    requireAuth(mockReq as AuthRequest, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(customError);
  });
});
