import { describe, expect, it } from 'vitest';

import { adaptDailyAudioResponse } from '../../../../routes/learningOs/dailyAudioAdapter.js';

const practiceId = '123e4567-e89b-42d3-a456-426614174100';
const trackId = '123e4567-e89b-42d3-a456-426614174101';
const upstreamAudioUrl = `/api/daily-audio-practice/${practiceId}/tracks/${trackId}/audio`;
const proxyAudioUrl = `/api/learning-os/study/daily-audio-practice/${practiceId}/tracks/${trackId}/audio`;

const summaryTrack = {
  id: trackId,
  practiceId,
  mode: 'drill',
  status: 'ready',
  title: 'Focused drill',
  sortOrder: 0,
  audioUrl: upstreamAudioUrl,
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

    expect(adaptDailyAudioResponse('list', response)).toEqual([
      {
        ...practiceFields,
        tracks: [{ ...summaryTrack, audioUrl: proxyAudioUrl }],
      },
    ]);
  });

  it('accepts ULID source card IDs created by Learning OS', () => {
    const response = [
      {
        ...practiceFields,
        sourceCardIdsJson: ['01JZ6J0F2DTQ6VDHEB5KZ7R3WX'],
        tracks: [summaryTrack],
      },
    ];

    expect(adaptDailyAudioResponse('list', response)).toEqual([
      {
        ...practiceFields,
        sourceCardIdsJson: ['01JZ6J0F2DTQ6VDHEB5KZ7R3WX'],
        tracks: [{ ...summaryTrack, audioUrl: proxyAudioUrl }],
      },
    ]);
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

    expect(adaptDailyAudioResponse('detail', response)).toEqual({
      ...practiceFields,
      tracks: [
        {
          ...summaryTrack,
          audioUrl: proxyAudioUrl,
          scriptUnitsJson: [],
          timingData: [],
          generationMetadataJson: {},
        },
      ],
    });
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
          audioUrl: upstreamAudioUrl,
          approxDurationSeconds: null,
        },
      ],
    };

    expect(adaptDailyAudioResponse('status', response)).toEqual({
      ...response,
      tracks: [{ ...response.tracks[0], audioUrl: proxyAudioUrl }],
    });
  });

  it('preserves imported legacy storage URLs', () => {
    const response = [
      {
        ...practiceFields,
        tracks: [{ ...summaryTrack, audioUrl: '/uploads/daily-audio/drill.mp3' }],
      },
    ];

    expect(adaptDailyAudioResponse('list', response)).toEqual(response);
  });

  it.each([
    ['list', { data: [] }],
    ['list', [{ ...practiceFields, tracks: [], unexpected: 'field' }]],
    ['list', [{ ...practiceFields, sourceCardIdsJson: ['not-a-card-id'], tracks: [] }]],
    [
      'list',
      [
        {
          ...practiceFields,
          tracks: [{ ...summaryTrack, practiceId: '123e4567-e89b-42d3-a456-426614174999' }],
        },
      ],
    ],
    [
      'list',
      [
        {
          ...practiceFields,
          tracks: [
            {
              ...summaryTrack,
              audioUrl:
                '/api/daily-audio-practice/123e4567-e89b-42d3-a456-426614174999/tracks/123e4567-e89b-42d3-a456-426614174998/audio',
            },
          ],
        },
      ],
    ],
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
    expect(() => adaptDailyAudioResponse(kind, response)).toThrow(
      `Learning OS Study API returned an invalid Daily Audio ${kind} response.`
    );
  });
});
