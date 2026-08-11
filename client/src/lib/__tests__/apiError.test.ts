import { describe, expect, it, vi } from 'vitest';

import readApiError from '../apiError';

function response(body: unknown): Response {
  return {
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('readApiError', () => {
  it('preserves the canonical structured error precedence', async () => {
    await expect(
      readApiError(
        response({
          error: 'Top-level error',
          message: 'Message',
        }),
        'Fallback'
      )
    ).resolves.toBe('Top-level error');

    await expect(
      readApiError(
        response({
          message: 'Message',
          error: { message: 'Nested error' },
        }),
        'Fallback'
      )
    ).resolves.toBe('Message');
  });

  it('skips blank higher-precedence candidates', async () => {
    await expect(
      readApiError(
        response({
          error: '   ',
          message: 'Message',
        }),
        'Fallback'
      )
    ).resolves.toBe('Message');

    await expect(
      readApiError(
        response({
          message: '',
          error: { message: 'Nested error' },
        }),
        'Fallback'
      )
    ).resolves.toBe('Nested error');
  });

  it.each([
    [{ error: '' }],
    [{ error: '   ' }],
    [{ message: '' }],
    [{ message: '\n\t' }],
    [{ error: { message: '' } }],
    [{ error: { message: '  ' } }],
  ])('falls back when the selected API error candidate is blank', async (body) => {
    await expect(readApiError(response(body), 'Request failed')).resolves.toBe('Request failed');
  });
});
