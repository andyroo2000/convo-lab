/* eslint-disable import/order */
import { beforeEach, afterEach, describe, expect, it } from 'vitest';

import { cleanupStudyServiceTestMedia, resetStudyServiceMocks } from './studyTestHelpers.js';
import { mockPrisma } from '../../setup.js';
import {
  exportStudyCardsSection,
  exportStudyData,
  exportStudyImportsSection,
  exportStudyMediaSection,
  exportStudyReviewLogsSection,
} from '../../../services/studyExportService.js';

describe('studyExportService', () => {
  beforeEach(() => {
    resetStudyServiceMocks();
  });

  afterEach(async () => {
    await cleanupStudyServiceTestMedia();
  });

  it('returns a lightweight export manifest', async () => {
    mockPrisma.studyCard.count.mockResolvedValue(2);
    mockPrisma.studyReviewLog.count.mockResolvedValue(3);
    mockPrisma.studyMedia.count.mockResolvedValue(4);
    mockPrisma.studyImportJob.count.mockResolvedValue(1);

    const result = await exportStudyData('user-1');
    expect(result.sections.cards.total).toBe(2);
    expect(result.sections.reviewLogs.total).toBe(3);
  });

  it('returns cursor-paginated study cards for export', async () => {
    mockPrisma.studyCard.findMany.mockResolvedValue([
      {
        id: 'card-2',
        noteId: 'note-2',
        cardType: 'recognition',
        queueState: 'review',
        answerAudioSource: 'imported',
        promptJson: { cueText: '会社' },
        answerJson: { expression: '会社', meaning: 'company' },
        schedulerStateJson: null,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        note: {},
      },
      {
        id: 'card-1',
        noteId: 'note-1',
        cardType: 'recognition',
        queueState: 'review',
        answerAudioSource: 'imported',
        promptJson: { cueText: '入口' },
        answerJson: { expression: '入口', meaning: 'entrance' },
        schedulerStateJson: null,
        createdAt: new Date('2026-04-01T00:00:00.000Z'),
        updatedAt: new Date('2026-04-11T00:00:00.000Z'),
        note: {},
      },
    ]);

    const result = await exportStudyCardsSection({ userId: 'user-1', limit: 1 });
    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeTruthy();
  });

  it('returns cursor-paginated review logs, media, and imports', async () => {
    mockPrisma.studyReviewLog.findMany.mockResolvedValue([
      {
        id: 'log-2',
        cardId: 'card-2',
        source: 'convolab',
        reviewedAt: new Date('2026-04-12T00:00:00.000Z'),
        rating: 3,
        durationMs: 1200,
        sourceReviewId: null,
        stateBeforeJson: null,
        stateAfterJson: null,
        rawPayloadJson: {},
      },
      {
        id: 'log-1',
        cardId: 'card-1',
        source: 'anki_import',
        reviewedAt: new Date('2026-04-11T00:00:00.000Z'),
        rating: 2,
        durationMs: null,
        sourceReviewId: BigInt(123),
        stateBeforeJson: null,
        stateAfterJson: null,
        rawPayloadJson: {},
      },
    ]);
    mockPrisma.studyMedia.findMany.mockResolvedValue([
      {
        id: 'media-2',
        sourceFilename: 'company.mp3',
        mediaKind: 'audio',
        sourceKind: 'generated',
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
      },
      {
        id: 'media-1',
        sourceFilename: 'company.png',
        mediaKind: 'image',
        sourceKind: 'anki_import',
        updatedAt: new Date('2026-04-11T00:00:00.000Z'),
      },
    ]);
    mockPrisma.studyImportJob.findMany.mockResolvedValue([
      {
        id: 'import-2',
        status: 'completed',
        sourceFilename: 'japanese.colpkg',
        deckName: '日本語',
        previewJson: {
          deckName: '日本語',
          cardCount: 6,
          noteCount: 4,
          reviewLogCount: 3,
          mediaReferenceCount: 8,
          skippedMediaCount: 0,
          warnings: [],
          noteTypeBreakdown: [],
        },
        completedAt: new Date('2026-04-12T00:00:00.000Z'),
        updatedAt: new Date('2026-04-12T00:00:00.000Z'),
        errorMessage: null,
      },
      {
        id: 'import-1',
        status: 'failed',
        sourceFilename: 'broken.colpkg',
        deckName: '日本語',
        previewJson: null,
        completedAt: null,
        updatedAt: new Date('2026-04-11T00:00:00.000Z'),
        errorMessage: 'failed',
      },
    ]);

    const [logs, media, imports] = await Promise.all([
      exportStudyReviewLogsSection({ userId: 'user-1', limit: 1 }),
      exportStudyMediaSection({ userId: 'user-1', limit: 1 }),
      exportStudyImportsSection({ userId: 'user-1', limit: 1 }),
    ]);

    expect(logs.items).toHaveLength(1);
    expect(media.items).toHaveLength(1);
    expect(imports.items).toHaveLength(1);
    expect(logs.nextCursor).toBeTruthy();
    expect(media.nextCursor).toBeTruthy();
    expect(imports.nextCursor).toBeTruthy();
  });
});
