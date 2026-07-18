import { describe, expect, it } from 'vitest';

import { adaptLearningOsStudyReadResponse } from '../../../../routes/learningOs/studyReadAdapters.js';

describe('Learning OS Study read response adapters', () => {
  const importJobResource = (preview: unknown = null) => ({
    id: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
    status: 'pending',
    source_type: 'anki_colpkg',
    source_filename: 'japanese.colpkg',
    source_content_type: 'application/zip',
    source_size_bytes: null,
    deck_name: 'Japanese',
    preview,
    summary: null,
    error_message: null,
    started_at: null,
    uploaded_at: null,
    upload_completed_at: null,
    upload_expires_at: '2026-07-16T13:00:00.000000Z',
    completed_at: null,
    created_at: '2026-07-16T12:00:00.000000Z',
    updated_at: '2026-07-16T12:00:00.000000Z',
  });

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

  it('adapts native and copied import previews to the shared client contract', () => {
    const nativePreview = {
      deck_name: 'Japanese',
      card_count: 12,
      note_count: 6,
      review_log_count: 30,
      media_reference_count: 4,
      skipped_media_count: 1,
      warnings: ['Skipped one unsafe media path.'],
      note_type_breakdown: [{ note_type_name: 'Japanese - Vocab', note_count: 6, card_count: 12 }],
    };
    const copiedPreview = {
      deckName: 'Japanese',
      cardCount: 12,
      noteCount: 6,
      reviewLogCount: 30,
      mediaReferenceCount: 4,
      skippedMediaCount: 1,
      warnings: ['Skipped one unsafe media path.'],
      noteTypeBreakdown: [{ notetypeName: 'Japanese - Vocab', noteCount: 6, cardCount: 12 }],
    };

    const expectedPreview = copiedPreview;
    expect(
      adaptLearningOsStudyReadResponse('importJob', {
        data: importJobResource(nativePreview),
      })
    ).toMatchObject({ preview: expectedPreview });
    expect(
      adaptLearningOsStudyReadResponse('importJob', {
        data: importJobResource(copiedPreview),
      })
    ).toMatchObject({ preview: expectedPreview });
  });

  it('adapts current, readiness, and upload-session import responses', () => {
    expect(adaptLearningOsStudyReadResponse('importCurrent', { data: null })).toBeNull();
    expect(
      adaptLearningOsStudyReadResponse('importReadiness', {
        ready: false,
        message: 'Import storage is unavailable.',
      })
    ).toEqual({ ready: false, message: 'Import storage is unavailable.' });
    expect(
      adaptLearningOsStudyReadResponse('importSession', {
        data: {
          import_job: importJobResource(),
          upload: {
            method: 'PUT',
            url: 'https://learning-os.example/api/study/imports/private/upload',
            headers: {
              'Content-Type': 'application/zip',
              Authorization: 'must-not-reach-the-browser',
            },
          },
        },
      })
    ).toEqual({
      importJob: expect.objectContaining({
        id: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
        sourceFilename: 'japanese.colpkg',
        uploadExpiresAt: '2026-07-16T13:00:00.000Z',
      }),
      upload: {
        method: 'PUT',
        url: '/api/learning-os/study/imports/01ARZ3NDEKTSV4RRFFQ69G5FAW/upload',
        headers: { 'Content-Type': 'application/zip' },
      },
    });
  });

  it('rejects malformed import lifecycle responses', () => {
    expect(() =>
      adaptLearningOsStudyReadResponse('importSession', {
        data: {
          import_job: importJobResource(),
          upload: { method: 'POST', url: 'https://example.test', headers: {} },
        },
      })
    ).toThrow('Learning OS Study API returned an invalid importSession response.');
    expect(() =>
      adaptLearningOsStudyReadResponse('importJob', {
        data: { ...importJobResource(), source_size_bytes: -1 },
      })
    ).toThrow('Learning OS Study API returned an invalid importJob response.');
  });

  it('validates a browser page and preserves the legacy list shape', () => {
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
          displayText: '会社',
          noteTypeName: 'Japanese - Vocab',
          cardCount: 2,
          reviewCount: 3,
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

  it('adapts browser note detail and removes Learning OS-only card metadata', () => {
    expect(
      adaptLearningOsStudyReadResponse('browserDetail', {
        noteId: 'note-1',
        displayText: '会社',
        noteTypeName: 'Japanese - Vocab',
        sourceKind: 'anki_import',
        reviewCount: 3,
        lastReviewedAt: '2026-07-14T12:00:00.000000Z',
        updatedAt: '2026-07-14T12:00:00.123456Z',
        rawFields: [
          {
            name: 'Expression',
            value: '会社',
            textValue: '会社',
            audio: {
              id: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
              filename: 'word.mp3',
              url: '/api/study/media/01arz3ndektsv4rrffq69g5faw',
              mediaKind: 'audio',
              source: 'imported',
            },
            image: null,
          },
        ],
        canonicalFields: [],
        cards: [
          {
            id: 'card-1',
            noteId: 'note-1',
            cardType: 'recognition',
            prompt: {
              cueText: '会社',
              cueAudio: {
                id: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
                filename: 'word.mp3',
                url: '/api/study/media/01ARZ3NDEKTSV4RRFFQ69G5FAW',
                mediaKind: 'audio',
                source: 'imported',
              },
            },
            answer: { meaning: 'company' },
            state: {
              dueAt: '2026-07-16T12:00:00.000000Z',
              introducedAt: null,
              failedAt: null,
              queueState: 'review',
              scheduler: { state: 2 },
              source: {
                noteId: '501',
                noteGuid: 'guid-1',
                cardId: '701',
                deckId: '301',
                deckName: 'Japanese',
                notetypeId: '601',
                notetypeName: 'Japanese - Vocab',
                templateOrd: 0,
                templateName: 'Card 1',
                queue: 2,
                type: 2,
                due: 12,
                ivl: 30,
                factor: 2500,
                reps: 7,
                lapses: 1,
                left: 0,
                odue: 4,
                odid: '901',
              },
              rawFsrs: { stability: 4.2 },
            },
            variantGroupId: null,
            variantSentenceId: null,
            variantKind: null,
            variantStage: null,
            variantStatus: null,
            variantUnlockedAt: null,
            answerAudioSource: 'generated',
            createdAt: '2026-07-01T12:00:00.000000Z',
            updatedAt: '2026-07-14T12:00:00.123456Z',
          },
        ],
        cardStats: [
          {
            cardId: 'card-1',
            reviewCount: 3,
            lastReviewedAt: '2026-07-14T12:00:00.000000Z',
          },
        ],
        selectedCardId: 'card-1',
      })
    ).toEqual({
      noteId: 'note-1',
      displayText: '会社',
      noteTypeName: 'Japanese - Vocab',
      sourceKind: 'anki_import',
      updatedAt: '2026-07-14T12:00:00.123Z',
      rawFields: [
        {
          name: 'Expression',
          value: '会社',
          textValue: '会社',
          audio: {
            id: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
            filename: 'word.mp3',
            url: '/api/learning-os/study/media/01ARZ3NDEKTSV4RRFFQ69G5FAW',
            mediaKind: 'audio',
            source: 'imported',
          },
          image: null,
        },
      ],
      canonicalFields: [],
      cards: [
        {
          id: 'card-1',
          noteId: 'note-1',
          cardType: 'recognition',
          prompt: {
            cueText: '会社',
            cueReading: null,
            cueMeaning: null,
            cueAudio: {
              id: '01ARZ3NDEKTSV4RRFFQ69G5FAW',
              filename: 'word.mp3',
              url: '/api/learning-os/study/media/01ARZ3NDEKTSV4RRFFQ69G5FAW',
              mediaKind: 'audio',
              source: 'imported',
            },
            cueImage: null,
            clozeText: null,
            clozeDisplayText: null,
            clozeAnswerText: null,
            clozeHint: null,
            clozeResolvedHint: null,
          },
          answer: {
            meaning: 'company',
            answerAudioVoiceId: null,
            answerAudioTextOverride: null,
          },
          state: {
            dueAt: '2026-07-16T12:00:00.000Z',
            introducedAt: null,
            failedAt: null,
            queueState: 'review',
            scheduler: { state: 2 },
            source: {
              noteId: '501',
              noteGuid: 'guid-1',
              cardId: '701',
              deckId: '301',
              deckName: 'Japanese',
              notetypeId: '601',
              notetypeName: 'Japanese - Vocab',
              templateOrd: 0,
              templateName: 'Card 1',
              queue: 2,
              type: 2,
              due: 12,
              ivl: 30,
              factor: 2500,
              reps: 7,
              lapses: 1,
              left: 0,
              odue: 4,
              odid: '901',
            },
            rawFsrs: { stability: 4.2 },
          },
          answerAudioSource: 'generated',
          createdAt: '2026-07-01T12:00:00.000Z',
          updatedAt: '2026-07-14T12:00:00.123Z',
        },
      ],
      cardStats: [
        {
          cardId: 'card-1',
          reviewCount: 3,
          lastReviewedAt: '2026-07-14T12:00:00.000Z',
        },
      ],
      selectedCardId: 'card-1',
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
    [
      'browserDetail',
      {
        noteId: 'note-1',
        displayText: '会社',
        noteTypeName: null,
        sourceKind: 'anki_import',
        updatedAt: '2026-07-14T12:00:00.000000Z',
        rawFields: 'not-an-array',
        canonicalFields: [],
        cards: [],
        cardStats: [],
        selectedCardId: null,
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
