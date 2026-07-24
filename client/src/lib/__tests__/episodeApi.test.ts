import { describe, expect, it } from 'vitest';

import { createEpisodeApiContract, readEpisodeApiError } from '../episodeApi';

describe('episode API contract', () => {
  it('uses permanent Learning OS browser routes', () => {
    const contract = createEpisodeApiContract('https://app.example');

    expect(contract.collection).toBe('https://app.example/api/convolab/episodes');
    expect(contract.member('episode/123')).toBe(
      'https://app.example/api/convolab/episodes/episode%2F123'
    );
  });

  it.each([
    [{ error: 'Legacy failure' }, 'Legacy failure'],
    [{ message: 'Learning OS failure' }, 'Learning OS failure'],
    [{ error: { message: 'Structured failure' } }, 'Structured failure'],
  ])('reads compatible API errors from %j', async (body, expected) => {
    const response = new Response(JSON.stringify(body), {
      status: 422,
      headers: { 'Content-Type': 'application/json' },
    });

    await expect(readEpisodeApiError(response, 'Fallback')).resolves.toBe(expected);
  });

  it('uses the fallback for non-JSON error responses', async () => {
    const response = new Response('upstream unavailable', { status: 502 });

    await expect(readEpisodeApiError(response, 'Fallback')).resolves.toBe('Fallback');
  });
});
