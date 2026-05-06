import { describe, expect, it, vi, beforeEach } from 'vitest';

import {
  buildDailyAudioLearningAtoms,
  selectDailyAudioPracticeCards,
} from '../../../services/dailyAudioPractice/cardSelection.js';
import {
  buildDailyAudioPracticeDrillScript,
  buildDailyAudioPracticeDrillScriptResult,
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
      createCardRecord({
        id: 'mixed-gloss-1',
        answerJson: {
          expression: '教材',
          expressionReading: '教材[きょうざい]',
          meaning: '勉強のために使うもの。\nstudy materials / teaching materials',
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
      {
        cardId: 'mixed-gloss-1',
        targetText: '教材',
        reading: '教材[きょうざい]',
        english: 'study materials / teaching materials',
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
              grammarSubstitutions: [
                {
                  japanese: '晩ごはんを食べました。',
                  reading: '晩[ばん]ごはんを食[た]べました。',
                  english: 'I ate dinner.',
                },
                {
                  japanese: '駅でお弁当を食べました。',
                  reading: '駅[えき]でお弁当[べんとう]を食[た]べました。',
                  english: 'I ate a boxed lunch at the station.',
                },
              ],
              formTransforms: [
                {
                  japanese: '朝ごはんを食べませんでした。',
                  reading: '朝[あさ]ごはんを食[た]べませんでした。',
                  english: 'I did not eat breakfast.',
                },
                {
                  japanese: '朝ごはんを食べられます。',
                  reading: '朝[あさ]ごはんを食[た]べられます。',
                  english: 'I can eat breakfast.',
                },
              ],
              variations: [
                {
                  japanese: '本を読みました。',
                  reading: '本[ほん]を読[よ]みました。',
                  english: 'ate',
                },
                {
                  kind: 'anchor',
                  japanese: '水を飲みました。',
                  reading: '水[みず]を飲[の]みました。',
                  english: 'I drank water.',
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
        text: '駅でお弁当を食べました。',
        translation: 'I ate a boxed lunch at the station.',
      })
    );
    expect(scripts.drill).toContainEqual(
      expect.objectContaining({
        type: 'L2',
        text: '朝ごはんを食べませんでした。',
        translation: 'I did not eat breakfast.',
      })
    );
    expect(scripts.drill).toContainEqual(
      expect.objectContaining({
        type: 'L2',
        text: '朝ごはんを食べられます。',
        translation: 'I can eat breakfast.',
      })
    );
    expect(scripts.drill).not.toContainEqual(
      expect.objectContaining({
        type: 'L2',
        text: '本を読みました。',
      })
    );
    expect(scripts.drill).not.toContainEqual(
      expect.objectContaining({
        type: 'L2',
        text: '水を飲みました。',
      })
    );
    const drillL2Units = scripts.drill.filter((unit) => unit.type === 'L2');
    expect(drillL2Units).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: '昼ごはんを食べました。', speed: 0.75 }),
        expect.objectContaining({ text: '昼ごはんを食べました。', speed: 1 }),
      ])
    );
    expect(
      drillL2Units.filter((unit) => unit.text === '食べました').map((unit) => unit.speed)
    ).toEqual([]);
    expect(
      drillL2Units.filter((unit) => unit.text === '昼ごはんを食べました。').map((unit) => unit.speed)
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
    const drillPrompt = generateCoreLlmTextMock.mock.calls[2]?.[0] as string;
    expect(drillPrompt).toContain('balanced ladder');
    expect(drillPrompt).toContain('grammarSubstitutions contains exactly two items');
    expect(drillPrompt).toContain('formTransforms contains exactly two items');
    expect(drillPrompt).toContain('"anchor"');
    expect(drillPrompt).toContain('"grammarSubstitutions"');
    expect(drillPrompt).toContain('"formTransforms"');
    expect(() => validateDailyAudioScriptUnits(scripts.drill)).not.toThrow();
    expect(() => validateDailyAudioScriptUnits([{ type: 'pause', seconds: 0 }])).toThrow(
      'Pause units must have a positive duration.'
    );
  });

  it('uses generated prompts ahead of raw card prompts and reports drill metadata', async () => {
    generateCoreLlmTextMock.mockResolvedValueOnce(
      JSON.stringify({
        items: [
          {
            cardId: 'card-1',
            englishCue: 'study materials',
            anchor: {
              japanese: '先生は新しい教材を使います。',
              reading: '先生[せんせい]は新[あたら]しい教材[きょうざい]を使[つか]います。',
              english: 'The teacher uses new study materials.',
            },
            variations: [
              {
                japanese: '学生は古い教材を読みます。',
                reading: '学生[がくせい]は古[ふる]い教材[きょうざい]を読[よ]みます。',
                english: 'The student reads old study materials.',
              },
              {
                japanese: '先生は新しい辞書を使います。',
                reading: '先生[せんせい]は新[あたら]しい辞書[じしょ]を使[つか]います。',
                english: 'The teacher uses a new dictionary.',
              },
              {
                japanese: '先生は新しい教材を使いました。',
                reading: '先生[せんせい]は新[あたら]しい教材[きょうざい]を使[つか]いました。',
                english: 'The teacher used new study materials.',
              },
            ],
          },
        ],
      })
    );

    const result = await buildDailyAudioPracticeDrillScriptResult({
      atoms: [
        {
          cardId: 'card-1',
          cardType: 'recognition',
          targetText: '教材',
          reading: '教材[きょうざい]',
          english: '勉強のために使うもの。',
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

    const l2Units = result.units.filter((unit) => unit.type === 'L2');
    expect(l2Units).toContainEqual(
      expect.objectContaining({ text: '先生は新しい教材を使います。' })
    );
    expect(l2Units).toContainEqual(
      expect.objectContaining({ text: '先生は新しい教材を使いました。' })
    );
    expect(l2Units).not.toContainEqual(expect.objectContaining({ text: '教材' }));
    expect(result.metadata).toMatchObject({
      enhancedAtomCount: 1,
      generatedPromptCount: 4,
      fallbackPromptCount: 0,
      missingCueCount: 0,
      totalPromptCount: 4,
    });
  });

  it('uses an LLM-provided cue for raw fallback prompts instead of this expression', async () => {
    generateCoreLlmTextMock.mockResolvedValueOnce(
      JSON.stringify({
        items: [
          {
            cardId: 'card-1',
            englishCue: 'study materials',
          },
        ],
      })
    );

    const script = await buildDailyAudioPracticeDrillScript({
      atoms: [
        {
          cardId: 'card-1',
          cardType: 'recognition',
          targetText: '教材',
          reading: '教材[きょうざい]',
          english: '勉強のために使うもの。',
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

    expect(script).toContainEqual(
      expect.objectContaining({ type: 'L2', text: '教材', translation: 'study materials' })
    );
    expect(JSON.stringify(script)).not.toMatch(/this expression/i);
  });

  it('batches drill enhancement calls so one failed response does not erase all generated prompts', async () => {
    generateCoreLlmTextMock
      .mockResolvedValueOnce(
        JSON.stringify({
          items: [
            {
              cardId: 'card-1',
              englishCue: 'to win',
              anchor: {
                japanese: '昨日、試合に勝ちました。',
                english: 'I won the game yesterday.',
              },
            },
          ],
        })
      )
      .mockResolvedValueOnce('not valid json');

    const result = await buildDailyAudioPracticeDrillScriptResult({
      atoms: Array.from({ length: 6 }, (_, index) => ({
        cardId: `card-${index + 1}`,
        cardType: 'recognition' as const,
        targetText: index === 0 ? '勝つ' : `単語${index + 1}`,
        reading: null,
        english: index === 0 ? 'to win' : `word ${index + 1}`,
        exampleJp: null,
        exampleEn: null,
        deckName: '日本語',
        noteType: 'Core',
      })),
      targetDurationMinutes: 30,
      targetLanguage: 'ja',
      nativeLanguage: 'en',
      l1VoiceId: 'fishaudio:english',
      speakerVoiceIds: ['ja-JP-Wavenet-C', 'ja-JP-Wavenet-C'],
    });

    expect(generateCoreLlmTextMock).toHaveBeenCalledTimes(2);
    expect(result.metadata).toMatchObject({
      enhancedAtomCount: 1,
      generatedPromptCount: 1,
      fallbackPromptCount: 5,
      totalPromptCount: 6,
    });
    expect(result.units).toContainEqual(
      expect.objectContaining({ type: 'L2', text: '昨日、試合に勝ちました。' })
    );
    expect(result.units).toContainEqual(expect.objectContaining({ type: 'L2', text: '単語6' }));
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
      expect.objectContaining({ text: 'I eat bread in the morning.' })
    );
    expect(
      narratorLines.map((unit) => (unit.type === 'narration_L1' ? unit.text : '')).join(' ')
    ).not.toMatch(/[\u3040-\u30ff\u3400-\u9fff]/);
    expect(
      narratorLines.map((unit) => (unit.type === 'narration_L1' ? unit.text : '')).join(' ')
    ).not.toMatch(/this expression/i);
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
                kind: 'grammar_substitution',
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
                kind: 'grammar_substitution',
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
