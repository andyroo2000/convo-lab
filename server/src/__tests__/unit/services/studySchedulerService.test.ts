/* eslint-disable import/order */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

import { cleanupStudyServiceTestMedia, resetStudyServiceMocks } from './studyTestHelpers.js';
import { mockPrisma } from '../../setup.js';
import {
  createStudyCard,
  getStudyOverview,
  recordStudyReview,
  startStudySession,
  undoStudyReview,
  updateStudyCard,
} from '../../../services/studySchedulerService.js';
import { synthesizeSpeech } from '../../../services/ttsClient.js';

describe('studySchedulerService', () => {
  beforeEach(() => {
    resetStudyServiceMocks();
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

  it('undoes a review and restores the previous scheduler state', async () => {
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
    });

    expect(undoResult.reviewLogId).toBe('review-log-1');
    expect(mockPrisma.studyCard.updateMany).toHaveBeenCalled();
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
    mockPrisma.studyCard.findMany.mockResolvedValue([
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
    mockPrisma.studyCard.count.mockResolvedValue(1);
    mockPrisma.studyCard.findFirst.mockResolvedValue({
      dueAt: new Date('2026-04-12T00:00:00.000Z'),
    });
    mockPrisma.studyImportJob.findFirst.mockResolvedValue(null);

    const session = await startStudySession('user-1', 20);
    const overview = await getStudyOverview('user-1');

    expect(session.cards).toHaveLength(1);
    expect(overview.totalCards).toBeGreaterThanOrEqual(0);
  });

  it('excludes suspended and buried cards from the nextDueAt overview lookup', async () => {
    mockPrisma.studyCard.count.mockResolvedValue(1);
    mockPrisma.studyCard.groupBy.mockResolvedValue([
      { queueState: 'review', _count: { _all: 1 } },
      { queueState: 'suspended', _count: { _all: 1 } },
    ]);
    mockPrisma.studyCard.findFirst.mockResolvedValue({
      dueAt: new Date('2026-04-12T00:00:00.000Z'),
    });
    mockPrisma.studyImportJob.findFirst.mockResolvedValue(null);

    const overview = await getStudyOverview('user-1');

    expect(mockPrisma.studyCard.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        queueState: {
          in: ['learning', 'review', 'relearning'],
        },
        dueAt: {
          not: null,
        },
      },
      orderBy: {
        dueAt: 'asc',
      },
    });
    expect(overview.nextDueAt).toBe('2026-04-12T00:00:00.000Z');
  });
});
