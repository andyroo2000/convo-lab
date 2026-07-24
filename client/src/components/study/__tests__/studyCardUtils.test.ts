import { describe, expect, it, vi } from 'vitest';

import { toAssetUrl } from '../studyCardUtils';

vi.mock('../../../config', () => ({
  API_URL: 'http://localhost:3001',
}));

describe('studyCardUtils', () => {
  it('keeps direct and legacy Study API media on the browser origin', () => {
    expect(toAssetUrl('/api/study/media/media-1')).toBe('/api/study/media/media-1');
    expect(toAssetUrl('/api/learning-os/study/media/media-1')).toBe(
      '/api/learning-os/study/media/media-1'
    );
    expect(toAssetUrl('/api/daily-audio-practice/practice-1/tracks/track-1/audio')).toBe(
      '/api/daily-audio-practice/practice-1/tracks/track-1/audio'
    );
  });

  it('continues resolving unrelated relative assets against the Express API origin', () => {
    expect(toAssetUrl('/audio/example.mp3')).toBe('http://localhost:3001/audio/example.mp3');
    expect(toAssetUrl('https://cdn.example/audio.mp3')).toBe('https://cdn.example/audio.mp3');
    expect(toAssetUrl(null)).toBeNull();
  });
});
