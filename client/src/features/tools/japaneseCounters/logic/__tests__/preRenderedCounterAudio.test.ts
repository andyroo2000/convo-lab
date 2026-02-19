import { beforeEach, describe, expect, it, vi } from 'vitest';

import { playAudioClipSequence } from '../../../logic/audioClipPlayback';
import {
  buildCounterAudioClipUrl,
  playCounterAudioClip,
  type CounterAudioCard,
} from '../preRenderedCounterAudio';

vi.mock('../../../logic/audioClipPlayback', () => ({
  playAudioClipSequence: vi.fn(() => ({
    stop: vi.fn(),
    finished: Promise.resolve(),
    setVolume: vi.fn(),
  })),
}));

describe('preRenderedCounterAudio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds expected clip URL for counter card', () => {
    const card = {
      counterId: 'hon',
      quantity: 6,
      object: { id: 'pencil' },
    } as CounterAudioCard;

    expect(buildCounterAudioClipUrl(card)).toBe(
      '/tools-audio/japanese-counters/google-kento-professional/phrase/hon/pencil/06.mp3'
    );
  });

  it.each([
    [0, 'quantity must be between 1 and 10'],
    [11, 'quantity must be between 1 and 10'],
  ])('throws for out-of-range quantity %i', (quantity, expectedMessage) => {
    expect(() =>
      buildCounterAudioClipUrl({
        counterId: 'mai',
        quantity,
        object: { id: 'paper' },
      } as CounterAudioCard)
    ).toThrow(expectedMessage);
  });

  it('plays counter clips without signed-url resolution', () => {
    const card = {
      counterId: 'hon',
      quantity: 3,
      object: { id: 'umbrella' },
    } as CounterAudioCard;

    playCounterAudioClip(card, { volume: 0.35 });

    expect(playAudioClipSequence).toHaveBeenCalledWith(
      ['/tools-audio/japanese-counters/google-kento-professional/phrase/hon/umbrella/03.mp3'],
      { volume: 0.35, resolveToolAudioUrls: false }
    );
  });
});
