import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../../../middleware/errorHandler.js';

const { createRedisConnectionMock, incrMock, expireMock, disconnectMock } = vi.hoisted(() => ({
  createRedisConnectionMock: vi.fn(),
  incrMock: vi.fn(),
  expireMock: vi.fn(),
  disconnectMock: vi.fn(),
}));

vi.mock('../../../config/redis.js', () => ({
  createRedisConnection: createRedisConnectionMock,
}));

describe('studyRateLimit middleware', () => {
  let rateLimitStudyRoute: typeof import('../../../middleware/studyRateLimit.js').rateLimitStudyRoute;

  beforeEach(() => {
    vi.resetModules();
    incrMock.mockReset();
    expireMock.mockReset();
    disconnectMock.mockReset();
    createRedisConnectionMock.mockReset();

    createRedisConnectionMock.mockReturnValue({
      incr: incrMock,
      expire: expireMock,
      disconnect: disconnectMock,
    });
  });

  it('returns a 429 AppError after the limit is exceeded and reuses the shared redis client', async () => {
    ({ rateLimitStudyRoute } = await import('../../../middleware/studyRateLimit.js'));
    incrMock.mockResolvedValueOnce(1).mockResolvedValueOnce(3);

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
    expect(disconnectMock).not.toHaveBeenCalled();
  });

  it('fails open when redis is unavailable', async () => {
    ({ rateLimitStudyRoute } = await import('../../../middleware/studyRateLimit.js'));
    incrMock.mockRejectedValue(new Error('redis unavailable'));

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
});
