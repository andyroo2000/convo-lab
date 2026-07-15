import { describe, expect, it } from 'vitest';

import { adaptLearningOsStudyReadResponse } from '../../../../routes/learningOs/studyReadAdapters.js';

describe('Learning OS Study read response adapters', () => {
  it('adapts the Laravel settings resource', () => {
    expect(
      adaptLearningOsStudyReadResponse('settings', {
        data: {
          new_cards_per_day: 17,
          created_at: '2026-07-15T12:00:00.000000Z',
          updated_at: '2026-07-15T12:00:00.000000Z',
        },
      })
    ).toEqual({ newCardsPerDay: 17 });
  });

  it('adapts the Laravel overview and nested latest import resources', () => {
    expect(
      adaptLearningOsStudyReadResponse('overview', {
        data: {
          due_count: 3,
          failed_count: 2,
          new_count: 11,
          new_cards_per_day: 40,
          new_cards_introduced_today: 4,
          new_cards_available_today: 8,
          learning_count: 5,
          review_count: 100,
          suspended_count: 6,
          total_cards: 127,
          latest_import: {
            id: 'import-1',
            status: 'completed',
            source_type: 'anki_colpkg',
            source_filename: 'core.colpkg',
            source_content_type: 'application/zip',
            source_size_bytes: 1234,
            deck_name: 'Core',
            preview: {
              deckName: 'Core',
              cardCount: 20,
              noteCount: 10,
              reviewLogCount: 100,
              mediaReferenceCount: 5,
              skippedMediaCount: 1,
              warnings: ['Missing media'],
              noteTypeBreakdown: [
                { notetypeName: 'Japanese - Vocab', noteCount: 10, cardCount: 20 },
              ],
            },
            summary: { importedCards: 20 },
            error_message: null,
            started_at: '2026-07-14T11:00:00.000000Z',
            uploaded_at: '2026-07-14T10:00:00.000000Z',
            upload_completed_at: '2026-07-14T10:01:00.000000Z',
            upload_expires_at: null,
            completed_at: '2026-07-14T12:00:00.000000Z',
            created_at: '2026-07-14T10:00:00.000000Z',
            updated_at: '2026-07-14T12:00:00.000000Z',
          },
          next_due_at: '2026-07-16T12:00:00.000000Z',
        },
      })
    ).toEqual({
      dueCount: 3,
      failedCount: 2,
      newCount: 11,
      newCardsPerDay: 40,
      newCardsIntroducedToday: 4,
      newCardsAvailableToday: 8,
      learningCount: 5,
      reviewCount: 100,
      suspendedCount: 6,
      totalCards: 127,
      latestImport: {
        id: 'import-1',
        status: 'completed',
        sourceFilename: 'core.colpkg',
        deckName: 'Core',
        preview: {
          deckName: 'Core',
          cardCount: 20,
          noteCount: 10,
          reviewLogCount: 100,
          mediaReferenceCount: 5,
          skippedMediaCount: 1,
          warnings: ['Missing media'],
          noteTypeBreakdown: [{ notetypeName: 'Japanese - Vocab', noteCount: 10, cardCount: 20 }],
        },
        importedAt: '2026-07-14T12:00:00.000Z',
        errorMessage: null,
      },
      nextDueAt: '2026-07-16T12:00:00.000Z',
    });
  });

  it('adapts an empty overview without inventing an import', () => {
    expect(
      adaptLearningOsStudyReadResponse('overview', {
        data: {
          due_count: 0,
          failed_count: 0,
          new_count: 0,
          new_cards_per_day: 20,
          new_cards_introduced_today: 0,
          new_cards_available_today: 0,
          learning_count: 0,
          review_count: 0,
          suspended_count: 0,
          total_cards: 0,
          latest_import: null,
          next_due_at: null,
        },
      })
    ).toMatchObject({ latestImport: null, nextDueAt: null, totalCards: 0 });
  });

  it('validates and reconstructs a browser page', () => {
    expect(
      adaptLearningOsStudyReadResponse('browser', {
        rows: [
          {
            noteId: '1001',
            selectedCardId: 'card-1',
            displayText: '会社',
            noteTypeName: 'Japanese - Vocab',
            sourceKind: 'anki_import',
            cardCount: 2,
            reviewCount: 3,
            lastReviewedAt: '2026-07-14T12:00:00.000000Z',
            queueSummary: { new: 1, review: 1 },
            createdAt: '2026-07-01T12:00:00.000000Z',
            updatedAt: '2026-07-14T12:00:00.000000Z',
          },
        ],
        total: 1,
        limit: 50,
        nextCursor: null,
        filterOptions: {
          noteTypes: ['Japanese - Vocab'],
          cardTypes: ['production', 'recognition'],
          queueStates: ['new', 'review'],
        },
      })
    ).toEqual({
      rows: [
        {
          noteId: '1001',
          selectedCardId: 'card-1',
          displayText: '会社',
          noteTypeName: 'Japanese - Vocab',
          sourceKind: 'anki_import',
          cardCount: 2,
          reviewCount: 3,
          lastReviewedAt: '2026-07-14T12:00:00.000Z',
          queueSummary: { new: 1, review: 1 },
          createdAt: '2026-07-01T12:00:00.000Z',
          updatedAt: '2026-07-14T12:00:00.000Z',
        },
      ],
      total: 1,
      limit: 50,
      nextCursor: null,
      filterOptions: {
        noteTypes: ['Japanese - Vocab'],
        cardTypes: ['production', 'recognition'],
        queueStates: ['new', 'review'],
      },
    });
  });

  it('validates and reconstructs a new-card queue page', () => {
    expect(
      adaptLearningOsStudyReadResponse('newQueue', {
        items: [
          {
            id: 'card-1',
            noteId: '1001',
            cardType: 'recognition',
            displayText: '会社',
            meaning: 'company',
            queuePosition: 1,
            createdAt: '2026-07-01T12:00:00.000000Z',
            updatedAt: '2026-07-14T12:00:00.000000Z',
          },
        ],
        total: 1,
        limit: 100,
        nextCursor: '1',
      })
    ).toEqual({
      items: [
        {
          id: 'card-1',
          noteId: '1001',
          cardType: 'recognition',
          displayText: '会社',
          meaning: 'company',
          queuePosition: 1,
          createdAt: '2026-07-01T12:00:00.000Z',
          updatedAt: '2026-07-14T12:00:00.000Z',
        },
      ],
      total: 1,
      limit: 100,
      nextCursor: '1',
    });
  });

  it.each([
    ['settings', { data: { new_cards_per_day: '20' } }],
    ['overview', { data: { due_count: -1 } }],
    [
      'browser',
      {
        rows: [],
        total: 0,
        limit: 50,
        nextCursor: null,
        filterOptions: { noteTypes: [], cardTypes: ['unknown'], queueStates: [] },
      },
    ],
    [
      'newQueue',
      {
        items: [{ id: 'card-1', cardType: 'invalid' }],
        total: 1,
        limit: 100,
        nextCursor: null,
      },
    ],
  ] as const)('rejects malformed %s payloads with a sanitized gateway error', (feature, value) => {
    expect(() => adaptLearningOsStudyReadResponse(feature, value)).toThrow(
      `Learning OS Study API returned an invalid ${feature} response.`
    );

    try {
      adaptLearningOsStudyReadResponse(feature, value);
    } catch (error) {
      expect(error).toMatchObject({ statusCode: 502 });
    }
  });

  it('rejects permissive but non-contract timestamp strings', () => {
    expect(() =>
      adaptLearningOsStudyReadResponse('newQueue', {
        items: [
          {
            id: 'card-1',
            noteId: 'note-1',
            cardType: 'recognition',
            displayText: '会社',
            meaning: 'company',
            queuePosition: 1,
            createdAt: '2026-07-01',
            updatedAt: '2026-07-14T12:00:00.000000Z',
          },
        ],
        total: 1,
        limit: 100,
        nextCursor: null,
      })
    ).toThrow('Learning OS Study API returned an invalid newQueue response.');
  });
});
