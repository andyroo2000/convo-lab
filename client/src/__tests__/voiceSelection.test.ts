import { describe, expect, it } from 'vitest';

import {
  getCourseSpeakerVoices,
  getDialogueSpeakerVoices,
  getLanguageCodeFromVoiceId,
  getProviderFromVoiceId,
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
    expect(selectableVoiceIds).toEqual(visibleFishVoiceIds);
    expect(selectableVoiceIds).not.toEqual(
      expect.arrayContaining([
        'ja-JP-Neural2-B',
        'ja-JP-Wavenet-C',
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

  it('selects one male and one female voice for two-speaker Japanese audio', () => {
    const selectableVoices = getSelectableTtsVoices('ja');
    const gendersById = new Map(selectableVoices.map((voice) => [voice.id, voice.gender]));
    const courseVoices = getCourseSpeakerVoices('ja', 'en', 2).speakerVoices;
    const dialogueVoices = getDialogueSpeakerVoices('ja', 2);

    expect(new Set(courseVoices.map((voiceId) => gendersById.get(voiceId)))).toEqual(
      new Set(['male', 'female'])
    );
    expect(new Set(dialogueVoices.map((voice) => voice.gender))).toEqual(
      new Set(['male', 'female'])
    );
  });

  it('resolves provider and language conventions through the public barrel', () => {
    expect(getProviderFromVoiceId('fishaudio:875668667eb94c20b09856b971d9ca2f')).toBe('fishaudio');
    expect(getProviderFromVoiceId('ja-JP-Neural2-B')).toBe('google');
    expect(getProviderFromVoiceId('Takumi')).toBe('polly');
    expect(getLanguageCodeFromVoiceId('ja-JP-Neural2-B')).toBe('ja-JP');
    expect(getLanguageCodeFromVoiceId('Takumi')).toBe('ja-JP');
  });
});
