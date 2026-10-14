import { describe, expect, it } from 'vitest';
import { getSelectableTtsVoices } from '@languageflow/shared/src/voiceCatalog';

import { defaultVoiceIdForStudyCardCreationKind } from '../../components/study/studyCardCreationModel';
import studyCapabilitiesFixture from '../../test/studyCapabilitiesFixture';
import { decodeStudyClientCapabilities } from '../learningOsContractDecoders';

const voices = getSelectableTtsVoices('ja')
  .filter((voice) => voice.provider === 'fishaudio')
  .map((voice) => voice.id);

describe('automatic card voices', () => {
  it('decodes all 19 advertised voices and can select every voice for every creation kind', () => {
    const capabilities = decodeStudyClientCapabilities({
      ...studyCapabilitiesFixture,
      cardAuthoring: {
        ...studyCapabilitiesFixture.cardAuthoring,
        defaultAnswerAudioVoiceIds: voices,
      },
    });
    const pool = capabilities.cardAuthoring.defaultAnswerAudioVoiceIds!;
    expect(pool).toEqual(voices);
    expect(pool).toHaveLength(19);
    capabilities.cardAuthoring.creationKinds.forEach((kind) => {
      voices.forEach((voice, index) => {
        expect(
          defaultVoiceIdForStudyCardCreationKind(kind, pool, (index + 0.5) / pool.length)
        ).toBe(voice);
      });
    });
  });

  it.each([{ pool: [] }, { pool: ['', '  '] }])(
    'falls back when the advertised pool is empty (%j)',
    ({ pool }) => {
      const decoded = decodeStudyClientCapabilities({
        ...studyCapabilitiesFixture,
        cardAuthoring: {
          ...studyCapabilitiesFixture.cardAuthoring,
          defaultAnswerAudioVoiceIds: pool,
        },
      });
      expect(decoded.cardAuthoring.defaultAnswerAudioVoiceIds).toEqual(
        studyCapabilitiesFixture.cardAuthoring.defaultAnswerAudioVoiceIds
      );
    }
  );

  it('rejects malformed voice IDs instead of accepting non-string values', () => {
    expect(() =>
      decodeStudyClientCapabilities({
        ...studyCapabilitiesFixture,
        cardAuthoring: {
          ...studyCapabilitiesFixture.cardAuthoring,
          defaultAnswerAudioVoiceIds: [123],
        },
      })
    ).toThrow('must be a string');
  });

  it('accepts older servers that advertise only the two legacy defaults', () => {
    const { cardAuthoring } = decodeStudyClientCapabilities({
      ...studyCapabilitiesFixture,
      cardAuthoring: {
        ...studyCapabilitiesFixture.cardAuthoring,
        defaultAnswerAudioVoiceIds: undefined,
      },
    });
    expect(cardAuthoring.defaultAnswerAudioVoiceIds).toEqual([
      cardAuthoring.defaultAnswerAudioVoiceId,
      cardAuthoring.defaultFemaleAnswerAudioVoiceId,
    ]);
  });
});
