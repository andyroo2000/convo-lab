import { describe, expect, it, vi, beforeEach } from 'vitest';

import {
  buildDailyAudioLearningAtoms,
  selectDailyAudioPracticeCards,
} from '../../../services/dailyAudioPractice/cardSelection.js';
import {
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
  generateCoreLlmText: generateCoreLlmTextMock,
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
      .mockResolvedValueOnce(JSON.stringify({ title: 'Empty story', lines: [] }));

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
