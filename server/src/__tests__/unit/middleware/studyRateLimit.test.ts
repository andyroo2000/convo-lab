import type { Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../../../middleware/errorHandler.js';

const { createRedisConnectionMock, disconnectMock, execMock, expireAtMock, incrMock, multiMock } =
  vi.hoisted(() => ({
    createRedisConnectionMock: vi.fn(),
    execMock: vi.fn(),
    incrMock: vi.fn(),
    multiMock: vi.fn(),
    expireAtMock: vi.fn(),
    disconnectMock: vi.fn(),
  }));

vi.mock('../../../config/redis.js', () => ({
  createRedisConnection: createRedisConnectionMock,
}));

describe('studyRateLimit middleware', () => {
  let rateLimitStudyRoute: typeof import('../../../middleware/studyRateLimit.js').rateLimitStudyRoute;

  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(Date, 'now').mockReturnValue(0);
    execMock.mockReset();
    incrMock.mockReset();
    multiMock.mockReset();
    expireAtMock.mockReset();
    disconnectMock.mockReset();
    createRedisConnectionMock.mockReset();

    multiMock.mockImplementation(() => {
      const pipeline = {
        incr: (...args: unknown[]) => {
          incrMock(...args);
          return pipeline;
        },
        expireat: (...args: unknown[]) => {
          expireAtMock(...args);
          return pipeline;
        },
        exec: execMock,
      };

      return pipeline;
    });

    createRedisConnectionMock.mockReturnValue({
      incr: incrMock,
      expireat: expireAtMock,
      disconnect: disconnectMock,
      multi: multiMock,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a 429 AppError after the limit is exceeded and reuses the shared redis client', async () => {
    ({ rateLimitStudyRoute } = await import('../../../middleware/studyRateLimit.js'));
    execMock
      .mockResolvedValueOnce([
        [null, 1],
        [null, 1],
      ])
      .mockResolvedValueOnce([
        [null, 3],
        [null, 0],
      ]);

    const middleware = rateLimitStudyRoute({
      key: 'session-start',
      max: 2,
      windowMs: 60_000,
    });
    const firstNext = vi.fn();
    const secondNext = vi.fn();

    await middleware(
      { userId: 'user-1', role: 'user' } as never,
      {} as Response,
      firstNext as never
    );

    await middleware(
      { userId: 'user-1', role: 'user' } as never,
      {} as Response,
      secondNext as never
    );

    expect(firstNext).toHaveBeenCalledWith();
    const error = secondNext.mock.calls[0][0] as AppError;
    expect(error.statusCode).toBe(429);
    expect(createRedisConnectionMock).toHaveBeenCalledTimes(1);
    expect(multiMock).toHaveBeenCalledTimes(2);
    expect(incrMock).toHaveBeenNthCalledWith(1, 'rate-limit:study:session-start:user-1:0');
    expect(expireAtMock).toHaveBeenNthCalledWith(
      1,
      'rate-limit:study:session-start:user-1:0',
      60,
      'NX'
    );
    expect(disconnectMock).not.toHaveBeenCalled();
  });

  it('fails open when redis is unavailable', async () => {
    ({ rateLimitStudyRoute } = await import('../../../middleware/studyRateLimit.js'));
    execMock.mockRejectedValue(new Error('redis unavailable'));

    const middleware = rateLimitStudyRoute({
      key: 'reviews',
      max: 2,
      windowMs: 60_000,
    });
    const next = vi.fn();

    await middleware({ userId: 'user-1', role: 'user' } as never, {} as Response, next as never);

    expect(next).toHaveBeenCalledWith();
    expect(createRedisConnectionMock).toHaveBeenCalledTimes(1);
    expect(disconnectMock).not.toHaveBeenCalled();
  });

  it('can fail closed when redis is unavailable for sensitive routes', async () => {
    ({ rateLimitStudyRoute } = await import('../../../middleware/studyRateLimit.js'));
    execMock.mockRejectedValue(new Error('redis unavailable'));

    const middleware = rateLimitStudyRoute({
      key: 'import',
      max: 2,
      windowMs: 60_000,
      onBackendError: 'fail-closed',
    });
    const next = vi.fn();

    await middleware({ userId: 'user-1', role: 'user' } as never, {} as Response, next as never);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 503,
      })
    );
  });

  it('aligns expiration to the window boundary instead of request arrival time', async () => {
    ({ rateLimitStudyRoute } = await import('../../../middleware/studyRateLimit.js'));
    vi.spyOn(Date, 'now').mockReturnValue(55_000);
    execMock.mockResolvedValue([
      [null, 1],
      [null, 1],
    ]);

    const middleware = rateLimitStudyRoute({
      key: 'reviews',
      max: 2,
      windowMs: 60_000,
    });
    const next = vi.fn();

    await middleware({ userId: 'user-1', role: 'user' } as never, {} as Response, next as never);

    expect(next).toHaveBeenCalledWith();
    expect(expireAtMock).toHaveBeenCalledWith('rate-limit:study:reviews:user-1:0', 60, 'NX');
  });
});
