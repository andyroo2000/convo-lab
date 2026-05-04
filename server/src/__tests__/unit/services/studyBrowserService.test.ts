/* eslint-disable import/order */
import { beforeEach, afterEach, describe, expect, it } from 'vitest';

import { cleanupStudyServiceTestMedia, resetStudyServiceMocks } from './studyTestHelpers.js';
import { mockPrisma } from '../../setup.js';
import {
  getStudyBrowserList,
  getStudyBrowserNoteDetail,
} from '../../../services/studyBrowserService.js';

describe('studyBrowserService', () => {
  beforeEach(() => {
    resetStudyServiceMocks();
  });

  afterEach(async () => {
    await cleanupStudyServiceTestMedia();
  });

  it('returns note detail with inspector fields, cards, and review stats', async () => {
    mockPrisma.studyNote.findFirst.mockResolvedValue({
      id: 'note-1',
      sourceKind: 'anki_import',
      sourceNotetypeName: 'Japanese - Vocab',
      rawFieldsJson: {
        Expression: '会社',
        Meaning: 'company',
        Photo: '<img src="company.png">',
        AudioWord: '[sound:company-word.mp3]',
      },
      canonicalJson: {
        createdInApp: false,
      },
      updatedAt: new Date('2026-04-12T00:00:00.000Z'),
      cards: [
        {
          id: 'card-1',
          userId: 'user-1',
          noteId: 'note-1',
          cardType: 'recognition',
          queueState: 'review',
          dueAt: new Date('2026-04-12T00:00:00.000Z'),
          sourceTemplateOrd: 0,
          sourceTemplateName: 'Word -> Meaning',
          answerAudioSource: 'imported',
          promptJson: {
            cueText: '会社',
            cueAudio: { filename: 'company-word.mp3', mediaKind: 'audio', source: 'imported' },
            cueImage: { filename: 'company.png', mediaKind: 'image', source: 'imported_image' },
          },
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
          note: {
            id: 'note-1',
            sourceNotetypeName: 'Japanese - Vocab',
            rawFieldsJson: {
              Expression: '会社',
            },
          },
          promptAudioMedia: {
            id: 'media-audio',
            userId: 'user-1',
            sourceKind: 'anki_import',
            sourceFilename: 'company-word.mp3',
            mediaKind: 'audio',
            publicUrl: '/study-media/user-1/import/company-word.mp3',
          },
          answerAudioMedia: null,
          imageMedia: {
            id: 'media-image',
            userId: 'user-1',
            sourceKind: 'anki_import',
            sourceFilename: 'company.png',
            mediaKind: 'image',
            publicUrl: '/study-media/user-1/import/company.png',
          },
        },
      ],
    });
    mockPrisma.studyReviewLog.groupBy.mockResolvedValue([
      {
        cardId: 'card-1',
        _count: { _all: 4 },
        _max: { reviewedAt: new Date('2026-04-10T00:00:00.000Z') },
      },
    ]);

    const result = await getStudyBrowserNoteDetail('user-1', 'note-1');
    expect(result?.noteId).toBe('note-1');
    expect(result?.cardStats[0]).toMatchObject({ cardId: 'card-1', reviewCount: 4 });
  });

  it('returns cursor-paginated browser rows', async () => {
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([{ count: BigInt(2) }])
      .mockResolvedValueOnce([
        { id: 'note-2', updatedAt: new Date('2026-04-12T00:00:00.000Z') },
        { id: 'note-1', updatedAt: new Date('2026-04-11T00:00:00.000Z') },
      ])
      .mockResolvedValueOnce([{ value: 'Japanese - Vocab' }])
      .mockResolvedValueOnce([{ value: 'recognition' }])
      .mockResolvedValueOnce([{ value: 'review' }]);
    mockPrisma.studyNote.findMany.mockResolvedValue([
      {
        id: 'note-2',
        sourceNotetypeName: 'Japanese - Vocab',
        rawFieldsJson: { Expression: '会社' },
        createdAt: new Date('2026-04-10T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        cards: [
          {
            id: 'card-2',
            cardType: 'recognition',
            queueState: 'review',
            promptJson: {},
            answerJson: {},
          },
        ],
      },
    ]);
    mockPrisma.studyReviewLog.groupBy.mockResolvedValue([
      { cardId: 'card-2', _count: { _all: 1 } },
    ]);

    const result = await getStudyBrowserList({ userId: 'user-1', limit: 1 });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.createdAt).toBe('2026-04-10T00:00:00.000Z');
    expect(result.nextCursor).toBeTruthy();
  });

  it('defaults browser rows to created date descending sort cursors', async () => {
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([{ count: BigInt(1) }])
      .mockResolvedValueOnce([{ id: 'note-1', updatedAt: new Date(), sortValue: new Date() }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    mockPrisma.studyNote.findMany.mockResolvedValue([
      {
        id: 'note-1',
        sourceNotetypeName: 'Japanese - Vocab',
        rawFieldsJson: { Expression: '会社' },
        createdAt: new Date('2026-04-10T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        cards: [],
      },
    ]);
    mockPrisma.studyReviewLog.groupBy.mockResolvedValue([]);

    await getStudyBrowserList({ userId: 'user-1' });

    const pagedQuery = (
      mockPrisma.$queryRaw.mock.calls[1]?.[0] as { strings?: string[] } | undefined
    )?.strings?.join(' ');
    expect(pagedQuery).toContain('"createdAt"');
    expect(pagedQuery).toContain('DESC');
  });
});
