import { writeFileSync } from 'node:fs';

import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSynthesizeBatchedTexts = vi.hoisted(() => vi.fn());
const mockPersistStudyMediaBuffer = vi.hoisted(() => vi.fn());
const mockGenerateCoreLlmJsonText = vi.hoisted(() => vi.fn());
const mockFindAccessibleLocalStudyMediaPath = vi.hoisted(() => vi.fn());
const mockDeletePersistedStudyMediaByStoragePath = vi.hoisted(() => vi.fn());
const mockFfmpeg = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  monologueAudioTake: {
    create: vi.fn(),
    deleteMany: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  monologueProject: {
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  monologueScriptVersion: {
    aggregate: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  monologueSegment: {
    createMany: vi.fn(),
    deleteMany: vi.fn(),
    findFirst: vi.fn(),
  },
  studyMedia: {
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock('../../../db/client.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../../services/batchedTTSClient.js', () => ({
  synthesizeBatchedTexts: mockSynthesizeBatchedTexts,
}));

vi.mock('../../../services/coreLlmClient.js', () => ({
  generateCoreLlmJsonText: mockGenerateCoreLlmJsonText,
}));

vi.mock('../../../services/study/shared/mediaHelpers.js', () => ({
  persistStudyMediaBuffer: mockPersistStudyMediaBuffer,
}));

vi.mock('../../../services/study/shared/paths.js', () => ({
  deletePersistedStudyMediaByStoragePath: mockDeletePersistedStudyMediaByStoragePath,
  findAccessibleLocalStudyMediaPath: mockFindAccessibleLocalStudyMediaPath,
  getStudyMediaApiPath: (mediaId: string) => `/api/study/media/${mediaId}`,
  normalizeFilename: (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, '-'),
}));

vi.mock('fluent-ffmpeg', () => ({
  default: mockFfmpeg,
}));

const {
  approveMonologueScript,
  createMonologueProject,
  generateMonologueFullAudioTake,
  generateMonologueSegmentAudioTake,
  getMonologueProject,
  listMonologueProjects,
  markMonologueFullAudioRenderFailed,
  prepareMonologueFullAudioRender,
  regenerateMonologueAudioTake,
  setMonologueDefaultAudioTake,
  updateMonologueDraft,
} = await import('../../../services/monologueService.js');

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
  mockGenerateCoreLlmJsonText.mockResolvedValue(
    JSON.stringify({
      title: 'Generated title',
      fullText: '日本語です。',
      segments: [
        {
          sourceText: 'English cue',
          japaneseText: '日本語です。',
          reading: 'にほんごです。',
          beatLabel: 'Opening',
        },
      ],
    })
  );
  mockSynthesizeBatchedTexts.mockResolvedValue([Buffer.from('audio')]);
  mockFindAccessibleLocalStudyMediaPath.mockResolvedValue('/tmp/monologue-segment.mp3');
  writeFileSync('/tmp/monologue-segment.mp3', Buffer.from('segment audio'));
  mockDeletePersistedStudyMediaByStoragePath.mockResolvedValue(undefined);
  mockFfmpeg.mockImplementation(() => {
    let outputPath = '';
    const command = {
      input: vi.fn(() => command),
      inputOptions: vi.fn(() => command),
      audioCodec: vi.fn(() => command),
      audioBitrate: vi.fn(() => command),
      audioFrequency: vi.fn(() => command),
      audioChannels: vi.fn(() => command),
      output: vi.fn((path: string) => {
        outputPath = path;
        return command;
      }),
      on: vi.fn((_event: string, _callback: () => void) => command),
      run: vi.fn(() => {
        writeFileSync(outputPath, Buffer.from('full audio'));
        const endHandler = command.on.mock.calls.find(([event]) => event === 'end')?.[1];
        if (endHandler) endHandler();
      }),
    };
    return command;
  });
  mockPersistStudyMediaBuffer.mockResolvedValue({
    publicUrl: null,
    storagePath: 'study-media/user-1/monologue-generated/audio.mp3',
  });
  mockPrisma.studyMedia.create.mockResolvedValue({
    id: 'media-1',
    storagePath: 'study-media/user-1/monologue-generated/audio.mp3',
    publicUrl: null,
  });
  mockPrisma.studyMedia.deleteMany.mockResolvedValue({ count: 0 });
  mockPrisma.monologueAudioTake.deleteMany.mockResolvedValue({ count: 0 });
  mockPrisma.monologueAudioTake.findMany.mockResolvedValue([]);
  mockPrisma.monologueAudioTake.update.mockResolvedValue({});
  mockPrisma.monologueAudioTake.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.monologueProject.create.mockResolvedValue({
    id: 'project-1',
    userId: 'user-1',
    title: 'Generated title',
    sourceText: 'English source',
    targetLanguage: 'ja',
    nativeLanguage: 'en',
    status: 'draft',
    activeVersionId: null,
    createdAt: now,
    updatedAt: now,
  });
  mockPrisma.monologueProject.findFirst.mockResolvedValue(projectRecord());
  mockPrisma.monologueProject.update.mockResolvedValue({});
  mockPrisma.monologueProject.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.monologueScriptVersion.create.mockResolvedValue({
    id: 'version-1',
    versionNumber: 1,
  });
  mockPrisma.monologueScriptVersion.update.mockResolvedValue({});
  mockPrisma.monologueSegment.createMany.mockResolvedValue({ count: 1 });
  mockPrisma.$transaction.mockImplementation(async (input) =>
    Array.isArray(input) ? Promise.all(input) : input(mockPrisma)
  );
});

describe('monologueService', () => {
  it('creates a project from strict LLM JSON', async () => {
    await createMonologueProject('user-1', {
      sourceText: 'English source',
      title: null,
    });

    expect(mockGenerateCoreLlmJsonText).toHaveBeenCalled();
    expect(mockPrisma.monologueProject.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceText: 'English source',
        status: 'draft',
        title: 'Generated title',
      }),
    });
    expect(mockPrisma.monologueScriptVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fullText: '日本語です。',
        projectId: 'project-1',
        versionNumber: 1,
      }),
    });
    expect(mockPrisma.monologueSegment.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          sourceText: 'English cue',
          japaneseText: '日本語です。',
          ordinal: 0,
        }),
      ],
    });
  });

  it('does not persist a monologue project when initial LLM generation fails', async () => {
    mockGenerateCoreLlmJsonText.mockRejectedValueOnce(new Error('llm unavailable'));

    await expect(
      createMonologueProject('user-1', {
        sourceText: 'English source',
      })
    ).rejects.toThrow('llm unavailable');

    expect(mockPrisma.monologueProject.create).not.toHaveBeenCalled();
    expect(mockPrisma.monologueScriptVersion.create).not.toHaveBeenCalled();
    expect(mockPrisma.monologueSegment.createMany).not.toHaveBeenCalled();
  });

  it('rejects oversized source text before calling the LLM', async () => {
    await expect(
      createMonologueProject('user-1', {
        sourceText: 'a'.repeat(12_001),
      })
    ).rejects.toMatchObject({
      message: 'sourceText can have at most 12000 characters.',
      statusCode: 400,
    });

    expect(mockGenerateCoreLlmJsonText).not.toHaveBeenCalled();
    expect(mockPrisma.monologueProject.create).not.toHaveBeenCalled();
  });

  it('returns an app error when the LLM returns malformed monologue JSON', async () => {
    mockGenerateCoreLlmJsonText.mockResolvedValue('not json');

    await expect(
      createMonologueProject('user-1', {
        sourceText: 'English source',
      })
    ).rejects.toMatchObject({
      message: 'Monologue generator returned malformed JSON.',
      statusCode: 502,
    });

    expect(mockPrisma.monologueProject.create).not.toHaveBeenCalled();
    expect(mockPrisma.monologueScriptVersion.create).not.toHaveBeenCalled();
    expect(mockPrisma.monologueSegment.createMany).not.toHaveBeenCalled();
    expect(mockGenerateCoreLlmJsonText).toHaveBeenCalledTimes(2);
  });

  it('retries once when the LLM returns malformed JSON before a usable monologue', async () => {
    mockGenerateCoreLlmJsonText.mockResolvedValueOnce('not json').mockResolvedValueOnce(
      JSON.stringify({
        title: 'Recovered title',
        fullText: 'もう一度試します。',
        segments: [
          {
            sourceText: 'Try again',
            japaneseText: 'もう一度試します。',
            reading: 'もういちどためします。',
          },
        ],
      })
    );

    await createMonologueProject('user-1', {
      sourceText: 'English source',
    });

    expect(mockGenerateCoreLlmJsonText).toHaveBeenCalledTimes(2);
    expect(mockPrisma.monologueProject.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: 'Recovered title',
      }),
    });
    expect(mockPrisma.monologueScriptVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fullText: 'もう一度試します。',
      }),
    });
  });

  it('returns an app error when generated monologue JSON is not an object', async () => {
    mockGenerateCoreLlmJsonText.mockResolvedValue('[]');

    await expect(
      createMonologueProject('user-1', {
        sourceText: 'English source',
      })
    ).rejects.toMatchObject({
      message: 'Monologue generator returned invalid JSON.',
      statusCode: 502,
    });

    expect(mockPrisma.monologueProject.create).not.toHaveBeenCalled();
    expect(mockPrisma.monologueScriptVersion.create).not.toHaveBeenCalled();
    expect(mockPrisma.monologueSegment.createMany).not.toHaveBeenCalled();
    expect(mockGenerateCoreLlmJsonText).toHaveBeenCalledTimes(2);
  });

  it('returns an app error when generated monologue JSON has no usable script', async () => {
    mockGenerateCoreLlmJsonText.mockResolvedValue(
      JSON.stringify({
        title: 'Generated title',
        fullText: '',
        segments: [],
      })
    );

    await expect(
      createMonologueProject('user-1', {
        sourceText: 'English source',
      })
    ).rejects.toMatchObject({
      message: 'Monologue generator returned no usable script.',
      statusCode: 502,
    });

    expect(mockPrisma.monologueProject.create).not.toHaveBeenCalled();
    expect(mockPrisma.monologueScriptVersion.create).not.toHaveBeenCalled();
    expect(mockPrisma.monologueSegment.createMany).not.toHaveBeenCalled();
    expect(mockGenerateCoreLlmJsonText).toHaveBeenCalledTimes(2);
  });

  it('rejects overlong generated segment text instead of truncating it', async () => {
    mockGenerateCoreLlmJsonText.mockResolvedValue(
      JSON.stringify({
        title: 'Generated title',
        fullText: '日本語です。',
        segments: [
          {
            sourceText: 'English cue',
            japaneseText: 'あ'.repeat(1001),
            reading: 'にほんごです。',
          },
        ],
      })
    );

    await expect(
      createMonologueProject('user-1', {
        sourceText: 'English source',
      })
    ).rejects.toMatchObject({
      message: 'Generated monologue segment japaneseText can have at most 1000 characters.',
      statusCode: 502,
    });

    expect(mockPrisma.monologueProject.create).not.toHaveBeenCalled();
    expect(mockGenerateCoreLlmJsonText).toHaveBeenCalledTimes(2);
  });

  it('lists active-version segment counts instead of all historical segments', async () => {
    mockPrisma.monologueProject.findMany.mockResolvedValue([
      {
        id: 'project-1',
        title: 'Tokyo story',
        sourceText: 'English source',
        status: 'draft',
        activeVersionId: 'version-2',
        createdAt: now,
        updatedAt: now,
        activeVersion: { _count: { segments: 6 } },
      },
    ]);

    const projects = await listMonologueProjects('user-1');

    expect(mockPrisma.monologueProject.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          activeVersion: {
            select: { _count: { select: { segments: true } } },
          },
        }),
      })
    );
    expect(mockPrisma.monologueProject.findMany.mock.calls[0]?.[0].select).not.toHaveProperty(
      'sourceText'
    );
    expect(projects[0]?.segmentCount).toBe(6);
    expect(projects[0]).not.toHaveProperty('sourceText');
  });

  it('hides full audio takes from inactive script versions', async () => {
    mockPrisma.monologueProject.findFirst.mockResolvedValueOnce({
      ...projectRecord(),
      activeVersionId: 'version-2',
      activeVersion: {
        ...projectRecord().activeVersion,
        id: 'version-2',
      },
      audioTakes: [
        {
          id: 'full-current',
          userId: 'user-1',
          projectId: 'project-1',
          scriptVersionId: 'version-2',
          segmentId: null,
          mediaId: 'media-current',
          displayName: 'Current full render',
          source: 'tts',
          provider: 'mixed',
          voiceId: null,
          speed: 1,
          scope: 'full',
          isDefault: true,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: 'full-old',
          userId: 'user-1',
          projectId: 'project-1',
          scriptVersionId: 'version-1',
          segmentId: null,
          mediaId: 'media-old',
          displayName: 'Old full render',
          source: 'tts',
          provider: 'mixed',
          voiceId: null,
          speed: 1,
          scope: 'full',
          isDefault: true,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    const project = await getMonologueProject('user-1', 'project-1');

    expect(project.fullAudioTakes.map((take) => take.id)).toEqual(['full-current']);
  });

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
      project: { activeVersionId: 'version-1' },
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

  it('rejects sentence audio generation for non-active script versions', async () => {
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
      project: { activeVersionId: 'version-2' },
      scriptVersion: { id: 'version-1', status: 'approved' },
    });

    await expect(
      generateMonologueSegmentAudioTake('user-1', 'project-1', 'segment-1', {
        voiceId: 'ja-JP-Neural2-D',
        speed: 0.85,
      })
    ).rejects.toThrow('Generate audio for the active monologue script version.');
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
      project: { activeVersionId: 'version-1' },
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
          displayName: 'Fish Ren 1x',
          isDefault: false,
          speed: 1,
        }),
      })
    );
    expect(mockPrisma.monologueAudioTake.updateMany).not.toHaveBeenCalled();
  });

  it('returns an app error when monologue TTS returns no audio', async () => {
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
      project: { activeVersionId: 'version-1' },
      scriptVersion: { id: 'version-1', status: 'approved' },
    });
    mockSynthesizeBatchedTexts.mockResolvedValueOnce([]);

    await expect(
      generateMonologueSegmentAudioTake('user-1', 'project-1', 'segment-1', {
        voiceId: 'ja-JP-Neural2-D',
        speed: 0.85,
      })
    ).rejects.toMatchObject({
      message: 'Monologue TTS returned no audio.',
      statusCode: 502,
    });

    expect(mockPersistStudyMediaBuffer).not.toHaveBeenCalled();
    expect(mockPrisma.monologueAudioTake.create).not.toHaveBeenCalled();
  });

  it('sets a generated sentence take as default only when explicitly requested', async () => {
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
      project: { activeVersionId: 'version-1' },
      scriptVersion: { id: 'version-1', status: 'approved' },
    });

    await generateMonologueSegmentAudioTake('user-1', 'project-1', 'segment-1', {
      voiceId: 'ja-JP-Neural2-D',
      speed: 0.85,
      isDefault: true,
    });

    expect(mockPrisma.monologueAudioTake.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        segmentId: 'segment-1',
        scriptVersionId: 'version-1',
        scope: 'sentence',
      },
      data: { isDefault: false },
    });
    expect(mockPrisma.monologueAudioTake.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          displayName: 'Google Daichi 0.85x',
          isDefault: true,
        }),
      })
    );
  });

  it('rejects oversized audio take display names before synthesizing audio', async () => {
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
      project: { activeVersionId: 'version-1' },
      scriptVersion: { id: 'version-1', status: 'approved' },
    });

    await expect(
      generateMonologueSegmentAudioTake('user-1', 'project-1', 'segment-1', {
        voiceId: 'ja-JP-Neural2-D',
        speed: 0.85,
        displayName: 'a'.repeat(121),
      })
    ).rejects.toMatchObject({
      message: 'displayName can have at most 120 characters.',
      statusCode: 400,
    });

    expect(mockSynthesizeBatchedTexts).not.toHaveBeenCalled();
    expect(mockPersistStudyMediaBuffer).not.toHaveBeenCalled();
  });

  it('cleans up persisted media when sentence take creation fails', async () => {
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
      project: { activeVersionId: 'version-1' },
      scriptVersion: { id: 'version-1', status: 'approved' },
    });
    mockPrisma.$transaction.mockRejectedValueOnce(new Error('db write failed'));
    mockPrisma.studyMedia.deleteMany.mockResolvedValueOnce({ count: 1 });

    await expect(
      generateMonologueSegmentAudioTake('user-1', 'project-1', 'segment-1', {
        voiceId: 'ja-JP-Neural2-D',
        speed: 0.85,
      })
    ).rejects.toThrow('db write failed');

    expect(mockPrisma.studyMedia.deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'media-1',
        monologueTakes: { none: {} },
      },
    });
  });

  it('regenerates a default take in place and invalidates stale full renders', async () => {
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
      project: { activeVersionId: 'version-1' },
      scriptVersion: { id: 'version-1', status: 'approved' },
      media: {
        id: 'old-media',
        storagePath: 'study-media/user-1/monologue-generated/old.mp3',
      },
    });
    mockPrisma.monologueAudioTake.findMany.mockResolvedValueOnce([
      {
        id: 'full-take-1',
        media: {
          id: 'full-media',
          storagePath: 'study-media/user-1/monologue-generated/full.mp3',
        },
      },
    ]);
    mockPrisma.studyMedia.deleteMany.mockResolvedValue({ count: 1 });

    await regenerateMonologueAudioTake('user-1', 'project-1', 'take-1');

    expect(mockPrisma.monologueAudioTake.update).toHaveBeenCalledWith({
      where: { id: 'take-1' },
      data: {
        mediaId: 'media-1',
        provider: 'google',
        speed: 0.85,
      },
    });
    expect(mockPrisma.studyMedia.deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'old-media',
        monologueTakes: { none: {} },
      },
    });
    expect(mockPrisma.monologueAudioTake.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        projectId: 'project-1',
        scriptVersionId: 'version-1',
        scope: 'full',
      },
    });
    expect(mockPrisma.monologueProject.update).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: { status: 'approved' },
    });
    expect(mockPrisma.studyMedia.deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'full-media',
        monologueTakes: { none: {} },
      },
    });
    expect(mockDeletePersistedStudyMediaByStoragePath).toHaveBeenCalledWith(
      'study-media/user-1/monologue-generated/full.mp3'
    );
  });

  it('keeps regenerate results when stale object storage deletion fails after DB cleanup', async () => {
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
      isDefault: false,
      createdAt: now,
      updatedAt: now,
      segment: {
        id: 'segment-1',
        japaneseText: '日本語です。',
        reading: 'にほんごです。',
      },
      project: { activeVersionId: 'version-1' },
      scriptVersion: { id: 'version-1', status: 'approved' },
      media: {
        id: 'old-media',
        storagePath: 'study-media/user-1/monologue-generated/old.mp3',
      },
    });
    mockPrisma.studyMedia.deleteMany.mockResolvedValue({ count: 1 });
    mockDeletePersistedStudyMediaByStoragePath.mockRejectedValueOnce(new Error('gcs failed'));

    await expect(regenerateMonologueAudioTake('user-1', 'project-1', 'take-1')).resolves.toEqual(
      expect.objectContaining({ id: 'project-1' })
    );

    expect(mockPrisma.monologueAudioTake.update).toHaveBeenCalledWith({
      where: { id: 'take-1' },
      data: {
        mediaId: 'media-1',
        provider: 'google',
        speed: 0.85,
      },
    });
    expect(mockDeletePersistedStudyMediaByStoragePath).toHaveBeenCalledWith(
      'study-media/user-1/monologue-generated/old.mp3'
    );
  });

  it('rejects regenerating audio for a superseded script version', async () => {
    mockPrisma.monologueAudioTake.findFirst.mockResolvedValue({
      id: 'take-1',
      userId: 'user-1',
      projectId: 'project-1',
      scriptVersionId: 'version-1',
      segmentId: 'segment-1',
      mediaId: 'old-media',
      displayName: 'Old version take',
      source: 'tts',
      provider: 'google',
      voiceId: 'ja-JP-Neural2-D',
      speed: 0.85,
      scope: 'sentence',
      isDefault: false,
      createdAt: now,
      updatedAt: now,
      segment: {
        id: 'segment-1',
        japaneseText: '古い文です。',
        reading: 'ふるいぶんです。',
      },
      project: { activeVersionId: 'version-2' },
      scriptVersion: { id: 'version-1', status: 'approved' },
      media: {
        id: 'old-media',
        storagePath: 'study-media/user-1/monologue-generated/old.mp3',
      },
    });

    await expect(regenerateMonologueAudioTake('user-1', 'project-1', 'take-1')).rejects.toThrow(
      'Regenerate audio for the active monologue script version.'
    );
    expect(mockSynthesizeBatchedTexts).not.toHaveBeenCalled();
  });

  it('creates a new draft version when editing an approved monologue', async () => {
    const approvedProject = projectRecord();
    const draftProject = {
      ...projectRecord(),
      status: 'draft',
      activeVersionId: 'version-2',
      activeVersion: {
        ...projectRecord().activeVersion,
        id: 'version-2',
        versionNumber: 2,
        status: 'draft',
        fullText: '新しい日本語です。',
      },
    };
    mockPrisma.monologueProject.findFirst
      .mockResolvedValueOnce(approvedProject)
      .mockResolvedValueOnce(draftProject);
    mockPrisma.monologueScriptVersion.aggregate.mockResolvedValue({
      _max: { versionNumber: 1 },
    });
    mockPrisma.monologueScriptVersion.create.mockResolvedValue({
      id: 'version-2',
      versionNumber: 2,
    });

    const result = await updateMonologueDraft('user-1', 'project-1', {
      title: 'Tokyo return',
      fullText: '新しい日本語です。',
      segments: [
        {
          sourceText: 'New English cue',
          japaneseText: '新しい日本語です。',
          reading: 'あたらしいにほんごです。',
          beatLabel: 'Opening',
        },
      ],
    });

    expect(mockPrisma.monologueScriptVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: 'project-1',
        status: 'draft',
        versionNumber: 2,
      }),
    });
    expect(mockPrisma.monologueProject.update).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: {
        activeVersionId: 'version-2',
        status: 'draft',
        title: 'Tokyo return',
      },
    });
    expect(mockPrisma.monologueSegment.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          scriptVersionId: 'version-2',
          ordinal: 0,
          sourceText: 'New English cue',
          japaneseText: '新しい日本語です。',
        }),
      ],
    });
    expect(result.status).toBe('draft');
    expect(result.activeVersion?.versionNumber).toBe(2);
  });

  it('allows a draft title to be cleared explicitly', async () => {
    const draftProject = {
      ...projectRecord(),
      status: 'draft',
      title: 'Tokyo story',
      activeVersion: {
        ...projectRecord().activeVersion,
        status: 'draft',
      },
    };
    mockPrisma.monologueProject.findFirst
      .mockResolvedValueOnce(draftProject)
      .mockResolvedValueOnce({ ...draftProject, title: '' });

    await updateMonologueDraft('user-1', 'project-1', {
      title: '',
      fullText: '日本語です。',
      segments: [
        {
          sourceText: 'English cue',
          japaneseText: '日本語です。',
          reading: 'にほんごです。',
          beatLabel: null,
        },
      ],
    });

    expect(mockPrisma.monologueProject.update).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: {
        status: 'draft',
        title: '',
      },
    });
  });

  it('rejects oversized monologue segment edits before writing', async () => {
    await expect(
      updateMonologueDraft('user-1', 'project-1', {
        fullText: '日本語です。',
        segments: [
          {
            id: 'segment-1',
            sourceText: 'English cue',
            japaneseText: 'あ'.repeat(1001),
            reading: null,
            beatLabel: null,
          },
        ],
      })
    ).rejects.toThrow('Monologue segment text can have at most 1000 characters.');
    expect(mockPrisma.monologueScriptVersion.create).not.toHaveBeenCalled();
    expect(mockPrisma.monologueSegment.createMany).not.toHaveBeenCalled();
  });

  it('rejects oversized fullText edits before writing', async () => {
    await expect(
      updateMonologueDraft('user-1', 'project-1', {
        fullText: 'あ'.repeat(12_001),
        segments: [
          {
            sourceText: 'English cue',
            japaneseText: '日本語です。',
            reading: null,
            beatLabel: null,
          },
        ],
      })
    ).rejects.toThrow('fullText can have at most 12000 characters.');
    expect(mockPrisma.monologueScriptVersion.update).not.toHaveBeenCalled();
    expect(mockPrisma.monologueSegment.createMany).not.toHaveBeenCalled();
  });

  it('returns 409 when approved draft version retries are exhausted', async () => {
    const duplicateVersionError = new Prisma.PrismaClientKnownRequestError('duplicate version', {
      code: 'P2002',
      clientVersion: 'test',
    });
    mockPrisma.$transaction.mockRejectedValue(duplicateVersionError);

    await expect(
      updateMonologueDraft('user-1', 'project-1', {
        fullText: '新しい日本語です。',
        segments: [
          {
            sourceText: 'New English cue',
            japaneseText: '新しい日本語です。',
            reading: 'あたらしいにほんごです。',
            beatLabel: null,
          },
        ],
      })
    ).rejects.toMatchObject({
      message: 'Another monologue draft edit was saved at the same time. Try again.',
      statusCode: 409,
    });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(3);
  });

  it('cleans up orphaned media when replacing draft segments', async () => {
    const draftProject = {
      ...projectRecord(),
      status: 'draft',
      activeVersion: {
        ...projectRecord().activeVersion,
        status: 'draft',
      },
    };
    mockPrisma.monologueProject.findFirst
      .mockResolvedValueOnce(draftProject)
      .mockResolvedValueOnce(draftProject);
    mockPrisma.monologueAudioTake.findMany.mockResolvedValueOnce([
      {
        id: 'take-1',
        media: {
          id: 'old-draft-media',
          storagePath: 'study-media/user-1/monologue-generated/draft.mp3',
        },
      },
    ]);
    mockPrisma.studyMedia.deleteMany.mockResolvedValueOnce({ count: 1 });

    await updateMonologueDraft('user-1', 'project-1', {
      fullText: '日本語です。',
      segments: [
        {
          sourceText: 'English cue',
          japaneseText: '日本語です。',
          reading: 'にほんごです。',
          beatLabel: null,
        },
      ],
    });

    expect(mockPrisma.monologueAudioTake.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', projectId: 'project-1', scriptVersionId: 'version-1' },
      include: { media: true },
    });
    expect(mockPrisma.studyMedia.deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'old-draft-media',
        monologueTakes: { none: {} },
      },
    });
  });

  it('approves the active script version', async () => {
    mockPrisma.monologueProject.findFirst.mockResolvedValue({
      ...projectRecord(),
      status: 'draft',
      activeVersion: {
        ...projectRecord().activeVersion,
        status: 'draft',
        approvedAt: null,
      },
    });

    await approveMonologueScript('user-1', 'project-1');

    expect(mockPrisma.monologueScriptVersion.update).toHaveBeenCalledWith({
      where: { id: 'version-1' },
      data: { status: 'approved', approvedAt: expect.any(Date) },
    });
    expect(mockPrisma.monologueProject.update).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: { status: 'approved' },
    });
  });

  it('leaves an already-approved script unchanged when approving again', async () => {
    await approveMonologueScript('user-1', 'project-1');

    expect(mockPrisma.monologueScriptVersion.update).not.toHaveBeenCalled();
    expect(mockPrisma.monologueProject.update).not.toHaveBeenCalled();
  });

  it('sets a sentence audio take as default within its segment', async () => {
    mockPrisma.monologueAudioTake.findFirst.mockResolvedValue({
      id: 'take-1',
      userId: 'user-1',
      projectId: 'project-1',
      scriptVersionId: 'version-1',
      segmentId: 'segment-1',
      mediaId: 'media-1',
      scope: 'sentence',
    });

    await setMonologueDefaultAudioTake('user-1', 'project-1', 'take-1');

    expect(mockPrisma.monologueAudioTake.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        projectId: 'project-1',
        scriptVersionId: 'version-1',
        scope: 'sentence',
        segmentId: 'segment-1',
      },
      data: { isDefault: false },
    });
    expect(mockPrisma.monologueAudioTake.update).toHaveBeenCalledWith({
      where: { id: 'take-1' },
      data: { isDefault: true },
    });
  });

  it('prepares a full-audio render by marking the project as rendering', async () => {
    mockPrisma.monologueProject.findFirst
      .mockResolvedValueOnce({
        ...projectRecord(),
        activeVersion: {
          ...projectRecord().activeVersion,
          segments: [
            {
              ...projectRecord().activeVersion.segments[0],
              audioTakes: [{ id: 'sentence-take-1' }],
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        ...projectRecord(),
        status: 'rendering',
      });

    const project = await prepareMonologueFullAudioRender('user-1', 'project-1');

    expect(mockPrisma.monologueProject.update).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: { status: 'rendering' },
    });
    expect(project.status).toBe('rendering');
  });

  it('rejects preparing a full-audio render until every sentence has a default take', async () => {
    mockPrisma.monologueProject.findFirst.mockResolvedValueOnce({
      ...projectRecord(),
      activeVersion: {
        ...projectRecord().activeVersion,
        segments: [
          {
            ...projectRecord().activeVersion.segments[0],
            audioTakes: [],
          },
        ],
      },
    });

    await expect(prepareMonologueFullAudioRender('user-1', 'project-1')).rejects.toThrow(
      'Every sentence needs a default audio take before full render.'
    );
    expect(mockPrisma.monologueProject.update).not.toHaveBeenCalled();
  });

  it('marks a failed full-audio render back to approved for the queued version only', async () => {
    await markMonologueFullAudioRenderFailed('user-1', 'project-1', 'version-1');

    expect(mockPrisma.monologueProject.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'project-1',
        userId: 'user-1',
        activeVersionId: 'version-1',
        status: 'rendering',
      },
      data: { status: 'approved' },
    });
  });

  it('renders full audio and prunes stale full takes', async () => {
    const fullProject = {
      ...projectRecord(),
      activeVersion: {
        ...projectRecord().activeVersion,
        segments: [
          {
            ...projectRecord().activeVersion.segments[0],
            audioTakes: [
              {
                id: 'sentence-take-1',
                userId: 'user-1',
                projectId: 'project-1',
                scriptVersionId: 'version-1',
                segmentId: 'segment-1',
                mediaId: 'sentence-media-1',
                displayName: 'Sentence take',
                source: 'tts',
                provider: 'google',
                voiceId: 'ja-JP-Neural2-D',
                speed: 0.85,
                scope: 'sentence',
                isDefault: true,
                createdAt: now,
                updatedAt: now,
                media: {
                  id: 'sentence-media-1',
                  storagePath: 'study-media/user-1/monologue-generated/segment.mp3',
                },
              },
            ],
          },
        ],
      },
    };
    mockPrisma.monologueProject.findFirst.mockResolvedValueOnce(fullProject).mockResolvedValueOnce({
      ...fullProject,
      status: 'ready',
      audioTakes: [
        {
          id: 'full-take-2',
          userId: 'user-1',
          projectId: 'project-1',
          scriptVersionId: 'version-1',
          segmentId: null,
          mediaId: 'media-1',
          displayName: 'Tokyo story',
          source: 'tts',
          provider: 'mixed',
          voiceId: null,
          speed: 1,
          scope: 'full',
          isDefault: true,
          createdAt: now,
          updatedAt: now,
          media: {
            id: 'media-1',
            storagePath: 'study-media/user-1/monologue-generated/full.mp3',
          },
        },
      ],
    });
    mockPrisma.monologueAudioTake.findMany.mockResolvedValueOnce([
      {
        id: 'old-full-take',
        media: {
          id: 'old-full-media',
          storagePath: 'study-media/user-1/monologue-generated/old-full.mp3',
        },
      },
    ]);
    mockPrisma.studyMedia.deleteMany.mockResolvedValueOnce({ count: 1 });

    await generateMonologueFullAudioTake('user-1', 'project-1');

    expect(mockFfmpeg).toHaveBeenCalled();
    expect(mockPrisma.monologueAudioTake.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        projectId: 'project-1',
        scriptVersionId: 'version-1',
        scope: 'full',
      },
    });
    expect(mockPrisma.monologueAudioTake.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        mediaId: 'media-1',
        scope: 'full',
        isDefault: true,
      }),
    });
    expect(mockPrisma.studyMedia.deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'old-full-media',
        monologueTakes: { none: {} },
      },
    });
    expect(mockDeletePersistedStudyMediaByStoragePath).toHaveBeenCalledWith(
      'study-media/user-1/monologue-generated/old-full.mp3'
    );
  });

  it('rejects stale full-audio render jobs for superseded script versions', async () => {
    mockPrisma.monologueProject.findFirst.mockResolvedValueOnce(projectRecord());

    await expect(
      generateMonologueFullAudioTake('user-1', 'project-1', {
        expectedScriptVersionId: 'version-2',
      })
    ).rejects.toMatchObject({
      message: 'Monologue full-audio render job is stale.',
      statusCode: 409,
    });
    expect(mockFfmpeg).not.toHaveBeenCalled();
    expect(mockPersistStudyMediaBuffer).not.toHaveBeenCalled();
  });

  it('returns a clear service error when ffmpeg is unavailable', async () => {
    const fullProject = {
      ...projectRecord(),
      activeVersion: {
        ...projectRecord().activeVersion,
        segments: [
          {
            ...projectRecord().activeVersion.segments[0],
            audioTakes: [
              {
                id: 'sentence-take-1',
                userId: 'user-1',
                projectId: 'project-1',
                scriptVersionId: 'version-1',
                segmentId: 'segment-1',
                mediaId: 'sentence-media-1',
                displayName: 'Sentence take',
                source: 'tts',
                provider: 'google',
                voiceId: 'ja-JP-Neural2-D',
                speed: 0.85,
                scope: 'sentence',
                isDefault: true,
                createdAt: now,
                updatedAt: now,
                media: {
                  id: 'sentence-media-1',
                  storagePath: 'study-media/user-1/monologue-generated/segment.mp3',
                },
              },
            ],
          },
        ],
      },
    };
    mockPrisma.monologueProject.findFirst.mockResolvedValueOnce(fullProject);
    mockFfmpeg.mockImplementationOnce(() => {
      const command = {
        input: vi.fn(() => command),
        inputOptions: vi.fn(() => command),
        audioCodec: vi.fn(() => command),
        audioBitrate: vi.fn(() => command),
        audioFrequency: vi.fn(() => command),
        audioChannels: vi.fn(() => command),
        output: vi.fn(() => command),
        on: vi.fn((_event: string, _callback: (error?: Error) => void) => command),
        run: vi.fn(() => {
          const errorHandler = command.on.mock.calls.find(([event]) => event === 'error')?.[1];
          const error = new Error('Cannot find ffmpeg');
          (error as NodeJS.ErrnoException).code = 'ENOENT';
          if (errorHandler) errorHandler(error);
        }),
      };
      return command;
    });

    await expect(generateMonologueFullAudioTake('user-1', 'project-1')).rejects.toMatchObject({
      message: 'Audio concatenation is unavailable: ffmpeg not found.',
      statusCode: 503,
    });
  });

  it('requires every sentence to have a default take before rendering full audio', async () => {
    await expect(generateMonologueFullAudioTake('user-1', 'project-1')).rejects.toThrow(
      'Every sentence needs a default audio take before full render.'
    );
  });
});
