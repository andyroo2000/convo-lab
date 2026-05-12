import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSynthesizeBatchedTexts = vi.hoisted(() => vi.fn());
const mockPersistStudyMediaBuffer = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  monologueAudioTake: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  monologueProject: {
    findFirst: vi.fn(),
  },
  monologueSegment: {
    findFirst: vi.fn(),
  },
  studyMedia: {
    create: vi.fn(),
  },
}));

vi.mock('../../../db/client.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../../services/batchedTTSClient.js', () => ({
  synthesizeBatchedTexts: mockSynthesizeBatchedTexts,
}));

vi.mock('../../../services/study/shared/mediaHelpers.js', () => ({
  persistStudyMediaBuffer: mockPersistStudyMediaBuffer,
}));

vi.mock('fluent-ffmpeg', () => ({
  default: vi.fn(),
}));

const { generateMonologueSegmentAudioTake, regenerateMonologueAudioTake } =
  await import('../../../services/monologueService.js');

const now = new Date('2026-05-12T12:00:00.000Z');

function projectRecord() {
  return {
    id: 'project-1',
    userId: 'user-1',
    title: 'Tokyo story',
    sourceText: 'English source',
    targetLanguage: 'ja',
    nativeLanguage: 'en',
    status: 'approved',
    activeVersionId: 'version-1',
    createdAt: now,
    updatedAt: now,
    activeVersion: {
      id: 'version-1',
      userId: 'user-1',
      projectId: 'project-1',
      versionNumber: 1,
      status: 'approved',
      fullText: '日本語です。',
      generationMetadataJson: null,
      approvedAt: now,
      createdAt: now,
      updatedAt: now,
      segments: [
        {
          id: 'segment-1',
          userId: 'user-1',
          projectId: 'project-1',
          scriptVersionId: 'version-1',
          ordinal: 0,
          sourceText: 'English cue',
          japaneseText: '日本語です。',
          reading: 'にほんごです。',
          beatLabel: null,
          createdAt: now,
          updatedAt: now,
          audioTakes: [],
        },
      ],
    },
    audioTakes: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSynthesizeBatchedTexts.mockResolvedValue([Buffer.from('audio')]);
  mockPersistStudyMediaBuffer.mockResolvedValue({
    publicUrl: null,
    storagePath: 'study-media/user-1/monologue-generated/audio.mp3',
  });
  mockPrisma.studyMedia.create.mockResolvedValue({
    id: 'media-1',
    storagePath: 'study-media/user-1/monologue-generated/audio.mp3',
    publicUrl: null,
  });
  mockPrisma.monologueProject.findFirst.mockResolvedValue(projectRecord());
  mockPrisma.$transaction.mockImplementation(async (callback) => callback(mockPrisma));
});

describe('monologueService', () => {
  it('rejects sentence audio generation until the script is approved', async () => {
    mockPrisma.monologueSegment.findFirst.mockResolvedValue({
      id: 'segment-1',
      userId: 'user-1',
      projectId: 'project-1',
      scriptVersionId: 'version-1',
      ordinal: 0,
      sourceText: 'English cue',
      japaneseText: '日本語です。',
      reading: 'にほんごです。',
      beatLabel: null,
      createdAt: now,
      updatedAt: now,
      scriptVersion: { id: 'version-1', status: 'draft' },
    });

    await expect(
      generateMonologueSegmentAudioTake('user-1', 'project-1', 'segment-1', {
        voiceId: 'ja-JP-Neural2-D',
        speed: 0.85,
      })
    ).rejects.toThrow('Approve the monologue script before generating audio.');
    expect(mockSynthesizeBatchedTexts).not.toHaveBeenCalled();
  });

  it('forces Fish Audio sentence generation to 1x even if a slower speed is requested', async () => {
    mockPrisma.monologueSegment.findFirst.mockResolvedValue({
      id: 'segment-1',
      userId: 'user-1',
      projectId: 'project-1',
      scriptVersionId: 'version-1',
      ordinal: 0,
      sourceText: 'English cue',
      japaneseText: '日本語です。',
      reading: 'にほんごです。',
      beatLabel: null,
      createdAt: now,
      updatedAt: now,
      scriptVersion: { id: 'version-1', status: 'approved' },
    });

    await generateMonologueSegmentAudioTake('user-1', 'project-1', 'segment-1', {
      voiceId: 'fishaudio:abb4362e736f40b7b5716f4fafcafa9f',
      speed: 0.75,
    });

    expect(mockSynthesizeBatchedTexts).toHaveBeenCalledWith(['日本語です。'], {
      voiceId: 'fishaudio:abb4362e736f40b7b5716f4fafcafa9f',
      languageCode: 'ja-JP',
      speed: 1,
    });
    expect(mockPrisma.monologueAudioTake.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          displayName: expect.stringContaining('1x'),
          speed: 1,
        }),
      })
    );
  });

  it('regenerates a take in place without changing display name or default status', async () => {
    mockPrisma.monologueAudioTake.findFirst.mockResolvedValue({
      id: 'take-1',
      userId: 'user-1',
      projectId: 'project-1',
      scriptVersionId: 'version-1',
      segmentId: 'segment-1',
      mediaId: 'old-media',
      displayName: 'Slow shadowing',
      source: 'tts',
      provider: 'google',
      voiceId: 'ja-JP-Neural2-D',
      speed: 0.85,
      scope: 'sentence',
      isDefault: true,
      createdAt: now,
      updatedAt: now,
      segment: {
        id: 'segment-1',
        japaneseText: '日本語です。',
        reading: 'にほんごです。',
      },
      scriptVersion: { id: 'version-1', status: 'approved' },
    });

    await regenerateMonologueAudioTake('user-1', 'project-1', 'take-1');

    expect(mockPrisma.monologueAudioTake.update).toHaveBeenCalledWith({
      where: { id: 'take-1' },
      data: {
        mediaId: 'media-1',
        provider: 'google',
        speed: 0.85,
      },
    });
  });
});
