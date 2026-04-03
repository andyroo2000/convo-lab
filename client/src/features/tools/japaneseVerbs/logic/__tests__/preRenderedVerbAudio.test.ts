import { beforeEach, describe, expect, it, vi } from 'vitest';

import { playAudioClipSequence } from '../../../logic/audioClipPlayback';
import {
  buildVerbAudioClipUrl,
  playVerbAudioClip,
  type VerbAudioCard,
} from '../preRenderedVerbAudio';

vi.mock('../../../logic/audioClipPlayback', () => ({
  playAudioClipSequence: vi.fn(() => ({
    stop: vi.fn(),
    finished: Promise.resolve(),
    setVolume: vi.fn(),
  })),
}));

describe('preRenderedVerbAudio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds expected clip URL for verb card', () => {
    const card: VerbAudioCard = {
      verb: { id: 'taberu' },
      conjugation: { id: 'te-form' },
    } as unknown as VerbAudioCard;

    expect(buildVerbAudioClipUrl(card)).toBe(
      '/tools-audio/japanese-verbs/google-kento-professional/taberu/te-form.mp3'
    );
  });

  it('builds URL with different verb and conjugation ids', () => {
    const card: VerbAudioCard = {
      verb: { id: 'miru' },
      conjugation: { id: 'potential-colloquial' },
    } as unknown as VerbAudioCard;

    expect(buildVerbAudioClipUrl(card)).toBe(
      '/tools-audio/japanese-verbs/google-kento-professional/miru/potential-colloquial.mp3'
    );
  });

  it('plays verb clips with signed-url resolution via GCS', () => {
    const card: VerbAudioCard = {
      verb: { id: 'nomu' },
      conjugation: { id: 'casual-past' },
    } as unknown as VerbAudioCard;

    playVerbAudioClip(card, { volume: 0.6 });

    expect(playAudioClipSequence).toHaveBeenCalledWith(
      ['/tools-audio/japanese-verbs/google-kento-professional/nomu/casual-past.mp3'],
      { volume: 0.6 }
    );
  });

  it('passes default options when none provided', () => {
    const card: VerbAudioCard = {
      verb: { id: 'iku' },
      conjugation: { id: 'present-polite' },
    } as unknown as VerbAudioCard;

    playVerbAudioClip(card);

    expect(playAudioClipSequence).toHaveBeenCalledWith(
      ['/tools-audio/japanese-verbs/google-kento-professional/iku/present-polite.mp3'],
      {}
    );
  });
});
