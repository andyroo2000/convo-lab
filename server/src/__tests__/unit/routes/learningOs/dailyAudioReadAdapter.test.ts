import { describe, expect, it } from 'vitest';

import { adaptDailyAudioReadResponse } from '../../../../routes/learningOs/dailyAudioReadAdapter.js';

const practiceId = '123e4567-e89b-42d3-a456-426614174100';
const trackId = '123e4567-e89b-42d3-a456-426614174101';

const summaryTrack = {
  id: trackId,
  practiceId,
  mode: 'drill',
  status: 'ready',
  title: 'Focused drill',
  sortOrder: 0,
  audioUrl: '/api/daily-audio-practice/tracks/track/audio',
  approxDurationSeconds: 120,
  errorMessage: null,
  createdAt: '2026-07-18T12:00:00.000Z',
  updatedAt: '2026-07-18T12:00:00.000Z',
};

const practiceFields = {
  id: practiceId,
  userId: '123e4567-e89b-42d3-a456-426614174000',
  practiceDate: '2026-07-18',
  status: 'ready',
  targetDurationMinutes: 30,
  targetLanguage: 'ja',
  nativeLanguage: 'en',
  sourceCardIdsJson: ['123e4567-e89b-42d3-a456-426614174200'],
  selectionSummaryJson: {
    totalCandidates: 10,
    totalEligible: 8,
    selectedCount: 5,
  },
  errorMessage: null,
  createdAt: '2026-07-18T12:00:00.000Z',
  updatedAt: '2026-07-18T12:00:00.000Z',
};

describe('Daily Audio Learning OS response adapter', () => {
  it('accepts the exact list summary contract', () => {
    const response = [{ ...practiceFields, tracks: [summaryTrack] }];

    expect(adaptDailyAudioReadResponse('list', response)).toBe(response);
  });

  it('accepts ULID source card IDs created by Learning OS', () => {
    const response = [
      {
        ...practiceFields,
        sourceCardIdsJson: ['01JZ6J0F2DTQ6VDHEB5KZ7R3WX'],
        tracks: [summaryTrack],
      },
    ];

    expect(adaptDailyAudioReadResponse('list', response)).toBe(response);
  });

  it('accepts the exact detail contract', () => {
    const response = {
      ...practiceFields,
      tracks: [
        {
          ...summaryTrack,
          scriptUnitsJson: [],
          timingData: [],
          generationMetadataJson: {},
        },
      ],
    };

    expect(adaptDailyAudioReadResponse('detail', response)).toBe(response);
  });

  it('accepts the exact generation status contract', () => {
    const response = {
      id: practiceId,
      status: 'generating',
      progress: 33,
      tracks: [
        {
          id: trackId,
          mode: 'drill',
          status: 'ready',
          audioUrl: null,
          approxDurationSeconds: null,
        },
      ],
    };

    expect(adaptDailyAudioReadResponse('status', response)).toBe(response);
  });

  it.each([
    ['list', { data: [] }],
    ['list', [{ ...practiceFields, tracks: [], unexpected: 'field' }]],
    ['list', [{ ...practiceFields, sourceCardIdsJson: ['not-a-card-id'], tracks: [] }]],
    ['detail', { ...practiceFields, tracks: [summaryTrack] }],
    [
      'status',
      {
        id: practiceId,
        status: 'generating',
        progress: 101,
        tracks: [],
      },
    ],
    [
      'status',
      {
        id: practiceId,
        status: 'unknown',
        progress: null,
        tracks: [],
      },
    ],
  ] as const)('rejects an incompatible %s response', (kind, response) => {
    expect(() => adaptDailyAudioReadResponse(kind, response)).toThrow(
      `Learning OS Study API returned an invalid Daily Audio ${kind} response.`
    );
  });
});
