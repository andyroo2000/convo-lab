import { describe, expect, it } from 'vitest';

import {
  canAdjustMonologueVoiceSpeed,
  getMonologueTtsVoices,
  getMonologueVoiceSpeedOptions,
  getTtsVoiceById,
  normalizeMonologueVoiceSpeed,
} from '@languageflow/shared/src/voiceSelection';

describe('monologue voice selection', () => {
  it('includes Fish Audio and Google Neural2 voices while excluding Wavenet and Polly', () => {
    const voices = getMonologueTtsVoices('ja');
    const voiceIds = voices.map((voice) => voice.id);

    expect(voiceIds.some((id) => id.startsWith('fishaudio:'))).toBe(true);
    expect(voiceIds).toContain('ja-JP-Neural2-B');
    expect(voiceIds).toContain('ja-JP-Neural2-C');
    expect(voiceIds).toContain('ja-JP-Neural2-D');
    expect(voiceIds.some((id) => id.includes('Wavenet'))).toBe(false);
    expect(voiceIds).not.toContain('Takumi');
    expect(voiceIds).not.toContain('Kazuha');
    expect(voiceIds).not.toContain('Tomoko');
  });

  it('enables speed controls only for Google Neural2 voices', () => {
    const googleVoice = getTtsVoiceById('ja', 'ja-JP-Neural2-D');
    const fishVoice = getMonologueTtsVoices('ja').find((voice) =>
      voice.id.startsWith('fishaudio:')
    );

    expect(canAdjustMonologueVoiceSpeed(googleVoice)).toBe(true);
    expect(getMonologueVoiceSpeedOptions(googleVoice)).toEqual([0.75, 0.85, 1]);
    expect(normalizeMonologueVoiceSpeed(googleVoice, 0.75)).toBe(0.75);
    expect(normalizeMonologueVoiceSpeed(googleVoice, 0.5)).toBe(0.85);

    expect(canAdjustMonologueVoiceSpeed(fishVoice)).toBe(false);
    expect(getMonologueVoiceSpeedOptions(fishVoice)).toEqual([1]);
    expect(normalizeMonologueVoiceSpeed(fishVoice, 0.75)).toBe(1);
  });
});
