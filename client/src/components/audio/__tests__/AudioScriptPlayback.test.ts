import { describe, expect, it } from 'vitest';

import type { AudioScriptRender, AudioScriptSegment } from '../../../types';
import {
  getSegmentImageUrl,
  resolveScriptAudioUrl,
  resolveScriptAudioUrls,
} from '../scriptPlaybackRoutes';

const render: AudioScriptRender = {
  id: 'render-123',
  scriptId: 'script-123',
  speed: '0.85',
  numericSpeed: 0.85,
  status: 'ready',
  audioUrl: '/api/scripts/episode-old/audio/render-old',
  createdAt: new Date(),
  updatedAt: new Date(0),
};

const segment: AudioScriptSegment = {
  id: 'segment-123',
  scriptId: 'script-123',
  order: 0,
  text: '駅です。',
  translation: 'It is a station.',
  imageStatus: 'ready',
  imageMediaId: 'media-123',
  imageMedia: {
    id: 'media-123',
    mediaKind: 'image',
    contentType: 'image/webp',
    publicUrl: '/api/scripts/media/media-old',
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AudioScriptPlayback routes', () => {
  it('derives permanent Learning OS media URLs from stable identifiers', () => {
    expect(getSegmentImageUrl(segment)).toBe('/api/convolab/scripts/media/media-123');
    expect(resolveScriptAudioUrl('episode-123', render)).toContain(
      '/api/convolab/scripts/episode-123/audio/render-123?v='
    );
  });

  it('warms the same permanent route selected for playback', () => {
    expect(resolveScriptAudioUrls('episode-123', [render])[0]).toContain(
      '/api/convolab/scripts/episode-123/audio/render-123?v='
    );
  });
});
