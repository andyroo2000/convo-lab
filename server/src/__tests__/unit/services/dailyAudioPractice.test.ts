import { describe, expect, it, vi, beforeEach } from 'vitest';

import {
  buildDailyAudioLearningAtoms,
  selectDailyAudioPracticeCards,
} from '../../../services/dailyAudioPractice/cardSelection.js';
import {
  buildDailyAudioPracticeDrillScript,
  buildDailyAudioPracticeScripts,
  validateDailyAudioScriptUnits,
} from '../../../services/dailyAudioPractice/scriptGenerator.js';

const { mockPrisma, generateCoreLlmTextMock } = vi.hoisted(() => ({
  mockPrisma: {
    studyCard: {
      findMany: vi.fn(),
    },
    studyReviewLog: {
      groupBy: vi.fn(),
    },
  },
  generateCoreLlmTextMock: vi.fn(),
}));

vi.mock('../../../db/client.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../../services/coreLlmClient.js', () => ({
  generateCoreLlmJsonText: generateCoreLlmTextMock,
}));

describe('dailyAudioPractice services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('selects eligible study cards in priority order and excludes suspended cards', async () => {
    const now = new Date('2026-05-05T12:00:00.000Z');
    mockPrisma.studyCard.findMany.mockResolvedValue([
      createCardRecord({
        id: 'suspended',
        queueState: 'suspended',
        dueAt: new Date('2026-05-05T10:00:00.000Z'),
      }),
      createCardRecord({
        id: 'future',
        queueState: 'review',
        dueAt: new Date('2026-06-01T10:00:00.000Z'),
      }),
      createCardRecord({
        id: 'due',
        queueState: 'review',
        dueAt: new Date('2026-05-05T09:00:00.000Z'),
      }),
      createCardRecord({
        id: 'learning',
        queueState: 'learning',
        lastReviewedAt: new Date('2026-05-05T08:00:00.000Z'),
      }),
    ]);
    mockPrisma.studyReviewLog.groupBy.mockResolvedValue([
      { cardId: 'future', _count: { _all: 5 }, _max: { reviewedAt: new Date('2026-05-04') } },
      { cardId: 'due', _count: { _all: 2 }, _max: { reviewedAt: new Date('2026-05-05') } },
    ]);

    const result = await selectDailyAudioPracticeCards({
      userId: 'user-1',
      now,
      limit: 3,
      candidatePoolSize: 4,
    });

    expect(result.cards.map((card) => card.id)).toEqual(['due', 'learning', 'future']);
    expect(result.summary.totalEligible).toBe(3);
    expect(mockPrisma.studyCard.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          queueState: {
            notIn: ['suspended', 'buried'],
          },
        }),
        take: 4,
      })
    );
  });

  it('normalizes selected study cards into learning atoms', async () => {
    const atoms = await buildDailyAudioLearningAtoms([
      createCardRecord({
        id: 'recognition-1',
        cardType: 'recognition',
        answerJson: {
          expression: '食べました',
          expressionReading: '食[た]べました',
          meaning: 'ate',
          sentenceJp: '朝ごはんを食べました。',
          sentenceEn: 'I ate breakfast.',
        },
      }),
      createCardRecord({
        id: 'cloze-1',
        cardType: 'cloze',
        promptJson: {
          clozeDisplayText: '駅に__。',
          clozeAnswerText: '行きます',
        },
        answerJson: {
          restoredText: '駅に行きます。',
          restoredTextReading: '駅[えき]に行[い]きます。',
          meaning: 'go to the station',
        },
      }),
    ]);

    expect(atoms).toMatchObject([
      {
        cardId: 'recognition-1',
        cardType: 'recognition',
        targetText: '食べました',
        reading: '食[た]べました',
        english: 'ate',
        exampleJp: '朝ごはんを食べました。',
        exampleEn: 'I ate breakfast.',
      },
      {
        cardId: 'cloze-1',
        cardType: 'cloze',
        targetText: '行きます',
        reading: '駅[えき]に行[い]きます。',
        english: 'go to the station',
        exampleJp: '駅に行きます。',
      },
    ]);
  });

  it('builds validated drill, dialogue, and story scripts with expected voices', async () => {
    generateCoreLlmTextMock
      .mockResolvedValueOnce(
        JSON.stringify({
          scenes: [
            {
              title: 'At breakfast',
              lines: [
                {
                  speaker: 'speaker1',
                  text: '朝ごはんを食べました。',
                  reading: '朝[あさ]ごはんを食[た]べました。',
                  translation: 'I ate breakfast.',
                },
              ],
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          title: 'A morning story',
          lines: [
            {
              text: '朝ごはんを食べました。',
              reading: '朝[あさ]ごはんを食[た]べました。',
              translation: 'I ate breakfast.',
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          items: [
            {
              cardId: 'card-1',
              englishCue: 'ate',
              exampleJp: '昼ごはんを食べました。',
              exampleReading: '昼[ひる]ごはんを食[た]べました。',
              exampleEn: 'I ate lunch.',
              variations: [
                {
                  japanese: '晩ごはんを食べました。',
                  reading: '晩[ばん]ごはんを食[た]べました。',
                  english: 'I ate dinner.',
                },
                {
                  japanese: 'スープを飲みました。',
                  reading: 'スープを飲[の]みました。',
                  english: 'I drank soup.',
                },
                {
                  japanese: '薬を飲みました。',
                  reading: '薬[くすり]を飲[の]みました。',
                  english: 'I took medicine.',
                },
                {
                  japanese: '日本語を勉強しました。',
                  reading: '日本[にほん]語[ご]を勉[べん]強[きょう]しました。',
                  english: 'I studied Japanese.',
                },
                {
                  japanese: '本を読みました。',
                  reading: '本[ほん]を読[よ]みました。',
                  english: 'ate',
                },
              ],
            },
          ],
        })
      );

    const scripts = await buildDailyAudioPracticeScripts({
      atoms: [
        {
          cardId: 'card-1',
          cardType: 'recognition',
          targetText: '食べました',
          reading: '食[た]べました',
          english: 'ate',
          exampleJp: '朝ごはんを食べました。',
          exampleEn: 'I ate breakfast.',
          deckName: '日本語',
          noteType: 'Core',
        },
      ],
      targetDurationMinutes: 30,
      targetLanguage: 'ja',
      nativeLanguage: 'en',
      l1VoiceId: 'en-US-Neural2-J',
      speakerVoiceIds: ['ja-JP-Neural2-B', 'ja-JP-Neural2-C'],
    });

    expect(Object.keys(scripts)).toEqual(['drill', 'dialogue', 'story']);
    expect(scripts.drill.some((unit) => unit.type === 'pause')).toBe(true);
    expect(scripts.drill).toContainEqual(
      expect.objectContaining({
        type: 'L2',
        text: '晩ごはんを食べました。',
        reading: '晩[ばん]ごはんを食[た]べました。',
      })
    );
    expect(scripts.drill).toContainEqual(
      expect.objectContaining({
        type: 'L2',
        text: '日本語を勉強しました。',
        translation: 'I studied Japanese.',
      })
    );
    expect(scripts.drill).not.toContainEqual(
      expect.objectContaining({
        type: 'L2',
        text: '本を読みました。',
      })
    );
    const drillL2Units = scripts.drill.filter((unit) => unit.type === 'L2');
    expect(drillL2Units).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: '食べました', speed: 0.75 }),
        expect.objectContaining({ text: '食べました', speed: 1 }),
      ])
    );
    expect(
      drillL2Units.filter((unit) => unit.text === '食べました').map((unit) => unit.speed)
    ).toEqual([0.75, 1, 0.75, 1]);
    const recognitionMarkerIndex = scripts.drill.findIndex(
      (unit) => unit.type === 'marker' && unit.label === 'Recognition drills'
    );
    const productionMarkerIndex = scripts.drill.findIndex(
      (unit) => unit.type === 'marker' && unit.label === 'Production drills'
    );
    expect(recognitionMarkerIndex).toBeGreaterThanOrEqual(0);
    expect(productionMarkerIndex).toBeGreaterThan(recognitionMarkerIndex);
    expect(scripts.drill).toContainEqual(
      expect.objectContaining({
        type: 'narration_L1',
        text: 'Now the order reverses. Listen to the English prompt, then say the Japanese before the answer.',
      })
    );
    expect(scripts.dialogue).toContainEqual(
      expect.objectContaining({ type: 'L2', voiceId: 'ja-JP-Neural2-B' })
    );
    expect(scripts.story).toContainEqual(
      expect.objectContaining({ type: 'L2', voiceId: 'ja-JP-Neural2-B' })
    );
    expect(() => validateDailyAudioScriptUnits(scripts.drill)).not.toThrow();
    expect(() => validateDailyAudioScriptUnits([{ type: 'pause', seconds: 0 }])).toThrow(
      'Pause units must have a positive duration.'
    );
  });

  it('falls back to deterministic dialogue and story lines when LLM content is empty', async () => {
    generateCoreLlmTextMock
      .mockResolvedValueOnce(JSON.stringify({ scenes: [] }))
      .mockResolvedValueOnce(JSON.stringify({ title: 'Empty story', lines: [] }))
      .mockResolvedValueOnce(JSON.stringify({ items: [] }));

    const scripts = await buildDailyAudioPracticeScripts({
      atoms: [
        {
          cardId: 'card-1',
          cardType: 'recognition',
          targetText: '食べました',
          reading: '食[た]べました',
          english: 'ate',
          exampleJp: '朝ごはんを食べました。',
          exampleEn: 'I ate breakfast.',
          deckName: '日本語',
          noteType: 'Core',
        },
      ],
      targetDurationMinutes: 30,
      targetLanguage: 'ja',
      nativeLanguage: 'en',
      l1VoiceId: 'en-US-Neural2-J',
      speakerVoiceIds: ['ja-JP-Neural2-B', 'ja-JP-Neural2-C'],
    });

    expect(scripts.dialogue).toContainEqual(
      expect.objectContaining({ type: 'L2', text: '朝ごはんを食べました。' })
    );
    expect(scripts.story).toContainEqual(
      expect.objectContaining({ type: 'L2', text: '朝ごはんを食べました。' })
    );
  });

  it('translates Japanese-only drill cues before the English narrator speaks them', async () => {
    generateCoreLlmTextMock.mockResolvedValueOnce(
      JSON.stringify({
        items: [
          {
            cardId: 'card-1',
            englishCue: 'to eat breakfast',
            exampleJp: '朝、パンを食べます。',
            exampleReading: '朝[あさ]、パンを食[た]べます。',
            exampleEn: 'I eat bread in the morning.',
          },
        ],
      })
    );

    const script = await buildDailyAudioPracticeDrillScript({
      atoms: [
        {
          cardId: 'card-1',
          cardType: 'recognition',
          targetText: '朝ごはんを食べる',
          reading: '朝[あさ]ごはんを食[た]べる',
          english: '朝食を食べること',
          exampleJp: '朝ごはんを食べます。',
          exampleEn: null,
          deckName: '日本語',
          noteType: 'Monolingual',
        },
      ],
      targetDurationMinutes: 30,
      targetLanguage: 'ja',
      nativeLanguage: 'en',
      l1VoiceId: 'fishaudio:english',
      speakerVoiceIds: ['ja-JP-Wavenet-C', 'ja-JP-Wavenet-C'],
    });

    const narratorLines = script.filter((unit) => unit.type === 'narration_L1');
    expect(narratorLines).toContainEqual(
      expect.objectContaining({
        text: 'How do you say "to eat breakfast"?',
        voiceId: 'fishaudio:english',
      })
    );
    expect(
      narratorLines.map((unit) => (unit.type === 'narration_L1' ? unit.text : '')).join(' ')
    ).not.toMatch(/[\u3040-\u30ff\u3400-\u9fff]/);
    expect(script).toContainEqual(
      expect.objectContaining({
        type: 'L2',
        text: '朝、パンを食べます。',
        voiceId: 'ja-JP-Wavenet-C',
      })
    );
  });

  it('keeps furigana out of spoken Japanese text while preserving readings for display', async () => {
    generateCoreLlmTextMock.mockResolvedValueOnce(
      JSON.stringify({
        items: [
          {
            cardId: 'card-1',
            englishCue: 'went west of Hokkaido last year',
            exampleJp: '去年(きょねん)、北海道[ほっかいどう]の西(にし)に行(い)きました。',
            exampleEn: 'I went west of Hokkaido last year.',
            variations: [
              {
                japanese: '北海道[ほっかいどう]に行(い)きました。',
                english: 'I went to Hokkaido.',
              },
            ],
          },
        ],
      })
    );

    const script = await buildDailyAudioPracticeDrillScript({
      atoms: [
        {
          cardId: 'card-1',
          cardType: 'recognition',
          targetText: '北海道[ほっかいどう]',
          english: 'Hokkaido',
          exampleJp: null,
          exampleEn: null,
          deckName: '日本語',
          noteType: 'Core',
        },
      ],
      targetDurationMinutes: 30,
      targetLanguage: 'ja',
      nativeLanguage: 'en',
      l1VoiceId: 'fishaudio:english',
      speakerVoiceIds: ['ja-JP-Wavenet-C', 'ja-JP-Wavenet-C'],
    });

    const l2Units = script.filter((unit) => unit.type === 'L2');
    expect(l2Units.map((unit) => unit.text).join(' ')).not.toMatch(/[()[\]（）]/);
    expect(script).toContainEqual(
      expect.objectContaining({
        type: 'L2',
        text: '去年、北海道の西に行きました。',
        reading: '去年[きょねん]、北海道[ほっかいどう]の西[にし]に行[い]きました。',
        translation: 'I went west of Hokkaido last year.',
      })
    );
    expect(script).toContainEqual(
      expect.objectContaining({
        type: 'L2',
        text: '北海道に行きました。',
        reading: '北海道[ほっかいどう]に行[い]きました。',
        translation: 'I went to Hokkaido.',
      })
    );
  });

  it('dedupes repeated drill prompts inside the recognition section', async () => {
    generateCoreLlmTextMock.mockResolvedValueOnce(
      JSON.stringify({
        items: [
          {
            cardId: 'card-1',
            englishCue: "I can't eat vegetables",
            exampleJp: '野菜が食べられません。',
            exampleEn: "I can't eat vegetables.",
            variations: [
              {
                japanese: '野菜が食べられません。',
                english: "I can't eat vegetables.",
              },
            ],
          },
          {
            cardId: 'card-2',
            englishCue: "I can't eat vegetables",
            exampleJp: '野菜が食べられません。',
            exampleEn: "I can't eat vegetables.",
          },
        ],
      })
    );

    const script = await buildDailyAudioPracticeDrillScript({
      atoms: [
        {
          cardId: 'card-1',
          cardType: 'recognition',
          targetText: '野菜が食べられません。',
          english: "I can't eat vegetables.",
          exampleJp: null,
          exampleEn: null,
          deckName: '日本語',
          noteType: 'Core',
        },
        {
          cardId: 'card-2',
          cardType: 'recognition',
          targetText: '食べられません',
          english: "can't eat",
          exampleJp: null,
          exampleEn: null,
          deckName: '日本語',
          noteType: 'Core',
        },
      ],
      targetDurationMinutes: 30,
      targetLanguage: 'ja',
      nativeLanguage: 'en',
      l1VoiceId: 'fishaudio:english',
      speakerVoiceIds: ['ja-JP-Wavenet-C', 'ja-JP-Wavenet-C'],
    });

    const recognitionStart = script.findIndex(
      (unit) => unit.type === 'marker' && unit.label === 'Recognition drills'
    );
    const productionStart = script.findIndex(
      (unit) => unit.type === 'marker' && unit.label === 'Production drills'
    );
    const recognitionUnits = script.slice(recognitionStart, productionStart);
    const recognitionJapaneseSpeeds = recognitionUnits.flatMap((unit) =>
      unit.type === 'L2' && unit.text === '野菜が食べられません。' ? [unit.speed] : []
    );

    expect(recognitionJapaneseSpeeds).toEqual([0.75, 1]);
    expect(recognitionUnits).toContainEqual(
      expect.objectContaining({
        type: 'narration_L1',
        text: "I can't eat vegetables",
      })
    );
  });
});

function createCardRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'card-1',
    noteId: 'note-1',
    userId: 'user-1',
    cardType: 'recognition',
    queueState: 'review',
    dueAt: null,
    introducedAt: null,
    lastReviewedAt: null,
    sourceLapses: 0,
    sourceDeckName: '日本語',
    promptJson: {},
    answerJson: {
      expression: '食べました',
      expressionReading: '食[た]べました',
      meaning: 'ate',
    },
    note: {
      sourceNotetypeName: 'Core',
      rawFieldsJson: {},
    },
    promptAudioMedia: null,
    answerAudioMedia: null,
    imageMedia: null,
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    ...overrides,
  };
}
