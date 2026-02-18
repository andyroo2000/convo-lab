import { describe, expect, it } from 'vitest';

import { buildCounterAudioClipUrl, type CounterAudioCard } from '../preRenderedCounterAudio';

describe('preRenderedCounterAudio', () => {
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
});
