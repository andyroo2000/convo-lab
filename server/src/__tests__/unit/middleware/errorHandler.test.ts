import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { AppError, errorHandler } from '../../../middleware/errorHandler.js';

describe('AppError', () => {
  it('should create an error with message and status code', () => {
    const error = new AppError('Test error', 400);

    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(400);
    expect(error.isOperational).toBe(true);
    expect(error).toBeInstanceOf(Error);
  });

  it('should default to status code 500', () => {
    const error = new AppError('Server error');

    expect(error.statusCode).toBe(500);
  });
});

describe('errorHandler middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockReq = {};
    mockRes = {
      status: statusMock,
      json: jsonMock,
    };
    mockNext = vi.fn();

    // Suppress console.error for unhandled errors
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should handle AppError with correct status code and message', () => {
    const error = new AppError('Not found', 404);

    errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith({
      error: {
        message: 'Not found',
        statusCode: 404,
      },
    });
  });

  it('should handle 401 Unauthorized errors', () => {
    const error = new AppError('Unauthorized', 401);

    errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith({
      error: {
        message: 'Unauthorized',
        statusCode: 401,
      },
    });
  });

  it('should handle 403 Forbidden errors', () => {
    const error = new AppError('Forbidden', 403);

    errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(statusMock).toHaveBeenCalledWith(403);
    expect(jsonMock).toHaveBeenCalledWith({
      error: {
        message: 'Forbidden',
        statusCode: 403,
      },
    });
  });

  it('should handle unknown errors with 500 status in development', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const error = new Error('Some internal error');

    errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      error: {
        message: 'Some internal error',
        statusCode: 500,
      },
    });

    process.env.NODE_ENV = originalEnv;
  });

  it('should hide error message in production for unknown errors', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const error = new Error('Sensitive internal error');

    errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      error: {
        message: 'Internal server error',
        statusCode: 500,
      },
    });

    process.env.NODE_ENV = originalEnv;
  });

  it('should log unhandled errors to console', () => {
    const error = new Error('Unhandled error');

    errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

    expect(console.error).toHaveBeenCalledWith('Unhandled error:', error);
  });

  describe('Rate Limit Headers (429 errors)', () => {
    let setMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      setMock = vi.fn();
      mockRes.set = setMock;
    });

    it('should set X-RateLimit headers for 429 errors with quota metadata', () => {
      const resetsAt = new Date('2024-01-01T00:00:00Z');
      const error = new AppError('Rate limit exceeded', 429, {
        quota: {
          limit: 100,
          remaining: 0,
          resetsAt,
        },
      });

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(setMock).toHaveBeenCalledWith({
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': resetsAt.toISOString(),
      });
      expect(statusMock).toHaveBeenCalledWith(429);
    });

    it('should set Retry-After header for 429 errors with cooldown metadata', () => {
      const error = new AppError('Cooldown active', 429, {
        cooldown: {
          remainingSeconds: 60,
        },
      });

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(setMock).toHaveBeenCalledWith({
        'Retry-After': '60',
      });
      expect(statusMock).toHaveBeenCalledWith(429);
    });

    it('should set both quota and cooldown headers when both are present', () => {
      const resetsAt = new Date('2024-01-01T00:00:00Z');
      const error = new AppError('Rate limit with cooldown', 429, {
        quota: {
          limit: 50,
          remaining: 0,
          resetsAt,
        },
        cooldown: {
          remainingSeconds: 120,
        },
      });

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(setMock).toHaveBeenCalledWith({
        'X-RateLimit-Limit': '50',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': resetsAt.toISOString(),
      });
      expect(setMock).toHaveBeenCalledWith({
        'Retry-After': '120',
      });
      expect(statusMock).toHaveBeenCalledWith(429);
    });

    it('should not set headers for 429 errors without metadata', () => {
      const error = new AppError('Rate limit exceeded', 429);

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(setMock).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(429);
    });

    it('should not set headers for 429 errors with metadata but no quota or cooldown', () => {
      const error = new AppError('Rate limit exceeded', 429, {
        someOtherField: 'value',
      });

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(setMock).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(429);
    });
  });

  describe('Metadata Handling', () => {
    it('should include metadata in response for AppError', () => {
      const error = new AppError('Error with metadata', 400, {
        field: 'email',
        reason: 'invalid format',
      });

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: {
          message: 'Error with metadata',
          statusCode: 400,
          field: 'email',
          reason: 'invalid format',
        },
      });
    });

    it('should include nested metadata in response', () => {
      const error = new AppError('Validation error', 422, {
        errors: [
          { field: 'email', message: 'Required' },
          { field: 'password', message: 'Too short' },
        ],
      });

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(422);
      expect(jsonMock).toHaveBeenCalledWith({
        error: {
          message: 'Validation error',
          statusCode: 422,
          errors: [
            { field: 'email', message: 'Required' },
            { field: 'password', message: 'Too short' },
          ],
        },
      });
    });

    it('should not include metadata when not provided', () => {
      const error = new AppError('Simple error', 400);

      errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

      expect(jsonMock).toHaveBeenCalledWith({
        error: {
          message: 'Simple error',
          statusCode: 400,
        },
      });
    });
  });
});
