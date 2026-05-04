/* eslint-disable import/order */
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { STUDY_NEW_CARDS_PER_DAY_DEFAULT } from '@languageflow/shared/src/studyConstants';

import {
  cleanupStudyServiceTestMedia,
  resetStudyServiceMocks,
  resolvePitchAccentMock,
  uploadBufferToGCSPathMock,
} from './studyTestHelpers.js';
import { mockPrisma } from '../../setup.js';
import { addFuriganaBrackets } from '../../../services/furiganaService.js';
import {
  createStudyCard,
  deleteStudyCard,
  getStudyNewCardQueue,
  getStudyOverview,
  getStudySettings,
  performStudyCardAction,
  recordStudyReview,
  reorderStudyNewCardQueue,
  resolveStudyCardPitchAccent,
  startStudySession,
  undoStudyReview,
  updateStudySettings,
  updateStudyCard,
} from '../../../services/studySchedulerService.js';
import { STUDY_SESSION_READY_CARD_LIMIT } from '../../../services/study/shared.js';
import { getPrivateStudyMediaRoot } from '../../../services/study/shared/paths.js';
import { synthesizeBatchedTexts } from '../../../services/batchedTTSClient.js';

const SESSION_TEST_DUE_AT = new Date('2026-04-12T00:00:00.000Z');
const SESSION_TEST_CREATED_AT = new Date('2026-04-01T00:00:00.000Z');
const SESSION_TEST_UPDATED_AT = new Date('2026-04-12T00:00:00.000Z');

type SessionTestQueueState = 'new' | 'learning' | 'review' | 'relearning';

function buildStudySessionSchedulerState(
  queueState: SessionTestQueueState,
  dueAt = SESSION_TEST_DUE_AT
) {
  return {
    due: dueAt.toISOString(),
    stability: 10,
    difficulty: 4,
    elapsed_days: 4,
    scheduled_days: 10,
    learning_steps: 0,
    reps: 6,
    lapses: 1,
    state: queueState === 'new' ? 0 : 2,
    last_review: null,
  };
}

function buildStudySessionCard({
  id,
  queueState,
  label = id,
  newQueuePosition = null,
}: {
  id: string;
  queueState: SessionTestQueueState;
  label?: string;
  newQueuePosition?: number | null;
}) {
  return {
    id,
    userId: 'user-1',
    noteId: `note-${id}`,
    cardType: 'recognition',
    queueState,
    dueAt: queueState === 'new' ? null : SESSION_TEST_DUE_AT,
    newQueuePosition,
    answerAudioSource: 'missing',
    promptJson: { cueText: label },
    answerJson: { expression: label, meaning: 'meaning' },
    schedulerStateJson: buildStudySessionSchedulerState(queueState),
    createdAt: SESSION_TEST_CREATED_AT,
    updatedAt: SESSION_TEST_UPDATED_AT,
    note: {},
  };
}

function buildClozeStudyCardRecord(restoredTextReading: string | null) {
  return {
    id: 'card-1',
    userId: 'user-1',
    noteId: 'note-1',
    cardType: 'cloze',
    queueState: 'review',
    dueAt: SESSION_TEST_DUE_AT,
    answerAudioSource: 'imported',
    promptJson: {
      clozeText: '明日から{{c1::早く起きる}}ことにします。',
      clozeHint: 'get up early',
    },
    answerJson: {
      restoredText: '明日から早く起きることにします。',
      restoredTextReading,
      meaning: 'I will start getting up early from tomorrow.',
    },
    schedulerStateJson: buildStudySessionSchedulerState('review'),
    createdAt: SESSION_TEST_CREATED_AT,
    updatedAt: SESSION_TEST_UPDATED_AT,
    sourceTemplateOrd: 0,
    note: {
      rawFieldsJson: {},
    },
  };
}

function buildStudyOverviewRow({
  dueCount = 0,
  newCount = 0,
  learningCount = 0,
  reviewCount = dueCount,
  suspendedCount = 0,
  totalCards = dueCount + newCount + suspendedCount,
  nextDueAt = dueCount > 0 ? SESSION_TEST_DUE_AT : null,
}: {
  dueCount?: number;
  newCount?: number;
  learningCount?: number;
  reviewCount?: number;
  suspendedCount?: number;
  totalCards?: number;
  nextDueAt?: Date | null;
} = {}) {
  return {
    due_count: dueCount,
    new_count: newCount,
    learning_count: learningCount,
    review_count: reviewCount,
    suspended_count: suspendedCount,
    total_cards: totalCards,
    next_due_at: nextDueAt,
  };
}

describe('studySchedulerService', () => {
  beforeEach(() => {
    resetStudyServiceMocks();
    mockPrisma.studyCard.findMany.mockReset();
    mockPrisma.studyCard.count.mockReset();
    mockPrisma.studyCard.aggregate.mockReset();
    mockPrisma.studySettings.findUnique.mockReset();
    mockPrisma.studySettings.findUnique.mockResolvedValue({
      userId: 'user-1',
      newCardsPerDay: STUDY_NEW_CARDS_PER_DAY_DEFAULT,
    });
    mockPrisma.studySettings.upsert.mockReset();
    mockPrisma.studySettings.upsert.mockResolvedValue({
      userId: 'user-1',
      newCardsPerDay: STUDY_NEW_CARDS_PER_DAY_DEFAULT,
    });
    mockPrisma.studyCard.count.mockResolvedValue(0);
    mockPrisma.studyCard.aggregate.mockResolvedValue({
      _max: {
        newQueuePosition: 0,
      },
    });
    resolvePitchAccentMock.mockReset();
  });

  afterEach(async () => {
    await cleanupStudyServiceTestMedia();
  });

  it('records a review and writes scheduler state transitions', async () => {
    mockPrisma.studyCard.findFirst
      .mockResolvedValueOnce({
        id: 'card-1',
        userId: 'user-1',
        noteId: 'note-1',
        cardType: 'recognition',
        queueState: 'review',
        dueAt: new Date('2026-04-12T00:00:00.000Z'),
        answerAudioSource: 'imported',
        promptJson: {},
        answerJson: {},
        schedulerStateJson: {
          due: new Date('2026-04-12T00:00:00.000Z').toISOString(),
          stability: 10,
          difficulty: 4,
          elapsed_days: 4,
          scheduled_days: 10,
          learning_steps: 0,
          reps: 6,
          lapses: 1,
          state: 2,
          last_review: new Date('2026-04-08T00:00:00.000Z').toISOString(),
        },
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        note: {},
      })
      .mockResolvedValueOnce({
        id: 'card-1',
        userId: 'user-1',
        noteId: 'note-1',
        cardType: 'recognition',
        queueState: 'review',
        dueAt: new Date('2026-04-20T00:00:00.000Z'),
        answerAudioSource: 'imported',
        promptJson: {},
        answerJson: {},
        schedulerStateJson: {
          due: new Date('2026-04-20T00:00:00.000Z').toISOString(),
          stability: 15,
          difficulty: 4,
          elapsed_days: 3,
          scheduled_days: 8,
          learning_steps: 0,
          reps: 6,
          lapses: 1,
          state: 2,
          last_review: new Date('2026-04-12T00:00:00.000Z').toISOString(),
        },
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        note: {},
      });
    mockPrisma.studyReviewLog.create.mockResolvedValue({ id: 'review-log-1' });
    mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockPrisma));

    const reviewResult = await recordStudyReview({
      userId: 'user-1',
      cardId: 'card-1',
      grade: 'good',
    });

    expect(mockPrisma.studyCard.updateMany).toHaveBeenCalled();
    expect(reviewResult.reviewLogId).toBe('review-log-1');
  });

  it('marks a new card as introduced only on its first review', async () => {
    mockPrisma.studyCard.findFirst
      .mockResolvedValueOnce({
        id: 'card-new',
        userId: 'user-1',
        noteId: 'note-1',
        cardType: 'recognition',
        queueState: 'new',
        dueAt: null,
        introducedAt: null,
        answerAudioSource: 'missing',
        promptJson: { cueText: '会社' },
        answerJson: { expression: '会社', meaning: 'company' },
        schedulerStateJson: {
          due: new Date('2026-04-12T00:00:00.000Z').toISOString(),
          stability: 0.1,
          difficulty: 5,
          elapsed_days: 0,
          scheduled_days: 0,
          learning_steps: 0,
          reps: 0,
          lapses: 0,
          state: 0,
          last_review: null,
        },
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        note: {},
      })
      .mockResolvedValueOnce({
        id: 'card-new',
        userId: 'user-1',
        noteId: 'note-1',
        cardType: 'recognition',
        queueState: 'learning',
        dueAt: new Date('2026-04-12T00:01:00.000Z'),
        introducedAt: new Date('2026-04-12T00:00:00.000Z'),
        answerAudioSource: 'missing',
        promptJson: { cueText: '会社' },
        answerJson: { expression: '会社', meaning: 'company' },
        schedulerStateJson: {
          due: new Date('2026-04-12T00:01:00.000Z').toISOString(),
          stability: 0.1,
          difficulty: 5,
          elapsed_days: 0,
          scheduled_days: 0,
          learning_steps: 0,
          reps: 1,
          lapses: 0,
          state: 1,
          last_review: new Date('2026-04-12T00:00:00.000Z').toISOString(),
        },
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        note: {},
      });
    mockPrisma.studyReviewLog.create.mockResolvedValue({ id: 'review-log-new' });
    mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockPrisma));
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        due_count: 0,
        new_count: 0,
        learning_count: 1,
        review_count: 0,
        suspended_count: 0,
        total_cards: 1,
        next_due_at: new Date('2026-04-12T00:01:00.000Z'),
      },
    ]);
    mockPrisma.studyImportJob.findFirst.mockResolvedValue(null);

    await recordStudyReview({ userId: 'user-1', cardId: 'card-new', grade: 'good' });

    expect(mockPrisma.studyCard.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          introducedAt: expect.any(Date),
        }),
      })
    );
    expect(mockPrisma.studyReviewLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rawPayloadJson: expect.objectContaining({
            beforeIntroducedAt: null,
          }),
        }),
      })
    );
  });

  it('undoes a review and restores the previous scheduler state', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-12T02:00:00.000Z'));

    try {
      mockPrisma.studyReviewLog.findFirst
        .mockResolvedValueOnce({
          id: 'review-log-1',
          userId: 'user-1',
          cardId: 'card-1',
          source: 'convolab',
          reviewedAt: new Date('2026-04-12T00:00:00.000Z'),
          stateBeforeJson: {
            due: new Date('2026-04-10T00:00:00.000Z').toISOString(),
            stability: 10,
            difficulty: 4,
            elapsed_days: 2,
            scheduled_days: 10,
            learning_steps: 0,
            reps: 6,
            lapses: 1,
            state: 2,
            last_review: new Date('2026-04-08T00:00:00.000Z').toISOString(),
          },
          rawPayloadJson: {
            beforeQueueState: 'review',
            beforeDueAt: new Date('2026-04-10T00:00:00.000Z').toISOString(),
            beforeLastReviewedAt: new Date('2026-04-08T00:00:00.000Z').toISOString(),
          },
          card: {
            id: 'card-1',
            userId: 'user-1',
            noteId: 'note-1',
            note: {},
          },
        })
        .mockResolvedValueOnce(null);
      mockPrisma.studyReviewLog.delete.mockResolvedValue({});
      mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockPrisma));
      mockPrisma.studyCard.findFirst.mockResolvedValue({
        id: 'card-1',
        userId: 'user-1',
        noteId: 'note-1',
        cardType: 'recognition',
        queueState: 'review',
        dueAt: new Date('2026-04-10T00:00:00.000Z'),
        answerAudioSource: 'imported',
        promptJson: { cueText: '会社' },
        answerJson: { expression: '会社', meaning: 'company' },
        schedulerStateJson: {
          due: new Date('2026-04-10T00:00:00.000Z').toISOString(),
          stability: 10,
          difficulty: 4,
          elapsed_days: 2,
          scheduled_days: 10,
          learning_steps: 0,
          reps: 6,
          lapses: 1,
          state: 2,
          last_review: new Date('2026-04-08T00:00:00.000Z').toISOString(),
        },
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        note: {},
      });

      const undoResult = await undoStudyReview({
        userId: 'user-1',
        reviewLogId: 'review-log-1',
        timeZone: 'America/New_York',
      });

      expect(undoResult.reviewLogId).toBe('review-log-1');
      expect(mockPrisma.studyCard.updateMany).toHaveBeenCalled();
      expect(mockPrisma.studyCard.count).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          introducedAt: {
            gte: new Date('2026-04-11T04:00:00.000Z'),
            lt: new Date('2026-04-12T04:00:00.000Z'),
          },
        },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('undoes a first review of a new card and restores introducedAt to null', async () => {
    const reviewedIntroducedAt = new Date('2026-04-12T00:00:00.000Z');

    mockPrisma.studyReviewLog.findFirst
      .mockResolvedValueOnce({
        id: 'review-log-new',
        userId: 'user-1',
        cardId: 'card-new',
        source: 'convolab',
        reviewedAt: reviewedIntroducedAt,
        stateBeforeJson: {
          due: reviewedIntroducedAt.toISOString(),
          stability: 0.1,
          difficulty: 5,
          elapsed_days: 0,
          scheduled_days: 0,
          learning_steps: 0,
          reps: 0,
          lapses: 0,
          state: 0,
          last_review: null,
        },
        rawPayloadJson: {
          beforeQueueState: 'new',
          beforeDueAt: null,
          beforeIntroducedAt: null,
          beforeLastReviewedAt: null,
        },
        card: {
          id: 'card-new',
          userId: 'user-1',
          noteId: 'note-1',
          introducedAt: reviewedIntroducedAt,
          note: {},
        },
      })
      .mockResolvedValueOnce(null);
    mockPrisma.studyReviewLog.delete.mockResolvedValue({});
    mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockPrisma));
    mockPrisma.studyCard.findFirst.mockResolvedValue({
      id: 'card-new',
      userId: 'user-1',
      noteId: 'note-1',
      cardType: 'recognition',
      queueState: 'new',
      dueAt: null,
      introducedAt: null,
      answerAudioSource: 'missing',
      promptJson: { cueText: '会社' },
      answerJson: { expression: '会社', meaning: 'company' },
      schedulerStateJson: {
        due: reviewedIntroducedAt.toISOString(),
        stability: 0.1,
        difficulty: 5,
        elapsed_days: 0,
        scheduled_days: 0,
        learning_steps: 0,
        reps: 0,
        lapses: 0,
        state: 0,
        last_review: null,
      },
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
      updatedAt: reviewedIntroducedAt,
      note: {},
    });
    mockPrisma.$queryRaw.mockResolvedValue([
      buildStudyOverviewRow({
        dueCount: 0,
        newCount: 1,
        reviewCount: 0,
        totalCards: 1,
        nextDueAt: null,
      }),
    ]);
    mockPrisma.studyImportJob.findFirst.mockResolvedValue(null);

    await undoStudyReview({
      userId: 'user-1',
      reviewLogId: 'review-log-new',
      timeZone: 'America/New_York',
    });

    expect(mockPrisma.studyCard.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          queueState: 'new',
          dueAt: null,
          introducedAt: null,
          lastReviewedAt: null,
        }),
      })
    );
    expect(mockPrisma.studyCard.count).toHaveBeenCalled();
  });

  it('creates in-app cards and seeds answer-side audio generation', async () => {
    mockPrisma.studyNote.create.mockResolvedValue({ id: 'note-created' });
    mockPrisma.studyCard.create.mockResolvedValue({
      id: 'card-created',
      userId: 'user-1',
      noteId: 'note-created',
      cardType: 'recognition',
      queueState: 'new',
      answerAudioSource: 'missing',
      answerJson: {
        expression: '会社',
        meaning: 'company',
        answerAudioVoiceId: 'ja-JP-Neural2-C',
        answerAudioTextOverride: 'かいしゃ',
      },
      createdAt: new Date('2026-04-12T00:00:00.000Z'),
      updatedAt: new Date('2026-04-12T00:00:00.000Z'),
      note: {},
    });
    mockPrisma.studyCard.findUnique.mockResolvedValue({
      id: 'card-created',
      userId: 'user-1',
      answerAudioSource: 'missing',
      answerJson: {
        expression: '会社',
        meaning: 'company',
        answerAudioVoiceId: 'ja-JP-Neural2-C',
        answerAudioTextOverride: 'かいしゃ',
      },
    });
    mockPrisma.studyMedia.create.mockResolvedValue({ id: 'media-generated' });
    mockPrisma.studyCard.update.mockResolvedValue({});
    mockPrisma.studyCard.findFirst.mockResolvedValue({
      id: 'card-created',
      noteId: 'note-created',
      cardType: 'recognition',
      queueState: 'new',
      answerAudioSource: 'generated',
      promptJson: { cueText: 'company' },
      answerJson: {
        expression: '会社',
        meaning: 'company',
        answerAudioVoiceId: 'ja-JP-Neural2-C',
        answerAudioTextOverride: 'かいしゃ',
        answerAudio: {
          id: 'media-generated',
          filename: 'card-created.mp3',
          url: '/api/study/media/media-generated',
          mediaKind: 'audio',
          source: 'generated',
        },
      },
      schedulerStateJson: {
        due: new Date('2026-04-12T00:00:00.000Z').toISOString(),
        stability: 0.1,
        difficulty: 5,
        elapsed_days: 0,
        scheduled_days: 0,
        learning_steps: 0,
        reps: 0,
        lapses: 0,
        state: 0,
        last_review: null,
      },
      createdAt: new Date('2026-04-12T00:00:00.000Z'),
      updatedAt: new Date('2026-04-12T00:00:00.000Z'),
      note: {},
    });

    const created = await createStudyCard({
      userId: 'user-1',
      cardType: 'recognition',
      prompt: { cueText: 'company' },
      answer: {
        expression: '会社',
        meaning: 'company',
        answerAudioVoiceId: 'ja-JP-Neural2-C',
        answerAudioTextOverride: 'かいしゃ',
      },
    });

    expect(vi.mocked(synthesizeBatchedTexts)).toHaveBeenCalledWith(['かいしゃ'], {
      voiceId: 'ja-JP-Neural2-C',
      languageCode: 'ja-JP',
      speed: 1,
    });
    expect(created.answerAudioSource).toBe('generated');
    expect(created.state.scheduler).toEqual(
      expect.objectContaining({
        difficulty: expect.any(Number),
        stability: expect.any(Number),
        due: expect.any(String),
      })
    );
    expect(mockPrisma.studyCard.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          newQueuePosition: 1,
        }),
      })
    );
  });

  it('creates default study settings and validates updates', async () => {
    mockPrisma.studySettings.findUnique.mockResolvedValueOnce(null);
    mockPrisma.studySettings.upsert.mockResolvedValueOnce({
      userId: 'user-1',
      newCardsPerDay: STUDY_NEW_CARDS_PER_DAY_DEFAULT,
    });

    await expect(getStudySettings('user-1')).resolves.toEqual({
      newCardsPerDay: STUDY_NEW_CARDS_PER_DAY_DEFAULT,
    });
    expect(mockPrisma.studySettings.findUnique).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(mockPrisma.studySettings.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      update: {},
      create: {
        userId: 'user-1',
        newCardsPerDay: STUDY_NEW_CARDS_PER_DAY_DEFAULT,
      },
    });

    mockPrisma.studySettings.findUnique.mockResolvedValueOnce({
      userId: 'user-1',
      newCardsPerDay: 8,
    });
    mockPrisma.studySettings.upsert.mockClear();
    await expect(getStudySettings('user-1')).resolves.toEqual({
      newCardsPerDay: 8,
    });
    expect(mockPrisma.studySettings.upsert).not.toHaveBeenCalled();

    mockPrisma.studySettings.upsert.mockResolvedValueOnce({
      userId: 'user-1',
      newCardsPerDay: 12,
    });

    await expect(updateStudySettings({ userId: 'user-1', newCardsPerDay: 12 })).resolves.toEqual({
      newCardsPerDay: 12,
    });
    await expect(updateStudySettings({ userId: 'user-1', newCardsPerDay: -1 })).rejects.toThrow(
      'newCardsPerDay must be an integer'
    );
  });

  it('resolves pitch accent and persists it on the card answer JSON', async () => {
    const existing = {
      ...buildStudySessionCard({
        id: 'pitch-card',
        queueState: 'review',
        label: '会社',
      }),
      promptJson: { cueText: '会社', cueReading: 'かいしゃ' },
      answerJson: {
        expression: '会社',
        expressionReading: '会社[かいしゃ]',
        meaning: 'company',
      },
      note: { rawFieldsJson: {} },
    };
    const pitchAccent = {
      status: 'resolved' as const,
      expression: '会社',
      reading: 'かいしゃ',
      pitchNum: 0,
      morae: ['か', 'い', 'しゃ'],
      pattern: [0, 1, 1],
      patternName: '平板',
      source: 'kanjium' as const,
      resolvedBy: 'local-reading' as const,
    };
    mockPrisma.studyCard.findFirst.mockResolvedValueOnce(existing);
    mockPrisma.studyCard.update.mockResolvedValue({
      ...existing,
      answerJson: {
        ...existing.answerJson,
        pitchAccent,
      },
    });
    resolvePitchAccentMock.mockResolvedValue(pitchAccent);

    const result = await resolveStudyCardPitchAccent({
      userId: 'user-1',
      cardId: 'pitch-card',
    });

    expect(resolvePitchAccentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        expression: '会社',
        expressionReading: '会社[かいしゃ]',
        promptReading: 'かいしゃ',
      })
    );
    expect(mockPrisma.studyCard.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pitch-card' },
        data: expect.objectContaining({
          answerJson: expect.objectContaining({
            pitchAccent,
          }),
        }),
      })
    );
    expect(result.answer.pitchAccent).toEqual(pitchAccent);
  });

  it('returns cached pitch accent data without rewriting the card answer JSON', async () => {
    const pitchAccent = {
      status: 'resolved' as const,
      expression: '会社',
      reading: 'かいしゃ',
      pitchNum: 0,
      morae: ['か', 'い', 'しゃ'],
      pattern: [0, 1, 1],
      patternName: '平板',
      source: 'kanjium' as const,
      resolvedBy: 'local-reading' as const,
    };
    const existing = {
      ...buildStudySessionCard({
        id: 'pitch-card',
        queueState: 'review',
        label: '会社',
      }),
      promptJson: { cueText: '会社', cueReading: 'かいしゃ' },
      answerJson: {
        expression: '会社',
        expressionReading: '会社[かいしゃ]',
        meaning: 'company',
        pitchAccent,
      },
      note: { rawFieldsJson: {} },
    };
    mockPrisma.studyCard.findFirst.mockResolvedValueOnce(existing);
    resolvePitchAccentMock.mockImplementationOnce(async (input) => input.cached);

    const result = await resolveStudyCardPitchAccent({
      userId: 'user-1',
      cardId: 'pitch-card',
    });

    expect(resolvePitchAccentMock).toHaveBeenCalledWith(
      expect.objectContaining({ cached: pitchAccent })
    );
    expect(mockPrisma.studyCard.update).not.toHaveBeenCalled();
    expect(result.answer.pitchAccent).toEqual(pitchAccent);
  });

  it('resolves cloze pitch accent from the restored answer sentence without furigana', async () => {
    const existing = buildClozeStudyCardRecord(
      '明日[あした]から早[はや]く起[お]きることにします。'
    );
    const pitchAccent = {
      status: 'unresolved' as const,
      expression: '明日から早く起きることにします。',
      reason: 'not-found' as const,
      source: 'kanjium' as const,
      resolvedBy: 'none' as const,
    };
    mockPrisma.studyCard.findFirst.mockResolvedValueOnce(existing);
    mockPrisma.studyCard.update.mockResolvedValue({
      ...existing,
      answerJson: {
        ...existing.answerJson,
        pitchAccent,
      },
    });
    resolvePitchAccentMock.mockResolvedValue(pitchAccent);

    const result = await resolveStudyCardPitchAccent({
      userId: 'user-1',
      cardId: 'card-1',
    });

    expect(resolvePitchAccentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        expression: '明日から早く起きることにします。',
        expressionReading: '明日[あした]から早[はや]く起[お]きることにします。',
        promptReading: null,
        sentenceJp: '明日から早く起きることにします。',
      })
    );
    expect(result.answer.pitchAccent).toEqual(pitchAccent);
  });

  it('updates a study card without changing scheduling and regenerates answer audio when spoken answer text changes', async () => {
    mockPrisma.studyCard.findFirst
      .mockResolvedValueOnce({
        id: 'card-1',
        userId: 'user-1',
        noteId: 'note-1',
        cardType: 'recognition',
        queueState: 'review',
        dueAt: new Date('2026-04-12T00:00:00.000Z'),
        sourceTemplateOrd: 0,
        answerAudioSource: 'imported',
        answerAudioMediaId: 'media-old',
        promptJson: { cueText: '会社', cueReading: 'かいしゃ' },
        answerJson: {
          expression: '会社',
          expressionReading: '会社[かいしゃ]',
          meaning: 'company',
          answerAudioVoiceId: 'ja-JP-Wavenet-C',
          answerAudio: {
            filename: 'old.mp3',
            url: '/study-media/user-1/import/old.mp3',
            mediaKind: 'audio',
            source: 'imported',
          },
        },
        schedulerStateJson: {
          due: new Date('2026-04-12T00:00:00.000Z').toISOString(),
          stability: 10,
          difficulty: 4,
          elapsed_days: 4,
          scheduled_days: 10,
          learning_steps: 0,
          reps: 6,
          lapses: 1,
          state: 2,
          last_review: new Date('2026-04-08T00:00:00.000Z').toISOString(),
        },
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        note: {},
      })
      .mockResolvedValueOnce({
        id: 'card-1',
        userId: 'user-1',
        noteId: 'note-1',
        cardType: 'recognition',
        queueState: 'review',
        dueAt: new Date('2026-04-12T00:00:00.000Z'),
        answerAudioSource: 'generated',
        promptJson: { cueText: '会社', cueReading: 'かいしゃ' },
        answerJson: {
          expression: '事業',
          expressionReading: '事業[じぎょう]',
          meaning: 'business',
          answerAudioVoiceId: 'ja-JP-Neural2-C',
          answerAudioTextOverride: 'じぎょう',
        },
        schedulerStateJson: {
          due: new Date('2026-04-12T00:00:00.000Z').toISOString(),
          stability: 10,
          difficulty: 4,
          elapsed_days: 4,
          scheduled_days: 10,
          learning_steps: 0,
          reps: 6,
          lapses: 1,
          state: 2,
          last_review: new Date('2026-04-08T00:00:00.000Z').toISOString(),
        },
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        note: {},
      });
    mockPrisma.studyCard.findUnique.mockResolvedValue({
      id: 'card-1',
      userId: 'user-1',
      answerAudioSource: 'missing',
      answerJson: {
        expression: '事業',
        meaning: 'business',
        answerAudioVoiceId: 'ja-JP-Neural2-C',
        answerAudioTextOverride: 'じぎょう',
      },
    });
    mockPrisma.studyMedia.create.mockResolvedValue({ id: 'media-generated' });
    mockPrisma.studyCard.update.mockResolvedValue({});

    const updated = await updateStudyCard({
      userId: 'user-1',
      cardId: 'card-1',
      prompt: { cueText: '会社', cueReading: 'かいしゃ' },
      answer: {
        expression: '事業',
        expressionReading: '事業[じぎょう]',
        meaning: 'business',
        answerAudioVoiceId: 'ja-JP-Neural2-C',
        answerAudioTextOverride: 'じぎょう',
      },
    });

    expect(vi.mocked(synthesizeBatchedTexts)).toHaveBeenCalledWith(['じぎょう'], {
      voiceId: 'ja-JP-Neural2-C',
      languageCode: 'ja-JP',
      speed: 1,
    });
    expect(updated.answer.expression).toBe('事業');
  });

  it('preserves manually edited cloze restored-answer readings', async () => {
    mockPrisma.studyCard.findFirst
      .mockResolvedValueOnce(
        buildClozeStudyCardRecord('明日[あした]から早[はや]く起[お]きることにします。')
      )
      .mockResolvedValueOnce(
        buildClozeStudyCardRecord('明日[あす]から早[はや]く起[お]きることにします。')
      );
    mockPrisma.studyCard.updateMany.mockResolvedValue({ count: 1 });

    const updated = await updateStudyCard({
      userId: 'user-1',
      cardId: 'card-1',
      prompt: {
        clozeText: '明日から{{c1::早く起きる}}ことにします。',
        clozeHint: 'get up early',
      },
      answer: {
        restoredText: '明日から早く起きることにします。',
        restoredTextReading: '明日[あす]から早[はや]く起[お]きることにします。',
        meaning: 'I will start getting up early from tomorrow.',
      },
    });

    expect(mockPrisma.studyCard.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          answerJson: expect.objectContaining({
            restoredTextReading: '明日[あす]から早[はや]く起[お]きることにします。',
          }),
        }),
      })
    );
    expect(updated.answer.restoredTextReading).toBe(
      '明日[あす]から早[はや]く起[お]きることにします。'
    );
    expect(vi.mocked(addFuriganaBrackets)).not.toHaveBeenCalled();
  });

  it('auto-generates cloze restored-answer readings when the edit payload leaves them blank', async () => {
    // The suffix marks the mocked furigana-service return value; it is not real bracket notation.
    mockPrisma.studyCard.findFirst
      .mockResolvedValueOnce(
        buildClozeStudyCardRecord('明日[あした]から早[はや]く起[お]きることにします。')
      )
      .mockResolvedValueOnce(
        buildClozeStudyCardRecord('明日から早く起きることにします。[furigana]')
      );
    mockPrisma.studyCard.updateMany.mockResolvedValue({ count: 1 });

    await updateStudyCard({
      userId: 'user-1',
      cardId: 'card-1',
      prompt: {
        clozeText: '明日から{{c1::早く起きる}}ことにします。',
        clozeHint: 'get up early',
      },
      answer: {
        restoredText: '明日から早く起きることにします。',
        restoredTextReading: null,
        meaning: 'I will start getting up early from tomorrow.',
      },
    });

    expect(vi.mocked(addFuriganaBrackets)).toHaveBeenCalledWith('明日から早く起きることにします。');
    expect(mockPrisma.studyCard.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          answerJson: expect.objectContaining({
            restoredTextReading: '明日から早く起きることにします。[furigana]',
          }),
        }),
      })
    );
  });

  it('deletes a selected study card and removes an empty note', async () => {
    mockPrisma.studyCard.findFirst.mockResolvedValue({
      id: 'card-1',
      userId: 'user-1',
      noteId: 'note-1',
      promptAudioMedia: null,
      answerAudioMedia: null,
      imageMedia: null,
    });
    mockPrisma.studyCard.count.mockResolvedValueOnce(0);
    mockPrisma.studyCard.delete.mockResolvedValue({});
    mockPrisma.studyNote.deleteMany.mockResolvedValue({ count: 1 });

    await deleteStudyCard({ userId: 'user-1', cardId: 'card-1' });

    expect(mockPrisma.studyCard.delete).toHaveBeenCalledWith({
      where: { id: 'card-1' },
    });
    expect(mockPrisma.studyNote.deleteMany).toHaveBeenCalledWith({
      where: { id: 'note-1', userId: 'user-1' },
    });
  });

  it('keeps the note when deleting one of several sibling cards', async () => {
    mockPrisma.studyCard.findFirst.mockResolvedValue({
      id: 'card-1',
      userId: 'user-1',
      noteId: 'note-1',
      promptAudioMedia: null,
      answerAudioMedia: null,
      imageMedia: null,
    });
    mockPrisma.studyCard.count.mockResolvedValueOnce(2);
    mockPrisma.studyCard.delete.mockResolvedValue({});

    await deleteStudyCard({ userId: 'user-1', cardId: 'card-1' });

    expect(mockPrisma.studyCard.delete).toHaveBeenCalledWith({
      where: { id: 'card-1' },
    });
    expect(mockPrisma.studyNote.deleteMany).not.toHaveBeenCalled();
  });

  it('cleans up unreferenced generated media after deleting a card', async () => {
    const storagePath = 'study-media/generated/card-1/audio.mp3';
    const localMediaPath = path.join(getPrivateStudyMediaRoot(), storagePath);
    await fs.mkdir(path.dirname(localMediaPath), { recursive: true });
    await fs.writeFile(localMediaPath, 'audio');
    mockPrisma.studyCard.findFirst.mockResolvedValue({
      id: 'card-1',
      userId: 'user-1',
      noteId: 'note-1',
      promptAudioMedia: {
        id: 'media-1',
        sourceKind: 'generated',
        storagePath,
      },
      answerAudioMedia: null,
      imageMedia: null,
    });
    mockPrisma.studyCard.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    mockPrisma.studyCard.delete.mockResolvedValue({});
    mockPrisma.studyNote.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.studyMedia.deleteMany.mockResolvedValue({ count: 1 });

    await deleteStudyCard({ userId: 'user-1', cardId: 'card-1' });

    expect(mockPrisma.studyMedia.deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'media-1',
        sourceKind: {
          in: ['generated', 'generated_preview'],
        },
      },
    });
    await expect(fs.access(localMediaPath)).rejects.toThrow();
  });

  it('keeps generated media that is still referenced by another card', async () => {
    mockPrisma.studyCard.findFirst.mockResolvedValue({
      id: 'card-1',
      userId: 'user-1',
      noteId: 'note-1',
      promptAudioMedia: {
        id: 'media-1',
        sourceKind: 'generated',
        storagePath: 'study-media/generated/card-1/audio.mp3',
      },
      answerAudioMedia: null,
      imageMedia: null,
    });
    mockPrisma.studyCard.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    mockPrisma.studyCard.delete.mockResolvedValue({});
    mockPrisma.studyNote.deleteMany.mockResolvedValue({ count: 1 });

    await deleteStudyCard({ userId: 'user-1', cardId: 'card-1' });

    expect(mockPrisma.studyMedia.deleteMany).not.toHaveBeenCalled();
  });

  it('starts a study session and returns overview plus visible cards', async () => {
    mockPrisma.studySettings.findUnique.mockResolvedValue({
      userId: 'user-1',
      newCardsPerDay: 0,
    });
    mockPrisma.studyCard.findMany.mockResolvedValueOnce([
      {
        id: 'card-1',
        userId: 'user-1',
        noteId: 'note-1',
        cardType: 'recognition',
        queueState: 'review',
        dueAt: new Date('2026-04-12T00:00:00.000Z'),
        sourceDue: 1,
        answerAudioSource: 'missing',
        promptJson: { cueText: '会社' },
        answerJson: { expression: '会社', meaning: 'company' },
        schedulerStateJson: {
          due: new Date('2026-04-12T00:00:00.000Z').toISOString(),
          stability: 10,
          difficulty: 4,
          elapsed_days: 4,
          scheduled_days: 10,
          learning_steps: 0,
          reps: 6,
          lapses: 1,
          state: 2,
          last_review: new Date('2026-04-08T00:00:00.000Z').toISOString(),
        },
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        note: {},
      },
    ]);
    mockPrisma.studyCard.findMany.mockResolvedValueOnce([]);
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        due_count: 1,
        new_count: 0,
        learning_count: 0,
        review_count: 1,
        suspended_count: 0,
        total_cards: 1,
        next_due_at: new Date('2026-04-12T00:00:00.000Z'),
      },
    ]);
    mockPrisma.studyImportJob.findFirst.mockResolvedValue(null);

    const session = await startStudySession('user-1');
    const overview = await getStudyOverview('user-1');

    expect(session.cards).toHaveLength(1);
    expect(overview.totalCards).toBeGreaterThanOrEqual(0);
    expect(mockPrisma.studyCard.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
        take: STUDY_SESSION_READY_CARD_LIMIT,
      })
    );
  });

  it('adds due cards first and then the remaining daily new-card allowance in queue order', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-12T02:00:00.000Z'));
    const introducedToday = STUDY_NEW_CARDS_PER_DAY_DEFAULT - 2;
    const expectedNewCardCount = STUDY_NEW_CARDS_PER_DAY_DEFAULT - introducedToday;
    const expectedDueCardLimit = STUDY_SESSION_READY_CARD_LIMIT - expectedNewCardCount;
    try {
      mockPrisma.studySettings.findUnique.mockResolvedValue({
        userId: 'user-1',
        newCardsPerDay: STUDY_NEW_CARDS_PER_DAY_DEFAULT,
      });
      mockPrisma.studyCard.count.mockResolvedValue(introducedToday);
      mockPrisma.studyCard.findMany
        .mockResolvedValueOnce([
          buildStudySessionCard({
            id: 'new-1',
            queueState: 'new',
            label: 'new one',
            newQueuePosition: 1,
          }),
          buildStudySessionCard({
            id: 'new-2',
            queueState: 'new',
            label: 'new two',
            newQueuePosition: 2,
          }),
        ])
        .mockResolvedValueOnce([
          buildStudySessionCard({
            id: 'review-1',
            queueState: 'review',
            label: 'review one',
          }),
        ]);
      mockPrisma.$queryRaw.mockResolvedValue([
        buildStudyOverviewRow({ dueCount: 1, newCount: 10 }),
      ]);
      mockPrisma.studyImportJob.findFirst.mockResolvedValue(null);

      const session = await startStudySession('user-1', { timeZone: 'America/New_York' });

      expect(session.cards.map((card) => card.id)).toEqual(['review-1', 'new-1', 'new-2']);
      expect(mockPrisma.studyCard.findMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: { userId: 'user-1', queueState: 'new' },
          orderBy: [{ newQueuePosition: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
          take: expectedNewCardCount,
        })
      );
      expect(mockPrisma.studyCard.findMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
            queueState: { in: ['learning', 'review', 'relearning'] },
            dueAt: {
              lte: new Date('2026-04-12T02:00:00.000Z'),
            },
          }),
          orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
          take: expectedDueCardLimit,
        })
      );
      expect(mockPrisma.studySettings.findUnique).toHaveBeenCalledTimes(1);
      expect(mockPrisma.studyCard.count).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reserves daily new-card slots when due cards exceed the session cap', async () => {
    const expectedNewCardCount = STUDY_NEW_CARDS_PER_DAY_DEFAULT;
    const expectedDueCardCount = STUDY_SESSION_READY_CARD_LIMIT - expectedNewCardCount;
    const extraDueCardCount = 324;
    const extraNewCardCount = 30;
    mockPrisma.studySettings.findUnique.mockResolvedValue({
      userId: 'user-1',
      newCardsPerDay: STUDY_NEW_CARDS_PER_DAY_DEFAULT,
    });
    mockPrisma.studyCard.count.mockResolvedValue(0);
    mockPrisma.studyCard.findMany
      .mockResolvedValueOnce(
        Array.from({ length: expectedNewCardCount }, (_, index) =>
          buildStudySessionCard({
            id: `new-${index + 1}`,
            queueState: 'new',
            newQueuePosition: index + 1,
          })
        )
      )
      .mockResolvedValueOnce(
        Array.from({ length: expectedDueCardCount }, (_, index) =>
          buildStudySessionCard({ id: `review-${index + 1}`, queueState: 'review' })
        )
      );
    mockPrisma.$queryRaw.mockResolvedValue([
      buildStudyOverviewRow({
        dueCount: STUDY_SESSION_READY_CARD_LIMIT + extraDueCardCount,
        newCount: STUDY_NEW_CARDS_PER_DAY_DEFAULT + extraNewCardCount,
        totalCards: STUDY_SESSION_READY_CARD_LIMIT + extraDueCardCount + extraNewCardCount,
      }),
    ]);
    mockPrisma.studyImportJob.findFirst.mockResolvedValue(null);

    const session = await startStudySession('user-1', { timeZone: 'America/New_York' });

    expect(session.cards).toHaveLength(STUDY_SESSION_READY_CARD_LIMIT);
    expect(session.cards.slice(0, 2).map((card) => card.id)).toEqual(['review-1', 'review-2']);
    expect(session.cards.slice(-2).map((card) => card.id)).toEqual([
      `new-${expectedNewCardCount - 1}`,
      `new-${expectedNewCardCount}`,
    ]);
    expect(mockPrisma.studyCard.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { userId: 'user-1', queueState: 'new' },
        take: expectedNewCardCount,
      })
    );
    expect(mockPrisma.studyCard.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
        take: expectedDueCardCount,
      })
    );
  });

  it('caps true new cards at the daily limit instead of stacking queued new cards', async () => {
    const queuedNewCardCount = 31;
    const expectedNewCardCount = STUDY_NEW_CARDS_PER_DAY_DEFAULT;

    mockPrisma.studySettings.findUnique.mockResolvedValue({
      userId: 'user-1',
      newCardsPerDay: STUDY_NEW_CARDS_PER_DAY_DEFAULT,
    });
    mockPrisma.studyCard.count.mockResolvedValue(0);
    mockPrisma.studyCard.findMany
      .mockResolvedValueOnce(
        Array.from({ length: expectedNewCardCount }, (_, index) =>
          buildStudySessionCard({
            id: `new-${index + 1}`,
            queueState: 'new',
            newQueuePosition: index + 1,
          })
        )
      )
      .mockResolvedValueOnce([]);
    mockPrisma.$queryRaw.mockResolvedValue([
      buildStudyOverviewRow({
        newCount: queuedNewCardCount,
        reviewCount: 0,
        totalCards: queuedNewCardCount,
        nextDueAt: null,
      }),
    ]);
    mockPrisma.studyImportJob.findFirst.mockResolvedValue(null);

    const session = await startStudySession('user-1', { timeZone: 'America/New_York' });

    expect(session.cards).toHaveLength(expectedNewCardCount);
    expect(session.cards.every((card) => card.state.queueState === 'new')).toBe(true);
    expect(mockPrisma.studyCard.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { userId: 'user-1', queueState: 'new' },
        take: expectedNewCardCount,
      })
    );
  });

  it('reduces the new-card session cap by cards already introduced today', async () => {
    const introducedToday = 5;
    const expectedNewCardCount = STUDY_NEW_CARDS_PER_DAY_DEFAULT - introducedToday;

    mockPrisma.studySettings.findUnique.mockResolvedValue({
      userId: 'user-1',
      newCardsPerDay: STUDY_NEW_CARDS_PER_DAY_DEFAULT,
    });
    mockPrisma.studyCard.count.mockResolvedValue(introducedToday);
    mockPrisma.studyCard.findMany
      .mockResolvedValueOnce(
        Array.from({ length: expectedNewCardCount }, (_, index) =>
          buildStudySessionCard({
            id: `new-${index + 1}`,
            queueState: 'new',
            newQueuePosition: index + 1,
          })
        )
      )
      .mockResolvedValueOnce([]);
    mockPrisma.$queryRaw.mockResolvedValue([
      buildStudyOverviewRow({
        newCount: STUDY_NEW_CARDS_PER_DAY_DEFAULT,
        reviewCount: 0,
        totalCards: STUDY_NEW_CARDS_PER_DAY_DEFAULT,
        nextDueAt: null,
      }),
    ]);
    mockPrisma.studyImportJob.findFirst.mockResolvedValue(null);

    const session = await startStudySession('user-1', { timeZone: 'America/New_York' });

    expect(session.cards).toHaveLength(expectedNewCardCount);
    expect(mockPrisma.studyCard.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { userId: 'user-1', queueState: 'new' },
        take: expectedNewCardCount,
      })
    );
  });

  it('does not add new cards when the daily allowance is exhausted', async () => {
    mockPrisma.studySettings.findUnique.mockResolvedValue({
      userId: 'user-1',
      newCardsPerDay: STUDY_NEW_CARDS_PER_DAY_DEFAULT,
    });
    mockPrisma.studyCard.count.mockResolvedValue(STUDY_NEW_CARDS_PER_DAY_DEFAULT);
    mockPrisma.studyCard.findMany.mockResolvedValueOnce([]);
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        due_count: 0,
        new_count: 10,
        learning_count: 0,
        review_count: 0,
        suspended_count: 0,
        total_cards: 10,
        next_due_at: null,
      },
    ]);
    mockPrisma.studyImportJob.findFirst.mockResolvedValue(null);

    const session = await startStudySession('user-1', { timeZone: 'America/New_York' });

    expect(session.cards).toHaveLength(0);
    expect(mockPrisma.studyCard.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.studyCard.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
        take: STUDY_SESSION_READY_CARD_LIMIT,
      })
    );
  });

  it('lists and reorders only owned active new cards', async () => {
    mockPrisma.studyCard.count.mockResolvedValueOnce(2);
    mockPrisma.studyCard.findMany.mockResolvedValueOnce([
      {
        id: 'card-1',
        noteId: 'note-1',
        cardType: 'recognition',
        promptJson: { cueText: '会社' },
        answerJson: { meaning: 'company' },
        newQueuePosition: 1,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-02T00:00:00.000Z'),
      },
      {
        id: 'card-2',
        noteId: 'note-2',
        cardType: 'production',
        promptJson: { cueText: '学校' },
        answerJson: { meaning: 'school' },
        newQueuePosition: 2,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-02T00:00:00.000Z'),
      },
    ]);

    const queue = await getStudyNewCardQueue({ userId: 'user-1' });

    expect(queue.items.map((item) => item.displayText)).toEqual(['会社', '学校']);
    expect(mockPrisma.studyCard.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', queueState: 'new' },
        orderBy: [{ newQueuePosition: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      })
    );

    mockPrisma.studyCard.findMany.mockResolvedValueOnce([
      { id: 'card-1', newQueuePosition: 1 },
      { id: 'card-2', newQueuePosition: 2 },
    ]);
    mockPrisma.$executeRaw.mockResolvedValueOnce(2);
    mockPrisma.studyCard.count.mockResolvedValueOnce(2);
    mockPrisma.studyCard.findMany.mockResolvedValueOnce([]);

    await reorderStudyNewCardQueue({ userId: 'user-1', cardIds: ['card-2', 'card-1'] });

    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(mockPrisma.$executeRaw.mock.calls[0]?.[1]).toMatchObject({
      values: ['card-2', 1, 'card-1', 2],
    });
    expect(mockPrisma.studyCard.updateMany).not.toHaveBeenCalled();
    await expect(
      reorderStudyNewCardQueue({ userId: 'user-1', cardIds: ['card-1', 'card-1'] })
    ).rejects.toThrow('duplicates');
  });

  it('fills null reorder positions after the current queue maximum', async () => {
    mockPrisma.studyCard.findMany.mockResolvedValueOnce([
      { id: 'card-1', newQueuePosition: null },
      { id: 'card-2', newQueuePosition: 2 },
    ]);
    mockPrisma.studyCard.aggregate.mockResolvedValueOnce({
      _max: {
        newQueuePosition: 8,
      },
    });
    mockPrisma.$executeRaw.mockResolvedValueOnce(2);
    mockPrisma.studyCard.count.mockResolvedValueOnce(2);
    mockPrisma.studyCard.findMany.mockResolvedValueOnce([]);

    await reorderStudyNewCardQueue({ userId: 'user-1', cardIds: ['card-1', 'card-2'] });

    expect(mockPrisma.studyCard.aggregate).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        queueState: 'new',
      },
      _max: {
        newQueuePosition: true,
      },
    });
    expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(mockPrisma.$executeRaw.mock.calls[0]?.[1]).toMatchObject({
      values: ['card-1', 2, 'card-2', 9],
    });
  });

  it('rejects reorder when the bulk update does not update every requested card', async () => {
    mockPrisma.studyCard.findMany.mockResolvedValueOnce([
      { id: 'card-1', newQueuePosition: 1 },
      { id: 'card-2', newQueuePosition: 2 },
    ]);
    mockPrisma.$executeRaw.mockResolvedValueOnce(1);

    await expect(
      reorderStudyNewCardQueue({ userId: 'user-1', cardIds: ['card-1', 'card-2'] })
    ).rejects.toThrow('Every reordered card');
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('reports daily new-card allowance fields in the overview', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-12T02:00:00.000Z'));

    try {
      mockPrisma.studySettings.findUnique.mockResolvedValue({
        userId: 'user-1',
        newCardsPerDay: 20,
      });
      mockPrisma.studyCard.count.mockResolvedValueOnce(7);
      mockPrisma.$queryRaw.mockResolvedValueOnce([buildStudyOverviewRow({ newCount: 12 })]);
      mockPrisma.studyImportJob.findFirst.mockResolvedValue(null);

      const overview = await getStudyOverview('user-1', 'America/New_York');

      expect(overview.newCardsPerDay).toBe(20);
      expect(overview.newCardsIntroducedToday).toBe(7);
      expect(overview.newCardsAvailableToday).toBe(12);
      expect(mockPrisma.studyCard.count).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          introducedAt: {
            gte: new Date('2026-04-11T04:00:00.000Z'),
            lt: new Date('2026-04-12T04:00:00.000Z'),
          },
        },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('only eagerly prepares media for the first study-session cards', async () => {
    const ankiMediaDir = await fs.mkdtemp(path.join(os.tmpdir(), 'study-session-media-'));
    const previousAnkiMediaDir = process.env.ANKI_MEDIA_DIR;
    const previousGcsBucketName = process.env.GCS_BUCKET_NAME;
    process.env.ANKI_MEDIA_DIR = ankiMediaDir;
    process.env.GCS_BUCKET_NAME = 'test-bucket';

    try {
      mockPrisma.studySettings.findUnique.mockResolvedValue({
        userId: 'user-1',
        newCardsPerDay: 0,
      });
      await Promise.all(
        Array.from({ length: 31 }, (_, index) =>
          fs.writeFile(path.join(ankiMediaDir, `card-${index + 1}.mp3`), 'fake-audio')
        )
      );

      mockPrisma.studyCard.findMany.mockResolvedValueOnce(
        Array.from({ length: 31 }, (_, index) => {
          const ordinal = index + 1;

          return {
            id: `card-${ordinal}`,
            userId: 'user-1',
            noteId: `note-${ordinal}`,
            cardType: 'recognition',
            queueState: 'review',
            dueAt: new Date('2026-04-12T00:00:00.000Z'),
            sourceDue: ordinal,
            answerAudioSource: 'imported',
            promptJson: {
              cueText: `会社${ordinal}`,
              cueAudio: {
                filename: `card-${ordinal}.mp3`,
                mediaKind: 'audio',
                source: 'imported',
              },
            },
            answerJson: { expression: `会社${ordinal}`, meaning: 'company' },
            schedulerStateJson: {
              due: new Date('2026-04-12T00:00:00.000Z').toISOString(),
              stability: 10,
              difficulty: 4,
              elapsed_days: 4,
              scheduled_days: 10,
              learning_steps: 0,
              reps: 6,
              lapses: 1,
              state: 2,
              last_review: new Date('2026-04-08T00:00:00.000Z').toISOString(),
            },
            createdAt: new Date('2026-04-01T00:00:00.000Z'),
            updatedAt: new Date('2026-04-12T00:00:00.000Z'),
            note: {},
            promptAudioMedia: {
              id: `media-${ordinal}`,
              userId: 'user-1',
              importJobId: 'import-1',
              sourceKind: 'anki_import',
              sourceFilename: `card-${ordinal}.mp3`,
              normalizedFilename: `card-${ordinal}.mp3`,
              mediaKind: 'audio',
              storagePath: null,
              publicUrl: null,
            },
          };
        })
      );
      mockPrisma.studyCard.findMany.mockResolvedValueOnce([]);
      mockPrisma.studyMedia.update.mockImplementation(async ({ where, data }) => ({
        id: where.id,
        userId: 'user-1',
        importJobId: 'import-1',
        sourceKind: 'anki_import',
        sourceFilename: `${where.id}.mp3`,
        normalizedFilename: `${where.id}.mp3`,
        mediaKind: 'audio',
        storagePath: data.storagePath,
        publicUrl: data.publicUrl,
      }));
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          due_count: 31,
          new_count: 0,
          learning_count: 0,
          review_count: 31,
          suspended_count: 0,
          total_cards: 31,
          next_due_at: new Date('2026-04-12T00:00:00.000Z'),
        },
      ]);
      mockPrisma.studyImportJob.findFirst.mockResolvedValue(null);

      const session = await startStudySession('user-1');

      expect(session.cards).toHaveLength(31);
      expect(mockPrisma.studyMedia.update).toHaveBeenCalledTimes(30);
      expect(uploadBufferToGCSPathMock).toHaveBeenCalledTimes(30);
      expect(mockPrisma.studyMedia.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'media-31' } })
      );
    } finally {
      if (previousAnkiMediaDir === undefined) {
        delete process.env.ANKI_MEDIA_DIR;
      } else {
        process.env.ANKI_MEDIA_DIR = previousAnkiMediaDir;
      }
      if (previousGcsBucketName === undefined) {
        delete process.env.GCS_BUCKET_NAME;
      } else {
        process.env.GCS_BUCKET_NAME = previousGcsBucketName;
      }
      await fs.rm(ankiMediaDir, { recursive: true, force: true });
    }
  });

  it('excludes suspended and buried cards from the nextDueAt overview lookup', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        due_count: 1,
        new_count: 0,
        learning_count: 0,
        review_count: 1,
        suspended_count: 1,
        total_cards: 2,
        next_due_at: new Date('2026-04-12T00:00:00.000Z'),
      },
    ]);
    mockPrisma.studyImportJob.findFirst.mockResolvedValue(null);

    const overview = await getStudyOverview('user-1');

    expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    expect(mockPrisma.studyCard.findMany).not.toHaveBeenCalled();
    expect(overview.nextDueAt).toBe('2026-04-12T00:00:00.000Z');
  });

  it('returns a valid overview when scheduler state must be reconstructed for imported cards', async () => {
    mockPrisma.studySettings.findUnique.mockResolvedValue({
      userId: 'user-1',
      newCardsPerDay: 0,
    });
    mockPrisma.studyCard.findMany.mockResolvedValueOnce([
      {
        id: 'card-1',
        userId: 'user-1',
        noteId: 'note-1',
        cardType: 'recognition',
        queueState: 'review',
        dueAt: new Date('2026-04-12T00:00:00.000Z'),
        sourceDue: 42,
        sourceInterval: 12,
        sourceReps: 4,
        sourceLapses: 1,
        sourceFsrsJson: { s: 12.5, d: 4.2, lrt: 1769832848 },
        lastReviewedAt: new Date('2026-04-08T00:00:00.000Z'),
        answerAudioSource: 'missing',
        promptJson: { cueText: '会社' },
        answerJson: { expression: '会社', meaning: 'company' },
        schedulerStateJson: null,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        note: {
          rawFieldsJson: {},
          sourceNoteId: 1n,
          sourceGuid: 'guid-1',
          sourceNotetypeId: 2n,
          sourceNotetypeName: 'Japanese - Vocab',
        },
      },
    ]);
    mockPrisma.studyCard.findMany.mockResolvedValueOnce([]);
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        due_count: 1,
        new_count: 0,
        learning_count: 0,
        review_count: 1,
        suspended_count: 0,
        total_cards: 1,
        next_due_at: new Date('2026-04-12T00:00:00.000Z'),
      },
    ]);
    mockPrisma.studyImportJob.findFirst.mockResolvedValue(null);

    const session = await startStudySession('user-1');

    expect(session.cards[0]?.state.scheduler).toEqual(
      expect.objectContaining({
        difficulty: expect.any(Number),
        stability: expect.any(Number),
        due: expect.any(String),
      })
    );
  });

  it('keeps overview totalCards stable when an action moves a card between buckets', async () => {
    mockPrisma.studyCard.findFirst
      .mockResolvedValueOnce({
        id: 'card-1',
        userId: 'user-1',
        noteId: 'note-1',
        cardType: 'recognition',
        queueState: 'review',
        dueAt: new Date('2026-04-12T00:00:00.000Z'),
        answerAudioSource: 'imported',
        promptJson: { cueText: '会社' },
        answerJson: { expression: '会社', meaning: 'company' },
        schedulerStateJson: {
          due: new Date('2026-04-12T00:00:00.000Z').toISOString(),
          stability: 10,
          difficulty: 4,
          elapsed_days: 4,
          scheduled_days: 10,
          learning_steps: 0,
          reps: 6,
          lapses: 1,
          state: 2,
          last_review: new Date('2026-04-08T00:00:00.000Z').toISOString(),
        },
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        lastReviewedAt: new Date('2026-04-08T00:00:00.000Z'),
        note: {},
      })
      .mockResolvedValueOnce({
        id: 'card-1',
        userId: 'user-1',
        noteId: 'note-1',
        cardType: 'recognition',
        queueState: 'suspended',
        dueAt: new Date('2026-04-12T00:00:00.000Z'),
        answerAudioSource: 'imported',
        promptJson: { cueText: '会社' },
        answerJson: { expression: '会社', meaning: 'company' },
        schedulerStateJson: {
          due: new Date('2026-04-12T00:00:00.000Z').toISOString(),
          stability: 10,
          difficulty: 4,
          elapsed_days: 4,
          scheduled_days: 10,
          learning_steps: 0,
          reps: 6,
          lapses: 1,
          state: 2,
          last_review: new Date('2026-04-08T00:00:00.000Z').toISOString(),
        },
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        lastReviewedAt: new Date('2026-04-08T00:00:00.000Z'),
        note: {},
      });
    mockPrisma.studyCard.updateMany.mockResolvedValue({ count: 1 });

    const result = await performStudyCardAction({
      userId: 'user-1',
      cardId: 'card-1',
      action: 'suspend',
      currentOverview: {
        dueCount: 1,
        newCount: 0,
        learningCount: 0,
        reviewCount: 1,
        suspendedCount: 0,
        totalCards: 1,
        latestImport: null,
        nextDueAt: '2026-04-12T00:00:00.000Z',
      },
    });

    expect(result.overview.reviewCount).toBe(0);
    expect(result.overview.suspendedCount).toBe(1);
    expect(result.overview.totalCards).toBe(1);
  });

  it('forwards the device timezone to fallback overviews after card actions', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-12T02:00:00.000Z'));

    try {
      mockPrisma.studyCard.findFirst
        .mockResolvedValueOnce({
          ...buildStudySessionCard({ id: 'card-1', queueState: 'review' }),
          lastReviewedAt: new Date('2026-04-08T00:00:00.000Z'),
        })
        .mockResolvedValueOnce({
          ...buildStudySessionCard({ id: 'card-1', queueState: 'review' }),
          queueState: 'suspended',
          lastReviewedAt: new Date('2026-04-08T00:00:00.000Z'),
        });
      mockPrisma.studyCard.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.$queryRaw.mockResolvedValue([
        buildStudyOverviewRow({
          dueCount: 0,
          reviewCount: 0,
          suspendedCount: 1,
          totalCards: 1,
          nextDueAt: null,
        }),
      ]);
      mockPrisma.studyImportJob.findFirst.mockResolvedValue(null);

      await performStudyCardAction({
        userId: 'user-1',
        cardId: 'card-1',
        action: 'suspend',
        timeZone: 'America/New_York',
      });

      expect(mockPrisma.studyCard.count).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          introducedAt: {
            gte: new Date('2026-04-11T04:00:00.000Z'),
            lt: new Date('2026-04-12T04:00:00.000Z'),
          },
        },
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
