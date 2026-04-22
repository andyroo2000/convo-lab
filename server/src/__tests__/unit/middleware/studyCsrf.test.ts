import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requireSameOriginStudyMutation } from '../../../middleware/studyCsrf.js';

describe('studyCsrf middleware', () => {
  const next = vi.fn();

  beforeEach(() => {
    next.mockReset();
    process.env.CLIENT_URL = 'https://app.convo-lab.com';
    vi.restoreAllMocks();
  });

  it('allows same-origin mutation requests from the configured client origin', () => {
    requireSameOriginStudyMutation(
      {
        method: 'POST',
        protocol: 'https',
        get: (header: string) => {
          if (header.toLowerCase() === 'origin') {
            return 'https://app.convo-lab.com';
          }

          if (header.toLowerCase() === 'host') {
            return 'api.convo-lab.com';
          }

          return undefined;
        },
      } as never,
      {} as Response,
      next
    );

    expect(next).toHaveBeenCalledWith();
  });

  it('rejects mutation requests when origin is missing', () => {
    requireSameOriginStudyMutation(
      {
        method: 'PATCH',
        protocol: 'https',
        get: (header: string) => {
          if (header.toLowerCase() === 'host') {
            return 'api.convo-lab.com';
          }

          return undefined;
        },
      } as never,
      {} as Response,
      next
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
      })
    );
  });

  it('blocks cross-origin mutation requests', () => {
    requireSameOriginStudyMutation(
      {
        method: 'POST',
        protocol: 'https',
        get: (header: string) => {
          if (header.toLowerCase() === 'origin') {
            return 'https://evil.example.com';
          }

          if (header.toLowerCase() === 'host') {
            return 'api.convo-lab.com';
          }

          return undefined;
        },
      } as never,
      {} as Response,
      next
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
      })
    );
  });

  it('does not trust forwarded host headers when validating the origin', () => {
    requireSameOriginStudyMutation(
      {
        method: 'POST',
        protocol: 'https',
        get: (header: string) => {
          if (header.toLowerCase() === 'origin') {
            return 'https://evil.example.com';
          }

          if (header.toLowerCase() === 'x-forwarded-proto') {
            return 'https';
          }

          if (header.toLowerCase() === 'x-forwarded-host') {
            return 'evil.example.com';
          }

          if (header.toLowerCase() === 'host') {
            return 'api.convo-lab.com';
          }

          return undefined;
        },
      } as never,
      {} as Response,
      next
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
      })
    );
  });

  it('allows localhost development origins outside production', () => {
    process.env.NODE_ENV = 'test';

    requireSameOriginStudyMutation(
      {
        method: 'POST',
        protocol: 'http',
        get: (header: string) => {
          if (header.toLowerCase() === 'origin') {
            return 'http://localhost:5173';
          }

          if (header.toLowerCase() === 'host') {
            return 'localhost:3001';
          }

          return undefined;
        },
      } as never,
      {} as Response,
      next
    );

    expect(next).toHaveBeenCalledWith();
  });

  it('allows read-only requests without origin checks', () => {
    requireSameOriginStudyMutation(
      {
        method: 'GET',
        protocol: 'https',
        get: () => undefined,
      } as never,
      {} as Response,
      next
    );

    expect(next).toHaveBeenCalledWith();
  });

  it('rebuilds cached origins when CLIENT_URL changes', () => {
    requireSameOriginStudyMutation(
      {
        method: 'POST',
        get: (header: string) =>
          header.toLowerCase() === 'origin' ? 'https://app.convo-lab.com' : undefined,
      } as never,
      {} as Response,
      next
    );

    expect(next).toHaveBeenCalledWith();
    next.mockReset();

    process.env.CLIENT_URL = 'https://preview.convo-lab.com';

    requireSameOriginStudyMutation(
      {
        method: 'POST',
        get: (header: string) =>
          header.toLowerCase() === 'origin' ? 'https://preview.convo-lab.com' : undefined,
      } as never,
      {} as Response,
      next
    );

    expect(next).toHaveBeenCalledWith();
  });

  it('warns when CLIENT_URL is missing or invalid', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.CLIENT_URL = 'not-a-url';

    requireSameOriginStudyMutation(
      {
        method: 'POST',
        get: (header: string) =>
          header.toLowerCase() === 'origin' ? 'https://app.convo-lab.com' : undefined,
      } as never,
      {} as Response,
      next
    );

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('CLIENT_URL is missing or invalid')
    );
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
      })
    );
  });
});
