import { Request, Response, NextFunction } from 'express';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { requestLogger } from '../../../middleware/requestLogger.js';

describe('requestLogger Middleware', () => {
  let mockReq: { method: string; path: string };
  let mockRes: { statusCode: number; on: ReturnType<typeof vi.fn> };
  let mockNext: NextFunction;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Setup mocks
    mockReq = { method: 'GET', path: '/api/test' };

    mockRes = {
      statusCode: 200,
      on: vi.fn(),
    };

    mockNext = vi.fn();

    // Spy on console.log
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call next() immediately', () => {
    requestLogger(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it('should register a finish event listener on response', () => {
    requestLogger(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

    expect(mockRes.on).toHaveBeenCalledWith('finish', expect.any(Function));
  });

  it('should log request details when response finishes', () => {
    // Mock Date.now for consistent timing
    const startTime = 1000;
    const endTime = 1150;
    vi.spyOn(Date, 'now').mockReturnValueOnce(startTime).mockReturnValueOnce(endTime);

    requestLogger(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

    // Get the finish callback and call it
    const finishCallback = mockRes.on.mock.calls[0][1];
    finishCallback();

    expect(consoleLogSpy).toHaveBeenCalledWith('GET /api/test 200 - 150ms');
  });

  it('should log correct method for POST requests', () => {
    mockReq.method = 'POST';

    vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1050);

    requestLogger(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

    const finishCallback = mockRes.on.mock.calls[0][1];
    finishCallback();

    expect(consoleLogSpy).toHaveBeenCalledWith('POST /api/test 200 - 50ms');
  });

  it('should log correct status code for error responses', () => {
    mockRes.statusCode = 500;

    vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1200);

    requestLogger(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

    const finishCallback = mockRes.on.mock.calls[0][1];
    finishCallback();

    expect(consoleLogSpy).toHaveBeenCalledWith('GET /api/test 500 - 200ms');
  });

  it('should log correct status code for 404 responses', () => {
    mockRes.statusCode = 404;
    mockReq.path = '/api/not-found';

    vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1010);

    requestLogger(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

    const finishCallback = mockRes.on.mock.calls[0][1];
    finishCallback();

    expect(consoleLogSpy).toHaveBeenCalledWith('GET /api/not-found 404 - 10ms');
  });

  it('should log correct path for nested routes', () => {
    mockReq.path = '/api/v1/users/123/episodes';

    vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1100);

    requestLogger(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

    const finishCallback = mockRes.on.mock.calls[0][1];
    finishCallback();

    expect(consoleLogSpy).toHaveBeenCalledWith('GET /api/v1/users/123/episodes 200 - 100ms');
  });

  it('should handle different HTTP methods', () => {
    const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

    methods.forEach((method, index) => {
      mockReq.method = method;
      mockRes.on = vi.fn();

      vi.spyOn(Date, 'now')
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1000 + (index + 1) * 10);

      requestLogger(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

      const finishCallback = mockRes.on.mock.calls[0][1];
      finishCallback();

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(method));
    });
  });

  it('should calculate correct duration for fast requests', () => {
    vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1001);

    requestLogger(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

    const finishCallback = mockRes.on.mock.calls[0][1];
    finishCallback();

    expect(consoleLogSpy).toHaveBeenCalledWith('GET /api/test 200 - 1ms');
  });

  it('should calculate correct duration for slow requests', () => {
    vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(11000); // 10 seconds later

    requestLogger(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

    const finishCallback = mockRes.on.mock.calls[0][1];
    finishCallback();

    expect(consoleLogSpy).toHaveBeenCalledWith('GET /api/test 200 - 10000ms');
  });

  it('should handle 201 created status', () => {
    mockReq.method = 'POST';
    mockRes.statusCode = 201;

    vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1075);

    requestLogger(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

    const finishCallback = mockRes.on.mock.calls[0][1];
    finishCallback();

    expect(consoleLogSpy).toHaveBeenCalledWith('POST /api/test 201 - 75ms');
  });

  it('should handle 204 no content status', () => {
    mockReq.method = 'DELETE';
    mockRes.statusCode = 204;

    vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1025);

    requestLogger(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

    const finishCallback = mockRes.on.mock.calls[0][1];
    finishCallback();

    expect(consoleLogSpy).toHaveBeenCalledWith('DELETE /api/test 204 - 25ms');
  });
});
