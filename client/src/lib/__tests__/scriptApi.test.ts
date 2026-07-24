import { describe, expect, it } from 'vitest';

import { createScriptApiContract } from '../scriptApi';

describe('script API contract', () => {
  it('uses permanent Learning OS browser routes and encodes identifiers', () => {
    const contract = createScriptApiContract('https://app.example');

    expect(contract.collection).toBe('https://app.example/api/convolab/scripts');
    expect(contract.operation('episode/123', 'status')).toBe(
      'https://app.example/api/convolab/scripts/episode%2F123/status'
    );
    expect(contract.job('job/123')).toBe('https://app.example/api/convolab/scripts/job/job%2F123');
    expect(contract.media('media/123')).toBe(
      'https://app.example/api/convolab/scripts/media/media%2F123'
    );
    expect(contract.audio('episode/123', 'render/123')).toBe(
      'https://app.example/api/convolab/scripts/episode%2F123/audio/render%2F123'
    );
  });
});
