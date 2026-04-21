import { describe, expect, it } from 'vitest';

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
        sentenceJp: '会社に行きます。',
        sentenceEn: 'I am going to the company.',
        notes: 'Use in business contexts.',
      },
    });
  });

  it('builds a cloze payload with null-normalized hint and notes', () => {
    const payload = buildStudyCardFormPayload({
      cardType: 'cloze',
      cueText: 'お風呂に虫{{c1::がいる}}！',
      cueReading: '',
      cueMeaning: '',
      answerExpression: 'お風呂に虫がいる！',
      answerReading: '',
      answerMeaning: 'There are bugs in the bath!',
      notes: '',
      sentenceJp: '',
      sentenceEn: '',
    });

    expect(payload).toEqual({
      cardType: 'cloze',
      prompt: {
        clozeText: 'お風呂に虫{{c1::がいる}}！',
        clozeHint: null,
      },
      answer: {
        restoredText: 'お風呂に虫がいる！',
        meaning: 'There are bugs in the bath!',
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
          meaning: 'There are bugs in the bath!',
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
      answerMeaning: 'There are bugs in the bath!',
      notes: 'Keep calm.',
    });
  });
});
