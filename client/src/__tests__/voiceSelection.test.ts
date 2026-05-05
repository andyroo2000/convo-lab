import { describe, expect, it } from 'vitest';

import {
  getSelectableTtsVoices,
  getTtsVoiceAvatarPath,
  getTtsVoiceById,
} from '@languageflow/shared/src/voiceSelection';

describe('voiceSelection', () => {
  it('keeps hidden legacy voices findable but out of selectable picker options', () => {
    const legacyVoice = getTtsVoiceById('ja', 'ja-JP-Neural2-D');
    const hiddenPollyVoice = getTtsVoiceById('ja', 'Takumi');
    const visibleFishVoiceIds = getSelectableTtsVoices('ja')
      .filter((voice) => voice.provider === 'fishaudio')
      .map((voice) => voice.id);
    const selectableVoiceIds = getSelectableTtsVoices('ja').map((voice) => voice.id);

    expect(legacyVoice).toMatchObject({
      id: 'ja-JP-Neural2-D',
      hiddenFromPicker: true,
    });
    expect(hiddenPollyVoice).toMatchObject({
      id: 'Takumi',
      hiddenFromPicker: true,
    });
    expect(selectableVoiceIds).toEqual(
      expect.arrayContaining([...visibleFishVoiceIds, 'ja-JP-Wavenet-C'])
    );
    expect(selectableVoiceIds).not.toEqual(
      expect.arrayContaining([
        'ja-JP-Neural2-B',
        'ja-JP-Wavenet-D',
        'ja-JP-Neural2-D',
        'Takumi',
        'Kazuha',
        'Tomoko',
      ])
    );
  });

  it('maps voice configs to signed speaker avatar endpoint paths', () => {
    const shohei = getTtsVoiceById('ja', 'ja-JP-Wavenet-C');
    const nanami = getTtsVoiceById('ja', 'ja-JP-Neural2-B');
    const englishVoice = getTtsVoiceById('en', 'en-US-Neural2-J');

    expect(shohei).toBeDefined();
    expect(nanami).toBeDefined();
    expect(englishVoice).toBeDefined();
    expect(getTtsVoiceAvatarPath('ja', shohei!)).toBe('/api/avatars/voices/ja-shohei.jpg');
    expect(getTtsVoiceAvatarPath('ja', nanami!)).toBe('/api/avatars/voices/ja-nanami.jpg');
    expect(getTtsVoiceAvatarPath('en', englishVoice!)).toBeNull();
  });
});
