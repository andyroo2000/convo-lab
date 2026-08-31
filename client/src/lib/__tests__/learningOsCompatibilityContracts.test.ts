import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, expectTypeOf, it } from 'vitest';
import type { StudyCardSummary, StudyClientCapabilities } from '@languageflow/shared/src/types';

import type { DailyAudioPractice } from '../../types';
import type { StudyTimeAnalytics } from '../../types/studyActivity';
import type { GoogleCalendarConnectionStatus } from '../../hooks/useGoogleCalendarConnection';
import type { KnownKanjiResponse } from '../../hooks/useKnownKanji';
import type { WeeklyStudyRecap } from '../../hooks/useWeeklyStudyRecap';
import {
  dailyAudioCompatibilityFixture,
  googleCalendarCompatibilityFixture,
  learningOsCompatibilityFixtures,
  knownKanjiCompatibilityFixture,
  studyAnalyticsCompatibilityFixture,
  studyCardCompatibilityFixture,
  weeklyRecapCompatibilityFixture,
  wanikaniTransferBridgeUpdateCompatibilityFixture,
} from '../../test/fixtures/learningOsCompatibility';
import {
  decodeDailyAudioPractice,
  decodeDailyAudioPracticeStatus,
  decodeGoogleCalendarConnectionStatus,
  decodeKnownKanjiResponse,
  decodeStudyCardSummary,
  decodeStudyClientCapabilities,
  decodeStudyTimeAnalytics,
  decodeWeeklyStudyRecap,
} from '../learningOsContractDecoders';
import studyCapabilitiesFixture from '../../test/studyCapabilitiesFixture';

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

  it('rejects missing and invalid card revisions', () => {
    const payload = studyCardCompatibilityFixture.cases[0].payload as Record<string, unknown>;
    const legacyPayload = { ...payload };
    delete (legacyPayload as { revision?: unknown }).revision;

    expect(() => decodeStudyCardSummary(legacyPayload)).toThrow(
      'study card.revision must be a finite number.'
    );
    expect(() => decodeStudyCardSummary({ ...payload, revision: -1 })).toThrow(
      'study card.revision must be a nonnegative integer.'
    );
  });

  it('uses presentation v1 while preserving raw fallback for missing and future versions', () => {
    const payload = structuredClone(studyCardCompatibilityFixture.cases[0].payload) as Record<
      string,
      unknown
    >;
    const decoded = decodeStudyCardSummary(payload);
    expect(decoded.presentation).toMatchObject({
      version: 1,
      front: { mode: 'text', text: '聞く' },
      answer: { heading: 'to listen', notes: [] },
    });

    const withoutPresentation = { ...payload };
    delete withoutPresentation.presentation;
    expect(decodeStudyCardSummary(withoutPresentation).presentation).toBeUndefined();

    expect(
      decodeStudyCardSummary({ ...payload, presentation: { version: 2, futureShape: true } })
        .presentation
    ).toBeNull();
  });

  it('accepts nullable presentation v1 media metadata while rejecting wrong types', () => {
    const nullablePayload = structuredClone(studyCardCompatibilityFixture.cases[0].payload) as {
      presentation: {
        front: { media: { audio: Record<string, unknown> | null } };
      };
    };
    nullablePayload.presentation.front.media.audio = {
      id: null,
      filename: null,
      url: '/api/study/media/audio/example',
      mediaKind: null,
      source: null,
    };

    expect(decodeStudyCardSummary(nullablePayload).presentation?.front.media.audio).toMatchObject({
      id: null,
      filename: null,
      mediaKind: null,
      source: null,
    });

    (['id', 'filename', 'mediaKind', 'source'] as const).forEach((field) => {
      const invalidPayload = structuredClone(nullablePayload);
      invalidPayload.presentation.front.media.audio = { [field]: 42 };

      expect(() => decodeStudyCardSummary(invalidPayload), field).toThrow(
        `study card.presentation.front.media.audio.${field} must be a string.`
      );
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

  it('decodes legacy and v2 known-kanji snapshots without synthesizing bridge state', () => {
    const snapshots = knownKanjiCompatibilityFixture.cases.map(({ payload }) =>
      decodeKnownKanjiResponse(payload)
    );
    expectTypeOf(snapshots).toEqualTypeOf<KnownKanjiResponse[]>();
    expect(snapshots[0].wanikani).toEqual({
      connected: true,
      lastSyncedAt: '2026-08-25T10:15:30.000000Z',
    });
    expect(snapshots[0].wanikani.transferBridge).toBeUndefined();
    expect(snapshots[1].wanikani).toMatchObject({
      reviewCount: 17,
      transferBridge: {
        enabled: true,
        importedVocabularyCount: 1,
        pendingVocabularyCount: 1,
        failedVocabularyCount: 1,
        lastImportedAt: '2026-08-25T11:00:00.000000Z',
      },
    });
  });

  it('decodes the canonical transfer-bridge update response as a full v2 snapshot', () => {
    const update = wanikaniTransferBridgeUpdateCompatibilityFixture.cases[0];
    expect(update.request).toEqual({ enabled: true });
    expect(decodeKnownKanjiResponse(update.response).wanikani.transferBridge).toEqual({
      enabled: true,
      importedVocabularyCount: 0,
      pendingVocabularyCount: 0,
      failedVocabularyCount: 0,
      lastImportedAt: null,
    });
  });

  it('rejects invalid known-kanji transfer counts before they reach context consumers', () => {
    const payload = structuredClone(knownKanjiCompatibilityFixture.cases[1].payload) as {
      wanikani: { transferBridge: { pendingVocabularyCount: number } };
    };
    payload.wanikani.transferBridge.pendingVocabularyCount = -1;
    expect(() => decodeKnownKanjiResponse(payload)).toThrow(
      'known kanji.wanikani.transferBridge.pendingVocabularyCount must be a nonnegative integer'
    );
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
      scriptUnitsJson: [
        { type: 'marker', label: 'Recall' },
        { type: 'narration_L1', text: 'company', voiceId: '' },
        { type: 'L2', text: '会社', voiceId: '' },
      ],
      timingData: [
        { unitIndex: 1, startTime: 0, endTime: 600 },
        { unitIndex: 2, startTime: 600, endTime: 1200 },
      ],
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

  it('rejects legacy Daily Audio timing entries outside the canonical API contract', () => {
    const payload = structuredClone(dailyAudioCompatibilityFixture.cases[0].payload) as {
      tracks: Array<{ scriptUnitsJson: unknown[]; timingData: unknown[] }>;
    };
    payload.tracks[0]!.timingData = [{ startMs: 0, endMs: 500 }];

    expect(() => decodeDailyAudioPractice(payload)).toThrow(
      'Daily Audio timing[0].unitIndex must be a finite number.'
    );
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

  it('allows absent analytics bucket metadata but rejects unknown units', () => {
    const withoutMetadata = structuredClone(
      studyAnalyticsCompatibilityFixture.cases[0].payload
    ) as { ranges: Array<{ bucketUnit?: unknown; bucketStep?: unknown }> };
    delete withoutMetadata.ranges[0]!.bucketUnit;
    delete withoutMetadata.ranges[0]!.bucketStep;
    expect(decodeStudyTimeAnalytics(withoutMetadata).ranges[0]?.bucketUnit).toBeUndefined();

    const unknownUnit = structuredClone(studyAnalyticsCompatibilityFixture.cases[0].payload) as {
      ranges: Array<{ bucketUnit: unknown }>;
    };
    unknownUnit.ranges[0]!.bucketUnit = 'fortnight';
    expect(() => decodeStudyTimeAnalytics(unknownUnit)).toThrow(
      'study activity analytics.ranges[0].bucketUnit is not supported'
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

describe('Study client capabilities contract', () => {
  it('decodes the authenticated capability document', () => {
    const decoded = decodeStudyClientCapabilities(studyCapabilitiesFixture);

    expectTypeOf(decoded).toEqualTypeOf<StudyClientCapabilities>();
    expect(decoded.settings.lessonBatchSize).toEqual({ default: 5, min: 3, max: 10 });
    expect(decoded.cardAuthoring.limits.imagePromptCharacters).toBe(1000);
    expect(decoded.imports.maxArchiveBytes).toBe(2147483648);
    expect(decoded.studyActivity.categoriesByActivity).toEqual(
      studyCapabilitiesFixture.studyActivity.categoriesByActivity
    );
  });

  it('rejects unsupported versions and invalid default ranges', () => {
    expect(() =>
      decodeStudyClientCapabilities({ ...studyCapabilitiesFixture, version: 2 })
    ).toThrow('study capabilities.version is not supported');
    expect(() =>
      decodeStudyClientCapabilities({
        ...studyCapabilitiesFixture,
        dailyAudio: { targetDurationMinutes: { default: 90, min: 5, max: 60 } },
      })
    ).toThrow('must have an ordered range containing its default');
  });

  it('rejects missing or unsupported activity category mappings', () => {
    const { card_review: _cardReview, ...missingCardReview } =
      studyCapabilitiesFixture.studyActivity.categoriesByActivity;

    expect(() =>
      decodeStudyClientCapabilities({
        ...studyCapabilitiesFixture,
        studyActivity: { categoriesByActivity: missingCardReview },
      })
    ).toThrow('study capabilities.studyActivity.categoriesByActivity.card_review must be a string');
    expect(() =>
      decodeStudyClientCapabilities({
        ...studyCapabilitiesFixture,
        studyActivity: {
          categoriesByActivity: {
            ...studyCapabilitiesFixture.studyActivity.categoriesByActivity,
            daily_audio: 'unsupported',
          },
        },
      })
    ).toThrow('study capabilities.studyActivity.categoriesByActivity.daily_audio is not supported');
  });
});
