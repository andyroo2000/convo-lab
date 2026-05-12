import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSynthesizeBatchedTexts = vi.hoisted(() => vi.fn());
const mockPersistStudyMediaBuffer = vi.hoisted(() => vi.fn());
const mockGenerateCoreLlmJsonText = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  monologueAudioTake: {
    create: vi.fn(),
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

vi.mock('fluent-ffmpeg', () => ({
  default: vi.fn(),
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

  it('approves the active script version', async () => {
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

  it('requires every sentence to have a default take before rendering full audio', async () => {
    await expect(generateMonologueFullAudioTake('user-1', 'project-1')).rejects.toThrow(
      'Every sentence needs a default audio take before full render.'
    );
  });
});
