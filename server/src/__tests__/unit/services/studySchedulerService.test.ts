/* eslint-disable import/order */
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { STUDY_NEW_CARDS_PER_DAY_DEFAULT } from '@languageflow/shared/src/studyConstants';

import {
  cleanupStudyServiceTestMedia,
  resetStudyServiceMocks,
  uploadBufferToGCSPathMock,
} from './studyTestHelpers.js';
import { mockPrisma } from '../../setup.js';
import {
  createStudyCard,
  getStudyNewCardQueue,
  getStudyOverview,
  getStudySettings,
  performStudyCardAction,
  recordStudyReview,
  reorderStudyNewCardQueue,
  startStudySession,
  undoStudyReview,
  updateStudySettings,
  updateStudyCard,
} from '../../../services/studySchedulerService.js';
import { STUDY_SESSION_READY_CARD_LIMIT } from '../../../services/study/shared.js';
import { synthesizeSpeech } from '../../../services/ttsClient.js';

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

  it('creates in-app cards and seeds answer-side audio generation', async () => {
    mockPrisma.studyNote.create.mockResolvedValue({ id: 'note-created' });
    mockPrisma.studyCard.create.mockResolvedValue({
      id: 'card-created',
      userId: 'user-1',
      noteId: 'note-created',
      cardType: 'recognition',
      queueState: 'new',
      answerAudioSource: 'missing',
      answerJson: { expression: '会社', meaning: 'company' },
      createdAt: new Date('2026-04-12T00:00:00.000Z'),
      updatedAt: new Date('2026-04-12T00:00:00.000Z'),
      note: {},
    });
    mockPrisma.studyCard.findUnique.mockResolvedValue({
      id: 'card-created',
      userId: 'user-1',
      answerAudioSource: 'missing',
      answerJson: { expression: '会社', meaning: 'company' },
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
      answer: { expression: '会社', meaning: 'company' },
    });

    expect(vi.mocked(synthesizeSpeech)).toHaveBeenCalled();
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
    mockPrisma.studySettings.upsert.mockResolvedValueOnce({
      userId: 'user-1',
      newCardsPerDay: STUDY_NEW_CARDS_PER_DAY_DEFAULT,
    });

    await expect(getStudySettings('user-1')).resolves.toEqual({
      newCardsPerDay: STUDY_NEW_CARDS_PER_DAY_DEFAULT,
    });
    expect(mockPrisma.studySettings.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      update: {},
      create: {
        userId: 'user-1',
        newCardsPerDay: STUDY_NEW_CARDS_PER_DAY_DEFAULT,
      },
    });

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
      answerJson: { expression: '事業', meaning: 'business' },
    });
    mockPrisma.studyMedia.create.mockResolvedValue({ id: 'media-generated' });
    mockPrisma.studyCard.update.mockResolvedValue({});

    const updated = await updateStudyCard({
      userId: 'user-1',
      cardId: 'card-1',
      prompt: { cueText: '会社', cueReading: 'かいしゃ' },
      answer: { expression: '事業', expressionReading: '事業[じぎょう]', meaning: 'business' },
    });

    expect(vi.mocked(synthesizeSpeech)).toHaveBeenCalled();
    expect(updated.answer.expression).toBe('事業');
  });

  it('starts a study session and returns overview plus visible cards', async () => {
    mockPrisma.studySettings.upsert.mockResolvedValue({
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
    const introducedToday = STUDY_NEW_CARDS_PER_DAY_DEFAULT - 2;
    const expectedNewCardCount = STUDY_NEW_CARDS_PER_DAY_DEFAULT - introducedToday;
    const expectedDueCardLimit = STUDY_SESSION_READY_CARD_LIMIT - expectedNewCardCount;
    mockPrisma.studySettings.upsert.mockResolvedValue({
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
    mockPrisma.$queryRaw.mockResolvedValue([buildStudyOverviewRow({ dueCount: 1, newCount: 10 })]);
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
        }),
        orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
        take: expectedDueCardLimit,
      })
    );
  });

  it('reserves daily new-card slots when due cards exceed the session cap', async () => {
    const expectedNewCardCount = STUDY_NEW_CARDS_PER_DAY_DEFAULT;
    const expectedDueCardCount = STUDY_SESSION_READY_CARD_LIMIT - expectedNewCardCount;
    const extraDueCardCount = 324;
    const extraNewCardCount = 30;
    mockPrisma.studySettings.upsert.mockResolvedValue({
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

  it('does not add new cards when the daily allowance is exhausted', async () => {
    mockPrisma.studySettings.upsert.mockResolvedValue({
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
    mockPrisma.studyCard.count.mockResolvedValueOnce(2);
    mockPrisma.studyCard.findMany.mockResolvedValueOnce([]);

    await reorderStudyNewCardQueue({ userId: 'user-1', cardIds: ['card-2', 'card-1'] });

    expect(mockPrisma.studyCard.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: 'card-2',
        userId: 'user-1',
        queueState: 'new',
      },
      data: {
        newQueuePosition: 1,
      },
    });
    expect(mockPrisma.studyCard.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: 'card-1',
        userId: 'user-1',
        queueState: 'new',
      },
      data: {
        newQueuePosition: 2,
      },
    });
    await expect(
      reorderStudyNewCardQueue({ userId: 'user-1', cardIds: ['card-1', 'card-1'] })
    ).rejects.toThrow('duplicates');
  });

  it('only eagerly prepares media for the first study-session cards', async () => {
    const ankiMediaDir = await fs.mkdtemp(path.join(os.tmpdir(), 'study-session-media-'));
    const previousAnkiMediaDir = process.env.ANKI_MEDIA_DIR;
    const previousGcsBucketName = process.env.GCS_BUCKET_NAME;
    process.env.ANKI_MEDIA_DIR = ankiMediaDir;
    process.env.GCS_BUCKET_NAME = 'test-bucket';

    try {
      mockPrisma.studySettings.upsert.mockResolvedValue({
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
    mockPrisma.studySettings.upsert.mockResolvedValue({
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
