import { getAudioScriptTtsVoices } from '@languageflow/shared/src/voiceSelection.js';
import { describe, expect, it } from 'vitest';

import {
  AUDIO_SCRIPT_SPEEDS,
  buildAudioScriptUnits,
} from '../../../services/audioScriptService.js';

describe('audioScriptService', () => {
  it('uses the requested Google Neural2 script speeds', () => {
    expect(AUDIO_SCRIPT_SPEEDS.map((speed) => speed.speed)).toEqual(['0.75', '0.85', '1.0']);
    expect(AUDIO_SCRIPT_SPEEDS.map((speed) => speed.numericSpeed)).toEqual([0.75, 0.85, 1.0]);
  });

  it('exposes Google Neural2 voices for script creation while excluding Wavenet, Polly, and Fish', () => {
    const voices = getAudioScriptTtsVoices('ja');

    expect(voices.map((voice) => voice.id)).toEqual(
      expect.arrayContaining(['ja-JP-Neural2-B', 'ja-JP-Neural2-C', 'ja-JP-Neural2-D'])
    );
    expect(voices.every((voice) => voice.provider === 'google')).toBe(true);
    expect(voices.every((voice) => voice.id.includes('-Neural2-'))).toBe(true);
  });

  it('maps reviewed segments to L2 units with pauses for subtitle timing', () => {
    const units = buildAudioScriptUnits({
      voiceId: 'ja-JP-Neural2-D',
      speed: 0.75,
      segments: [
        {
          text: '日本に住んでいます。',
          reading: '日本[にほん]に住[す]んでいます。',
          translation: 'I live in Japan.',
        },
        {
          text: '毎日楽しいです。',
          reading: '毎日[まいにち]楽[たの]しいです。',
          translation: 'Every day is fun.',
        },
      ],
    });

    expect(units).toEqual([
      {
        type: 'L2',
        text: '日本に住んでいます。',
        reading: '日本[にほん]に住[す]んでいます。',
        translation: 'I live in Japan.',
        voiceId: 'ja-JP-Neural2-D',
        speed: 0.75,
      },
      { type: 'pause', seconds: 0.35 },
      {
        type: 'L2',
        text: '毎日楽しいです。',
        reading: '毎日[まいにち]楽[たの]しいです。',
        translation: 'Every day is fun.',
        voiceId: 'ja-JP-Neural2-D',
        speed: 0.75,
      },
    ]);
  });
});
