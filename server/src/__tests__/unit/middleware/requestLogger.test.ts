import express, { Request, Response, NextFunction, Router } from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { requestLogger } from '../../../middleware/requestLogger.js';

describe('requestLogger Middleware', () => {
  let mockReq: { method: string; path: string };
  let mockRes: { statusCode: number; on: ReturnType<typeof vi.fn> };
  let mockNext: NextFunction;
  let consoleLogSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Setup mocks
    mockReq = { method: 'GET', path: '/api/test' };

    mockRes = {
      statusCode: 200,
      on: vi.fn(),
    };

    mockNext = vi.fn() as unknown as NextFunction;

    // Spy on console.log
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {}) as unknown as ReturnType<
      typeof vi.fn
    >;
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

  it('emits normalized backend migration telemetry without concrete route parameters', () => {
    mockReq.path = '/api/admin/courses/course-123/pipeline-data';
    vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1150);

    requestLogger(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

    const finishCallback = mockRes.on.mock.calls[0][1];
    finishCallback();

    const structuredLog = consoleLogSpy.mock.calls
      .map(([value]) => value)
      .find((value) => typeof value === 'string' && value.startsWith('{'));
    expect(structuredLog).toBeDefined();
    expect(structuredLog).not.toContain('course-123');
    expect(JSON.parse(structuredLog as string)).toEqual({
      event: 'backend_route_usage',
      schemaVersion: 1,
      routeId: 'admin-courses.pipeline.show',
      surfaceId: 'admin-courses',
      domain: 'admin',
      migrationWave: 'admin',
      runtimeOwner: 'learning-os-proxy',
      method: 'GET',
      normalizedPath: '/api/admin/courses/:id/pipeline-data',
      statusCode: 200,
      durationMs: 150,
    });
  });

  it('classifies successful mounted routes using the full original request path', async () => {
    const app = express();
    const router = Router();
    router.get('/', (_req, res) => res.status(200).json({ dialoguesEnabled: true }));
    app.use(requestLogger);
    app.use('/api/feature-flags', router);

    await request(app).get('/api/feature-flags?source=client').expect(200);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^GET \/api\/feature-flags 200 - \d+ms$/)
    );
    const structuredLog = consoleLogSpy.mock.calls
      .map(([value]) => value)
      .find(
        (value) =>
          typeof value === 'string' &&
          value.includes('"event":"backend_route_usage"') &&
          value.includes('"routeId":"feature-flags.show"')
      );
    expect(structuredLog).toBeDefined();
    expect(JSON.parse(structuredLog as string)).toMatchObject({
      routeId: 'feature-flags.show',
      normalizedPath: '/api/feature-flags',
      statusCode: 200,
    });
    expect(structuredLog).not.toContain('source=client');
  });

  it('preserves network-path references instead of interpreting them as URL authorities', () => {
    const networkPathRequest = {
      method: 'GET',
      path: '/secret',
      originalUrl: '//evil.example/../secret?probe=true',
    };
    vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1010);

    requestLogger(
      networkPathRequest as unknown as Request,
      mockRes as unknown as Response,
      mockNext
    );

    const finishCallback = mockRes.on.mock.calls[0][1];
    finishCallback();

    expect(consoleLogSpy).toHaveBeenCalledWith('GET //evil.example/../secret 200 - 10ms');
  });

  it('marks unknown API routes as unclassified without logging their concrete path in telemetry', () => {
    mockReq.path = '/api/unknown/private-value';
    vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1010);

    requestLogger(mockReq as unknown as Request, mockRes as unknown as Response, mockNext);

    const finishCallback = mockRes.on.mock.calls[0][1];
    finishCallback();

    const structuredLog = consoleLogSpy.mock.calls
      .map(([value]) => value)
      .find((value) => typeof value === 'string' && value.startsWith('{'));
    const event = JSON.parse(structuredLog as string);
    expect(event).toMatchObject({
      routeId: 'unclassified',
      surfaceId: 'unclassified',
      normalizedPath: 'unclassified',
    });
    expect(structuredLog).not.toContain('private-value');
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
