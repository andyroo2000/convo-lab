import { describe, expect, it } from 'vitest';

import { createGenerationApiContract } from '../generationApi';

describe('generation API contract', () => {
  it('builds canonical Learning OS generation routes and encodes job IDs', () => {
    const contract = createGenerationApiContract('https://app.example');

    expect(contract.dialogue.generate).toBe('https://app.example/api/convolab/dialogue/generate');
    expect(contract.dialogue.job('job/123')).toBe(
      'https://app.example/api/convolab/dialogue/job/job%2F123'
    );
    expect(contract.audio.generate).toBe('https://app.example/api/convolab/audio/generate');
    expect(contract.audio.generateAllSpeeds).toBe(
      'https://app.example/api/convolab/audio/generate-all-speeds'
    );
    expect(contract.audio.job('job/123')).toBe(
      'https://app.example/api/convolab/audio/job/job%2F123'
    );
    expect(contract.images.generate).toBe('https://app.example/api/convolab/images/generate');
    expect(contract.images.job('job/123')).toBe(
      'https://app.example/api/convolab/images/job/job%2F123'
    );
  });
});
