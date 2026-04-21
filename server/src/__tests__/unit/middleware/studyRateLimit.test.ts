import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../../../middleware/errorHandler.js';
import { rateLimitStudyRoute } from '../../../middleware/studyRateLimit.js';

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
  beforeEach(() => {
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

  it('returns a 429 AppError after the limit is exceeded', async () => {
    incrMock.mockResolvedValue(3);

    const middleware = rateLimitStudyRoute({
      key: 'session-start',
      max: 2,
      windowMs: 60_000,
    });
    const next = vi.fn();

    await middleware({ userId: 'user-1', role: 'user' } as never, {} as Response, next as never);

    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    const error = next.mock.calls[0][0] as AppError;
    expect(error.statusCode).toBe(429);
    expect(disconnectMock).toHaveBeenCalled();
  });

  it('fails open when redis is unavailable', async () => {
    incrMock.mockRejectedValue(new Error('redis unavailable'));

    const middleware = rateLimitStudyRoute({
      key: 'reviews',
      max: 2,
      windowMs: 60_000,
    });
    const next = vi.fn();

    await middleware({ userId: 'user-1', role: 'user' } as never, {} as Response, next as never);

    expect(next).toHaveBeenCalledWith();
    expect(disconnectMock).toHaveBeenCalled();
  });
});
