import type { Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requireSameOriginStudyMutation } from '../../../middleware/studyCsrf.js';

describe('studyCsrf middleware', () => {
  const next = vi.fn();

  beforeEach(() => {
    next.mockReset();
    process.env.CLIENT_URL = 'https://app.convo-lab.com';
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
});
