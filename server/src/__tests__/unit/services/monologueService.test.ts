import { writeFileSync } from 'node:fs';

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
  listMonologueProjects,
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
        include: {
          activeVersion: {
            select: { _count: { select: { segments: true } } },
          },
        },
      })
    );
    expect(projects[0]?.segmentCount).toBe(6);
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
      media: {
        id: 'old-media',
        storagePath: 'study-media/user-1/monologue-generated/old.mp3',
      },
    });
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
          ordinal: 0,
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
          ordinal: 0,
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
          ordinal: 0,
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
          displayName: 'Full monologue render',
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

  it('requires every sentence to have a default take before rendering full audio', async () => {
    await expect(generateMonologueFullAudioTake('user-1', 'project-1')).rejects.toThrow(
      'Every sentence needs a default audio take before full render.'
    );
  });
});
