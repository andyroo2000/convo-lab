import { describe, expect, it } from 'vitest';

import { DEFAULT_NARRATOR_VOICES, TTS_VOICES } from '@languageflow/shared/src/constants-new';
import { getSelectableTtsVoices } from '@languageflow/shared/src/voiceSelection';

import { buildStudyCardFormPayload, getStudyCardFormValues } from '../studyCardFormModel';

describe('studyCardFormModel', () => {
  it('builds a recognition payload with null-normalized optional fields', () => {
    const payload = buildStudyCardFormPayload({
      cardType: 'recognition',
      cueText: '会社',
      cueReading: '',
      cueMeaning: '',
      answerExpression: '会社',
      answerReading: '',
      answerMeaning: 'company',
      answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
      answerAudioTextOverride: '',
      notes: '',
      sentenceJp: '',
      sentenceEn: '',
    });

    expect(payload).toEqual({
      cardType: 'recognition',
      prompt: {
        cueText: '会社',
        cueReading: null,
        cueMeaning: null,
      },
      answer: {
        expression: '会社',
        expressionReading: null,
        meaning: 'company',
        answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
        answerAudioTextOverride: null,
        sentenceJp: null,
        sentenceEn: null,
        notes: null,
      },
    });
  });

  it('builds a production payload with sentence fields preserved', () => {
    const payload = buildStudyCardFormPayload({
      cardType: 'production',
      cueText: 'company',
      cueReading: '',
      cueMeaning: 'hint',
      answerExpression: '会社',
      answerReading: '会社[かいしゃ]',
      answerMeaning: 'company',
      answerAudioVoiceId: 'ja-JP-Wavenet-D',
      answerAudioTextOverride: 'かいしゃ',
      notes: 'Use in business contexts.',
      sentenceJp: '会社に行きます。',
      sentenceEn: 'I am going to the company.',
    });

    expect(payload).toEqual({
      cardType: 'production',
      prompt: {
        cueText: 'company',
        cueReading: null,
        cueMeaning: 'hint',
      },
      answer: {
        expression: '会社',
        expressionReading: '会社[かいしゃ]',
        meaning: 'company',
        answerAudioVoiceId: 'ja-JP-Wavenet-D',
        answerAudioTextOverride: 'かいしゃ',
        sentenceJp: '会社に行きます。',
        sentenceEn: 'I am going to the company.',
        notes: 'Use in business contexts.',
      },
    });
  });

  it('does not carry cloze-only answer fields into non-cloze payloads', () => {
    const payload = buildStudyCardFormPayload(
      {
        cardType: 'recognition',
        cueText: '会社',
        cueReading: 'かいしゃ',
        cueMeaning: 'company',
        answerExpression: '会社',
        answerReading: '会社[かいしゃ]',
        answerMeaning: 'company',
        answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
        answerAudioTextOverride: '',
        notes: '',
        sentenceJp: '',
        sentenceEn: '',
      },
      {
        id: 'card-1',
        noteId: 'note-1',
        cardType: 'recognition',
        prompt: {
          cueText: '会社',
          cueReading: 'かいしゃ',
        },
        answer: {
          expression: '会社',
          expressionReading: '会社[かいしゃ]',
          restoredText: '会社',
          restoredTextReading: '会社[かいしゃ]',
        },
        state: {
          dueAt: null,
          queueState: 'new',
          scheduler: null,
          source: {},
        },
        answerAudioSource: 'missing',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );

    expect(payload.answer).not.toHaveProperty('restoredText');
    expect(payload.answer).not.toHaveProperty('restoredTextReading');
  });

  it('keeps audio-recognition edit payloads audio-led without requiring prompt text', () => {
    const promptAudio = {
      filename: 'prompt.mp3',
      url: 'https://example.com/prompt.mp3',
      mediaKind: 'audio' as const,
      source: 'generated' as const,
    };
    const payload = buildStudyCardFormPayload(
      {
        cardType: 'recognition',
        cueText: '',
        cueReading: '',
        cueMeaning: '',
        answerExpression: '会社',
        answerReading: '会社[かいしゃ]',
        answerMeaning: 'company',
        answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
        answerAudioTextOverride: '',
        notes: '',
        sentenceJp: '',
        sentenceEn: '',
      },
      {
        id: 'card-audio',
        noteId: 'note-audio',
        cardType: 'recognition',
        prompt: {
          cueAudio: promptAudio,
        },
        answer: {
          expression: '会社',
          expressionReading: '会社[かいしゃ]',
          meaning: 'company',
        },
        state: {
          dueAt: null,
          queueState: 'new',
          scheduler: null,
          source: {},
        },
        answerAudioSource: 'missing',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );

    expect(payload.prompt).toEqual({
      cueAudio: promptAudio,
      cueText: null,
      cueReading: null,
      cueMeaning: null,
    });
  });

  it('builds a cloze payload with null-normalized hint and notes', () => {
    const payload = buildStudyCardFormPayload({
      cardType: 'cloze',
      cueText: 'お風呂に虫[がいる]！',
      cueReading: '',
      cueMeaning: '',
      answerExpression: 'お風呂に虫がいる！',
      answerReading: '',
      answerMeaning: 'There are bugs in the bath!',
      answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
      answerAudioTextOverride: '',
      notes: '',
      sentenceJp: '',
      sentenceEn: '',
    });

    expect(payload).toEqual({
      cardType: 'cloze',
      prompt: {
        clozeText: 'お風呂に虫{{c1::がいる}}！',
        clozeDisplayText: 'お風呂に虫[...]！',
        clozeAnswerText: 'がいる',
        clozeResolvedHint: null,
        clozeHint: null,
      },
      answer: {
        restoredText: 'お風呂に虫がいる！',
        restoredTextReading: null,
        meaning: 'There are bugs in the bath!',
        answerAudioVoiceId: DEFAULT_NARRATOR_VOICES.ja,
        answerAudioTextOverride: null,
        notes: null,
      },
    });
  });

  it('hydrates edit values from an existing cloze card', () => {
    const values = getStudyCardFormValues({
      card: {
        id: 'card-1',
        noteId: 'note-1',
        cardType: 'cloze',
        prompt: {
          clozeText: 'お風呂に虫{{c1::がいる}}！',
          clozeResolvedHint: 'are',
        },
        answer: {
          restoredText: 'お風呂に虫がいる！',
          restoredTextReading: 'お風呂[ふろ]に虫[むし]がいる！',
          meaning: 'There are bugs in the bath!',
          answerAudioVoiceId: 'ja-JP-Neural2-B',
          answerAudioTextOverride: 'おふろにむしがいる',
          notes: 'Keep calm.',
        },
        state: {
          dueAt: null,
          queueState: 'new',
          scheduler: null,
          source: {},
        },
        answerAudioSource: 'missing',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    expect(values).toMatchObject({
      cardType: 'cloze',
      cueText: 'お風呂に虫{{c1::がいる}}！',
      cueMeaning: 'are',
      answerExpression: 'お風呂に虫がいる！',
      answerReading: 'お風呂[ふろ]に虫[むし]がいる！',
      answerMeaning: 'There are bugs in the bath!',
      answerAudioVoiceId: 'ja-JP-Neural2-B',
      answerAudioTextOverride: 'おふろにむしがいる',
      notes: 'Keep calm.',
    });
  });

  it('limits Japanese Google voice options while preserving Fish Audio voices', () => {
    const japaneseVoices = TTS_VOICES.ja.voices;
    const selectableJapaneseVoices = getSelectableTtsVoices('ja');
    const fishAudioVoiceIds = japaneseVoices
      .filter((voice) => voice.provider === 'fishaudio')
      .map((voice) => voice.id);
    const selectableGoogleVoices = selectableJapaneseVoices.filter(
      (voice) => voice.provider === 'google'
    );

    expect(selectableJapaneseVoices.map((voice) => voice.id)).toEqual(
      expect.arrayContaining(fishAudioVoiceIds)
    );
    expect(selectableGoogleVoices.map((voice) => voice.description)).toEqual([
      'Google: Shohei - Young TV announcer',
    ]);
    expect(selectableGoogleVoices.map((voice) => voice.id)).toEqual(['ja-JP-Wavenet-C']);
    expect(
      japaneseVoices
        .filter((voice) => 'hiddenFromPicker' in voice && voice.hiddenFromPicker)
        .map((voice) => voice.id)
    ).toEqual([
      'ja-JP-Wavenet-A',
      'ja-JP-Wavenet-B',
      'ja-JP-Neural2-B',
      'ja-JP-Wavenet-D',
      'ja-JP-Neural2-C',
      'ja-JP-Neural2-D',
      'Takumi',
      'Kazuha',
      'Tomoko',
    ]);
  });
});
