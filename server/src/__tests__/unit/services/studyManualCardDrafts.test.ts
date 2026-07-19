import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mockPrisma } from '../../setup.js';

const completeManualStudyCardDraftMock = vi.hoisted(() => vi.fn());
const createManualStudyCardMock = vi.hoisted(() => vi.fn());

vi.mock('../../../services/study/manualCardDraft.js', () => ({
  completeManualStudyCardDraft: completeManualStudyCardDraftMock,
  createManualStudyCard: createManualStudyCardMock,
}));

const now = new Date('2026-05-08T12:00:00.000Z');

function draftRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'draft-1',
    userId: 'user-1',
    status: 'generating',
    creationKind: 'text-recognition',
    cardType: 'recognition',
    promptJson: { cueText: '会社' },
    answerJson: { expression: '', meaning: '' },
    imagePlacement: 'none',
    imagePrompt: null,
    previewAudioJson: null,
    previewAudioRole: null,
    previewImageJson: null,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('manual card draft persistence service', () => {
  beforeEach(() => {
    completeManualStudyCardDraftMock.mockReset();
    createManualStudyCardMock.mockReset();
    mockPrisma.studyCardDraft.findMany.mockReset();
    mockPrisma.studyCardDraft.findFirst.mockReset();
    mockPrisma.studyCardDraft.findUnique.mockReset();
    mockPrisma.studyCardDraft.create.mockReset();
    mockPrisma.studyCardDraft.update.mockReset();
    mockPrisma.studyCardDraft.updateMany.mockReset();
    mockPrisma.studyCardDraft.delete.mockReset();
    mockPrisma.studyCardDraft.deleteMany.mockReset();
    mockPrisma.studyCardDraft.count.mockReset();
    mockPrisma.studyCardDraft.count.mockResolvedValue(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates generating drafts from manual form payloads', async () => {
    mockPrisma.studyCardDraft.create.mockResolvedValue(draftRecord());
    const { createManualCardDraft } = await import('../../../services/study/manualCardDrafts.js');

    const result = await createManualCardDraft({
      userId: 'user-1',
      request: {
        creationKind: 'text-recognition',
        cardType: 'recognition',
        prompt: { cueText: '会社' },
        answer: { meaning: '' },
        imagePlacement: 'none',
        imagePrompt: '  ',
      },
    });

    expect(result.status).toBe('generating');
    expect(mockPrisma.studyCardDraft.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        status: 'generating',
        creationKind: 'text-recognition',
        cardType: 'recognition',
        imagePlacement: 'none',
        imagePrompt: null,
      }),
    });
  });

  it('lists drafts oldest first by creation time', async () => {
    mockPrisma.studyCardDraft.count.mockResolvedValue(2);
    mockPrisma.studyCardDraft.findMany.mockResolvedValue([
      draftRecord({ id: 'draft-1', createdAt: new Date('2026-05-08T10:00:00.000Z') }),
      draftRecord({ id: 'draft-2', createdAt: new Date('2026-05-08T11:00:00.000Z') }),
    ]);
    const { listManualCardDrafts } = await import('../../../services/study/manualCardDrafts.js');

    const result = await listManualCardDrafts({ userId: 'user-1' });

    expect(result.drafts.map((draft) => draft.id)).toEqual(['draft-1', 'draft-2']);
    expect(result.total).toBe(2);
    expect(mockPrisma.studyCardDraft.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 201,
    });
  });

  it('uses an opaque cursor for draft pagination', async () => {
    const cursorRecord = draftRecord({
      id: 'draft_with_underscores',
      createdAt: new Date('2026-05-08T10:00:00.000Z'),
    });
    mockPrisma.studyCardDraft.findMany.mockResolvedValueOnce([
      cursorRecord,
      draftRecord({ id: 'draft-2', createdAt: new Date('2026-05-08T11:00:00.000Z') }),
    ]);
    const { listManualCardDrafts } = await import('../../../services/study/manualCardDrafts.js');

    const firstPage = await listManualCardDrafts({ userId: 'user-1', limit: 1 });

    expect(firstPage.nextCursor).toBeTruthy();
    expect(firstPage.nextCursor).not.toContain('draft_with_underscores');

    mockPrisma.studyCardDraft.findMany.mockResolvedValueOnce([]);
    await listManualCardDrafts({
      userId: 'user-1',
      limit: 1,
      cursor: firstPage.nextCursor,
    });

    expect(mockPrisma.studyCardDraft.findMany).toHaveBeenLastCalledWith({
      where: {
        userId: 'user-1',
        OR: [
          { createdAt: { gt: cursorRecord.createdAt } },
          { createdAt: cursorRecord.createdAt, id: { gt: cursorRecord.id } },
        ],
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 2,
    });
  });

  it('rejects malformed draft cursors', async () => {
    const { listManualCardDrafts } = await import('../../../services/study/manualCardDrafts.js');

    await expect(
      listManualCardDrafts({ userId: 'user-1', cursor: 'not-a-valid-cursor' })
    ).rejects.toThrow('Invalid draft cursor.');
  });

  it('rejects new drafts when the user draft queue is full', async () => {
    mockPrisma.studyCardDraft.count.mockResolvedValue(2000);
    const { createManualCardDraft } = await import('../../../services/study/manualCardDrafts.js');

    await expect(
      createManualCardDraft({
        userId: 'user-1',
        request: {
          creationKind: 'text-recognition',
          cardType: 'recognition',
          prompt: { cueText: '会社' },
          answer: {},
          imagePlacement: 'none',
          imagePrompt: null,
        },
      })
    ).rejects.toThrow('Draft queue is full.');

    expect(mockPrisma.studyCardDraft.create).not.toHaveBeenCalled();
  });

  it('rejects draft creation when the supplied card type does not match the creation kind', async () => {
    const { createManualCardDraft } = await import('../../../services/study/manualCardDrafts.js');

    await expect(
      createManualCardDraft({
        userId: 'user-1',
        request: {
          creationKind: 'cloze',
          cardType: 'recognition',
          prompt: {},
          answer: {},
          imagePlacement: 'both',
          imagePrompt: null,
        },
      })
    ).rejects.toThrow('cardType must match creationKind.');

    expect(mockPrisma.studyCardDraft.create).not.toHaveBeenCalled();
  });

  it('processes generating drafts and persists completed media fields', async () => {
    mockPrisma.studyCardDraft.findUnique.mockResolvedValue(draftRecord());
    mockPrisma.studyCardDraft.update.mockResolvedValue(
      draftRecord({
        status: 'ready',
        answerJson: { expression: '会社', meaning: 'company' },
        previewAudioJson: {
          id: 'audio-1',
          filename: 'audio.mp3',
          url: '/api/study/media/audio-1',
          mediaKind: 'audio',
          source: 'generated',
        },
        previewAudioRole: 'answer',
      })
    );
    completeManualStudyCardDraftMock.mockResolvedValue({
      creationKind: 'text-recognition',
      cardType: 'recognition',
      prompt: { cueText: '会社', cueReading: '会社[かいしゃ]' },
      answer: { expression: '会社', meaning: 'company' },
      imagePlacement: 'none',
      imagePrompt: null,
      previewAudio: {
        id: 'audio-1',
        filename: 'audio.mp3',
        url: '/api/study/media/audio-1',
        mediaKind: 'audio',
        source: 'generated',
      },
      previewAudioRole: 'answer',
      previewImage: null,
    });
    const { processManualCardDraft } = await import('../../../services/study/manualCardDrafts.js');

    const result = await processManualCardDraft('draft-1');

    expect(result?.status).toBe('ready');
    expect(completeManualStudyCardDraftMock).toHaveBeenCalledWith({
      userId: 'user-1',
      request: expect.objectContaining({
        creationKind: 'text-recognition',
        imagePlacement: 'none',
      }),
    });
    expect(mockPrisma.studyCardDraft.update).toHaveBeenCalledWith({
      where: { id: 'draft-1' },
      data: expect.objectContaining({
        status: 'ready',
        previewAudioRole: 'answer',
        errorMessage: null,
      }),
    });
  });

  it('keeps failed drafts recoverable with a readable error message', async () => {
    mockPrisma.studyCardDraft.findUnique.mockResolvedValue(draftRecord());
    mockPrisma.studyCardDraft.update.mockResolvedValue(
      draftRecord({ status: 'error', errorMessage: 'Audio failed.' })
    );
    completeManualStudyCardDraftMock.mockRejectedValue(new Error('Audio failed.'));
    const { processManualCardDraft } = await import('../../../services/study/manualCardDrafts.js');

    const result = await processManualCardDraft('draft-1');

    expect(result?.status).toBe('error');
    expect(result?.errorMessage).toBe('Audio failed.');
    expect(mockPrisma.studyCardDraft.update).toHaveBeenCalledWith({
      where: { id: 'draft-1' },
      data: { status: 'error', errorMessage: 'Audio failed.' },
    });
  });

  it('marks drafts failed when queueing cannot start', async () => {
    mockPrisma.studyCardDraft.update.mockResolvedValue(
      draftRecord({ status: 'error', errorMessage: 'Could not queue draft generation.' })
    );
    const { markManualCardDraftError } =
      await import('../../../services/study/manualCardDrafts.js');

    const result = await markManualCardDraftError({
      userId: 'user-1',
      draftId: 'draft-1',
      errorMessage: 'Could not queue draft generation.',
    });

    expect(result.status).toBe('error');
    expect(result.errorMessage).toBe('Could not queue draft generation.');
    expect(mockPrisma.studyCardDraft.update).toHaveBeenCalledWith({
      where: { id: 'draft-1', userId: 'user-1' },
      data: {
        status: 'error',
        errorMessage: 'Could not queue draft generation.',
      },
    });
  });

  it('retries failed drafts', async () => {
    mockPrisma.studyCardDraft.findFirst.mockResolvedValue(
      draftRecord({ status: 'error', errorMessage: 'Audio failed.' })
    );
    mockPrisma.studyCardDraft.update.mockResolvedValue(draftRecord({ status: 'generating' }));
    const { resetManualCardDraftForRetry } =
      await import('../../../services/study/manualCardDrafts.js');

    const result = await resetManualCardDraftForRetry({ userId: 'user-1', draftId: 'draft-1' });

    expect(result.status).toBe('generating');
    expect(mockPrisma.studyCardDraft.update).toHaveBeenCalledWith({
      where: { id: 'draft-1', userId: 'user-1' },
      data: expect.objectContaining({
        status: 'generating',
        errorMessage: null,
        previewAudioRole: null,
      }),
    });
  });

  it('retries stale generating drafts so users can recover stuck jobs', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    mockPrisma.studyCardDraft.findFirst.mockResolvedValue(
      draftRecord({ updatedAt: new Date(now.getTime() - 11 * 60 * 1000) })
    );
    mockPrisma.studyCardDraft.update.mockResolvedValue(draftRecord({ status: 'generating' }));
    const { resetManualCardDraftForRetry } =
      await import('../../../services/study/manualCardDrafts.js');

    const result = await resetManualCardDraftForRetry({ userId: 'user-1', draftId: 'draft-1' });

    expect(result.status).toBe('generating');
    expect(mockPrisma.studyCardDraft.update).toHaveBeenCalledWith({
      where: { id: 'draft-1', userId: 'user-1' },
      data: expect.objectContaining({
        status: 'generating',
        errorMessage: null,
      }),
    });
  });

  it('rejects retrying fresh generating drafts', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    mockPrisma.studyCardDraft.findFirst.mockResolvedValue(
      draftRecord({ updatedAt: new Date(now.getTime() - 60 * 1000) })
    );
    const { resetManualCardDraftForRetry } =
      await import('../../../services/study/manualCardDrafts.js');

    await expect(
      resetManualCardDraftForRetry({ userId: 'user-1', draftId: 'draft-1' })
    ).rejects.toThrow('Only failed or stale generating drafts can be retried.');

    expect(mockPrisma.studyCardDraft.update).not.toHaveBeenCalled();
  });

  it('autosaves ready drafts but rejects generating draft edits', async () => {
    mockPrisma.studyCardDraft.findFirst.mockResolvedValueOnce(
      draftRecord({ status: 'generating' })
    );
    const { updateManualCardDraft } = await import('../../../services/study/manualCardDrafts.js');

    await expect(
      updateManualCardDraft({
        userId: 'user-1',
        draftId: 'draft-1',
        request: { prompt: { cueText: '会社' }, answer: { meaning: 'company' } },
      })
    ).rejects.toThrow('Generating drafts cannot be edited yet.');

    mockPrisma.studyCardDraft.findFirst.mockResolvedValueOnce(
      draftRecord({ status: 'error', errorMessage: 'Old error.' })
    );
    mockPrisma.studyCardDraft.update.mockResolvedValue(
      draftRecord({
        status: 'error',
        errorMessage: 'Old error.',
        answerJson: { expression: '会社', meaning: 'company' },
      })
    );

    const result = await updateManualCardDraft({
      userId: 'user-1',
      draftId: 'draft-1',
      request: { answer: { expression: '会社', meaning: 'company' } },
    });

    expect(result.status).toBe('error');
    expect(mockPrisma.studyCardDraft.update).toHaveBeenCalledWith({
      where: { id: 'draft-1', userId: 'user-1' },
      data: expect.objectContaining({
        answerJson: expect.anything(),
      }),
    });
    expect(mockPrisma.studyCardDraft.update.mock.calls.at(-1)?.[0].data).not.toHaveProperty(
      'status'
    );
    expect(mockPrisma.studyCardDraft.update.mock.calls.at(-1)?.[0].data).not.toHaveProperty(
      'errorMessage'
    );
  });

  it('creates the final card from a saved draft and deletes the draft', async () => {
    mockPrisma.studyCardDraft.findFirst.mockResolvedValue(
      draftRecord({
        status: 'ready',
        creationKind: 'production-image',
        cardType: 'production',
        promptJson: {
          cueText: 'cloudy weather',
          cueImage: {
            id: 'image-1',
            filename: 'image.webp',
            url: '/api/study/media/image-1',
            mediaKind: 'image',
            source: 'generated',
          },
        },
        answerJson: { expression: '曇り', meaning: 'cloudy weather' },
      })
    );
    mockPrisma.studyCardDraft.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.studyCardDraft.deleteMany.mockResolvedValue({ count: 1 });
    createManualStudyCardMock.mockResolvedValue({ id: 'card-1', cardType: 'production' });
    const { createStudyCardFromManualDraft } =
      await import('../../../services/study/manualCardDrafts.js');

    const result = await createStudyCardFromManualDraft({ userId: 'user-1', draftId: 'draft-1' });

    expect(result.card.id).toBe('card-1');
    expect(createManualStudyCardMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        creationKind: 'production-image',
        cardType: 'production',
        prompt: expect.objectContaining({ cueText: null }),
        answer: { expression: '曇り', meaning: 'cloudy weather' },
      })
    );
    expect(mockPrisma.studyCardDraft.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'draft-1',
        userId: 'user-1',
        status: { in: ['ready', 'error'] },
      },
      data: { status: 'generating', errorMessage: null },
    });
    expect(mockPrisma.studyCardDraft.deleteMany).toHaveBeenCalledWith({
      where: { id: 'draft-1', userId: 'user-1' },
    });
  });

  it('marks saved drafts as failed when final card creation fails', async () => {
    mockPrisma.studyCardDraft.findFirst.mockResolvedValue(draftRecord({ status: 'ready' }));
    mockPrisma.studyCardDraft.updateMany.mockResolvedValue({ count: 1 });
    createManualStudyCardMock.mockRejectedValue(new Error('Preview media missing.'));
    const { createStudyCardFromManualDraft } =
      await import('../../../services/study/manualCardDrafts.js');

    await expect(
      createStudyCardFromManualDraft({ userId: 'user-1', draftId: 'draft-1' })
    ).rejects.toThrow('Preview media missing.');

    expect(mockPrisma.studyCardDraft.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'draft-1', userId: 'user-1' },
      data: { status: 'error', errorMessage: 'Preview media missing.' },
    });
  });

  it('deletes drafts atomically by user ownership', async () => {
    mockPrisma.studyCardDraft.deleteMany.mockResolvedValue({ count: 1 });
    const { deleteManualCardDraft } = await import('../../../services/study/manualCardDrafts.js');

    await expect(
      deleteManualCardDraft({ userId: 'user-1', draftId: 'draft-1' })
    ).resolves.toBeUndefined();

    expect(mockPrisma.studyCardDraft.deleteMany).toHaveBeenCalledWith({
      where: { id: 'draft-1', userId: 'user-1' },
    });
  });

  it('returns not found when atomic draft delete finds no owned draft', async () => {
    mockPrisma.studyCardDraft.deleteMany.mockResolvedValue({ count: 0 });
    const { deleteManualCardDraft } = await import('../../../services/study/manualCardDrafts.js');

    await expect(deleteManualCardDraft({ userId: 'user-1', draftId: 'draft-1' })).rejects.toThrow(
      'Study card draft not found.'
    );
  });
});
