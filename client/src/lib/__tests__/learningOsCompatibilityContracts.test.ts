import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, expectTypeOf, it } from 'vitest';
import type { StudyCardSummary } from '@languageflow/shared/src/types';

import type { DailyAudioPractice } from '../../types';
import type { StudyTimeAnalytics } from '../../types/studyActivity';
import type { GoogleCalendarConnectionStatus } from '../../hooks/useGoogleCalendarConnection';
import type { WeeklyStudyRecap } from '../../hooks/useWeeklyStudyRecap';
import {
  dailyAudioCompatibilityFixture,
  googleCalendarCompatibilityFixture,
  learningOsCompatibilityFixtures,
  studyAnalyticsCompatibilityFixture,
  studyCardCompatibilityFixture,
  weeklyRecapCompatibilityFixture,
} from '../../test/fixtures/learningOsCompatibility';
import {
  decodeDailyAudioPractice,
  decodeDailyAudioPracticeStatus,
  decodeGoogleCalendarConnectionStatus,
  decodeStudyCardSummary,
  decodeStudyTimeAnalytics,
  decodeWeeklyStudyRecap,
} from '../learningOsContractDecoders';

interface CompatibilityManifestEntry {
  id: string;
  path: string;
  checksumPath: string;
  sha256: string;
  producer: string;
}

interface CompatibilityManifest {
  schemaVersion: number;
  authority: { repository: string; manifest: string; productionRuntimeLoadsFixtures: boolean };
  fixtures: CompatibilityManifestEntry[];
}

const fixtureDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../test/fixtures/learning-os/Compatibility'
);
const sha256 = (contents: Buffer) => createHash('sha256').update(contents).digest('hex');
const basename = (providerPath: string) => providerPath.split('/').at(-1)!;

describe('vendored Learning OS compatibility fixtures', () => {
  it('preserves the canonical manifest, payload bytes, and checksum declarations', () => {
    const manifestBytes = readFileSync(resolve(fixtureDirectory, 'manifest-v1.json'));
    const manifest = JSON.parse(manifestBytes.toString('utf8')) as CompatibilityManifest;
    const manifestChecksum = readFileSync(resolve(fixtureDirectory, 'manifest-v1.sha256'), 'utf8')
      .trim()
      .split(/\s+/u)[0];

    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.authority).toEqual({
      repository: 'andyroo2000/learning-os',
      manifest: 'tests/Fixtures/Compatibility/manifest-v1.json',
      productionRuntimeLoadsFixtures: false,
    });
    expect(sha256(manifestBytes)).toBe(manifestChecksum);
    expect(manifest.fixtures.map(({ id }) => id)).toEqual(
      learningOsCompatibilityFixtures.map(({ contract }) => contract.id)
    );

    manifest.fixtures.forEach((entry) => {
      const payloadBytes = readFileSync(resolve(fixtureDirectory, basename(entry.path)));
      const checksum = readFileSync(resolve(fixtureDirectory, basename(entry.checksumPath)), 'utf8')
        .trim()
        .split(/\s+/u)[0];
      expect(sha256(payloadBytes), entry.id).toBe(entry.sha256);
      expect(checksum, entry.id).toBe(entry.sha256);
    });
  });

  it('decodes every StudyCardSummaryResource case through the web card boundary', () => {
    const cards = studyCardCompatibilityFixture.cases.map(({ payload }) =>
      decodeStudyCardSummary(payload)
    );
    expectTypeOf(cards).toEqualTypeOf<StudyCardSummary[]>();
    expect(cards.map(({ id }) => id)).toEqual([
      '01J60000000000000000000001',
      'c358732a-2cd0-4b18-9cce-c474297863f9',
    ]);
    expect(cards[1].state).toMatchObject({
      dueAt: '2026-09-01T12:00:00.000Z',
      scheduler: { stability: 45.5, difficulty: 3.25, reps: 12 },
      source: { noteGuid: 'anki-guid', deckName: 'Japanese' },
    });
  });

  it('decodes connected and disconnected Google Calendar boundary cases', () => {
    const connections = googleCalendarCompatibilityFixture.cases.map(({ payload }) =>
      decodeGoogleCalendarConnectionStatus(payload)
    );
    expectTypeOf(connections).toEqualTypeOf<GoogleCalendarConnectionStatus[]>();
    expect(connections[0]).toMatchObject({ connected: false, settings: null, sync: null });
    expect(connections[1]).toMatchObject({
      connected: true,
      accountEmail: 'andrew@example.com',
      sync: { status: 'failed', errorCode: 'provider_unavailable' },
    });
  });

  it('decodes all analytics ranges and preserves fractional cross-midnight allocation', () => {
    const analytics = decodeStudyTimeAnalytics(studyAnalyticsCompatibilityFixture.cases[0].payload);
    expectTypeOf(analytics).toEqualTypeOf<StudyTimeAnalytics>();
    expect(analytics.ranges.map(({ key }) => key)).toEqual([
      'today',
      'week',
      'month',
      'year',
      'all',
    ]);
    expect(analytics.ranges.find(({ key }) => key === 'week')?.categories).toMatchObject({
      review: 3_600_001,
      listen: 900_001,
      create: 1_000,
    });
  });

  it('decodes ready and error Daily Audio resources into playback-safe web types', () => {
    const practices = dailyAudioCompatibilityFixture.cases.map(({ payload }) =>
      decodeDailyAudioPractice(payload)
    );
    expectTypeOf(practices).toEqualTypeOf<DailyAudioPractice[]>();
    expect(practices[0].tracks[0]).toMatchObject({
      mode: 'drill',
      scriptUnitsJson: [{ type: 'L2', text: '会社' }],
      timingData: [{ unitIndex: 0, startTime: 0, endTime: 1200 }],
    });
    expect(practices[0].tracks[1]).toMatchObject({ mode: 'context', status: 'skipped' });
    expect(practices[0].selectionSummaryJson).toEqual({
      dueCount: 1,
      learningCount: 1,
    });
    expect(practices[0].selectionSummaryJson?.selectedCount).toBeUndefined();
    expect(practices[1]).toMatchObject({
      status: 'error',
      tracks: [],
      errorMessage: 'Generation failed.',
    });
  });

  it('maps legacy Daily Audio timing entries to interleaved non-marker script units', () => {
    const payload = structuredClone(dailyAudioCompatibilityFixture.cases[0].payload) as {
      tracks: Array<{ scriptUnitsJson: unknown[]; timingData: unknown[] }>;
    };
    payload.tracks[0]!.scriptUnitsJson = [
      { type: 'narration_L1', text: 'Listen.', voiceId: 'narrator' },
      { type: 'marker', label: 'prompt' },
      { type: 'L2', text: '会社', voiceId: 'speaker' },
    ];
    payload.tracks[0]!.timingData = [
      { startMs: 0, endMs: 500 },
      { startMs: 500, endMs: 1200 },
    ];

    expect(decodeDailyAudioPractice(payload).tracks[0]?.timingData).toEqual([
      { unitIndex: 0, startTime: 0, endTime: 500 },
      { unitIndex: 2, startTime: 500, endTime: 1200 },
    ]);
  });

  it('strictly validates type-keyed Daily Audio script units', () => {
    const payload = structuredClone(dailyAudioCompatibilityFixture.cases[0].payload) as {
      tracks: Array<{ scriptUnitsJson: unknown[] }>;
    };
    payload.tracks[0]!.scriptUnitsJson = [
      { type: 'L2', text: '会社', voiceId: 42 as unknown as string },
    ];

    expect(() => decodeDailyAudioPractice(payload)).toThrow(
      'Daily Audio script unit.voiceId must be a string'
    );
  });

  it('rejects analytics responses that omit a required range', () => {
    const payload = structuredClone(studyAnalyticsCompatibilityFixture.cases[0].payload) as {
      ranges: Array<{ key: string }>;
    };
    payload.ranges = payload.ranges.filter(({ key }) => key !== 'year');

    expect(() => decodeStudyTimeAnalytics(payload)).toThrow(
      'study activity analytics.ranges must contain each supported range once'
    );
  });

  it('decodes and rejects malformed Daily Audio generation status payloads', () => {
    const status = decodeDailyAudioPracticeStatus({
      id: 'practice-1',
      status: 'generating',
      progress: 33,
      tracks: [
        {
          id: 'track-1',
          mode: 'drill',
          status: 'ready',
          audioUrl: '/audio/drill.mp3',
          approxDurationSeconds: 30,
        },
      ],
    });
    expect(status.progress).toBe(33);
    expect(() =>
      decodeDailyAudioPracticeStatus({
        id: 'practice-1',
        status: 'generating',
        progress: '33',
        tracks: [],
      })
    ).toThrow('Daily Audio practice status.progress must be a finite number');
  });

  it('decodes empty and populated weekly recap boundary cases without losing nulls', () => {
    const recaps = weeklyRecapCompatibilityFixture.cases.map(({ payload }) =>
      decodeWeeklyStudyRecap(payload)
    );
    expectTypeOf(recaps).toEqualTypeOf<WeeklyStudyRecap[]>();
    expect(recaps[0].week).toMatchObject({ bestDay: null, recallRate: null, totalMs: 0 });
    expect(recaps[1].week).toMatchObject({
      totalMs: 5_400_000,
      bestDay: { date: '2026-08-03', totalMs: 3_600_000 },
    });
    expect(recaps[1].previousWeek.recallRate).toBe(1);
  });

  it('rejects a malformed provider payload before it reaches consumer code', () => {
    expect(() => decodeStudyCardSummary({ id: 'card-without-state' })).toThrow(
      'study card.noteId must be a string'
    );
  });
});
