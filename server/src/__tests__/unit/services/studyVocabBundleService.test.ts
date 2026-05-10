import type { StudyManualCardDraftCreateRequest } from '@languageflow/shared/src/types.js';
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../../../middleware/errorHandler.js';
import { mockPrisma } from '../../setup.js';

const createGeneratingManualCardDraftsInTransactionMock = vi.hoisted(() => vi.fn());
const getOwnedPreviewMediaIdsMock = vi.hoisted(() => vi.fn());
const resolveStudyCardCandidateCommitItemMock = vi.hoisted(() => vi.fn());
const generateStudyCardCandidateJsonMock = vi.hoisted(() => vi.fn());
const buildLearnerContextSummaryMock = vi.hoisted(() => vi.fn());
const generateCandidatePreviewImageMock = vi.hoisted(() => vi.fn());

vi.mock('../../../services/study/manualCardDrafts.js', () => ({
  createGeneratingManualCardDraftsInTransaction: createGeneratingManualCardDraftsInTransactionMock,
}));

vi.mock('../../../services/study/candidates/previewMedia.js', () => ({
  addPreviewAudio: vi.fn(async (_userId, candidate) => candidate),
  generateCandidatePreviewImage: generateCandidatePreviewImageMock,
  getOwnedPreviewMediaIds: getOwnedPreviewMediaIdsMock,
}));

vi.mock('../../../services/study/candidates/candidateCommit.js', () => ({
  resolveStudyCardCandidateCommitItem: resolveStudyCardCandidateCommitItemMock,
}));

vi.mock('../../../services/llmClient.js', () => ({
  generateStudyCardCandidateJson: generateStudyCardCandidateJsonMock,
}));

vi.mock('../../../services/study/candidates/learnerContext.js', () => ({
  buildLearnerContextSummary: buildLearnerContextSummaryMock,
}));

function variant(index: number) {
  const isCloze = index >= 8;
  const sentenceOrdinal = isCloze ? index - 8 : index % 3;
  const isAudio = index < 3 || index === 6;
  const audio = {
    id: `audio-${index}`,
    filename: `audio-${index}.mp3`,
    url: `/api/study/media/audio-${index}`,
    mediaKind: 'audio',
    source: 'generated',
  } as const;
  return {
    clientId: `variant-${index}`,
    stage: index < 3 ? 1 : index < 6 ? 2 : index === 6 ? 3 : index === 7 ? 4 : 5,
    variantKind:
      index < 3
        ? 'sentence_audio_recognition'
        : index < 6
          ? 'sentence_text_recognition'
          : index === 6
            ? 'word_audio_recognition'
            : index === 7
              ? 'word_text_recognition'
              : 'sentence_cloze',
    variantSentenceOrdinal: index === 6 || index === 7 ? null : sentenceOrdinal,
    candidate: {
      clientId: `candidate-${index}`,
      candidateKind: isCloze ? 'cloze' : isAudio ? 'audio-recognition' : 'text-recognition',
      cardType: isCloze ? 'cloze' : 'recognition',
      prompt: isAudio ? { cueAudio: audio } : { cueText: `例文${index}` },
      answer: { expression: '営業する', meaning: 'to do sales' },
      previewAudio: isAudio ? audio : null,
      previewAudioRole: isAudio ? 'prompt' : null,
      previewImage: null,
      imagePrompt: null,
    },
  };
}

function vocabBundleJson() {
  return JSON.stringify({
    targetWord: '営業する',
    targetReading: '営業[えいぎょう]する',
    targetMeaning: 'to do sales',
    sentences: [0, 1, 2].map((ordinal) => ({
      sentenceJp: `営業する例文${ordinal + 1}です。`,
      sentenceReading: `営業[えいぎょう]する例文[れいぶん]${ordinal + 1}です。`,
      sentenceEn: `Example sentence ${ordinal + 1}.`,
      notes: `sentence ${ordinal + 1}`,
      clozeText: `{{c1:営業する}}例文${ordinal + 1}です。`,
      clozeHint: 'to do sales',
    })),
  });
}

function draftForVariant(index: number) {
  const current = variant(index);
  return {
    id: `draft-${index}`,
    userId: 'user-1',
    status: 'generating',
    variantGroupId: 'group-1',
    variantSentenceId:
      typeof current.variantSentenceOrdinal === 'number'
        ? `sentence-${current.variantSentenceOrdinal}`
        : null,
    variantKind: current.variantKind,
    variantStage: current.stage,
  };
}

function vocabGroup(includeLearnerContext: boolean) {
  return {
    id: 'group-1',
    userId: 'user-1',
    targetWord: '営業する',
    targetReading: null,
    targetMeaning: null,
    sourceSentence: '営業の仕事は楽しいです。',
    sourceContext: 'business chapter',
    includeLearnerContext,
    sentences: [0, 1, 2].map((ordinal) => ({
      id: `sentence-${ordinal}`,
      ordinal,
    })),
    drafts: Array.from({ length: 11 }, (_value, index) => draftForVariant(index)),
  };
}

describe('studyVocabBundleService', () => {
  beforeEach(() => {
    createGeneratingManualCardDraftsInTransactionMock.mockReset();
    getOwnedPreviewMediaIdsMock.mockReset();
    resolveStudyCardCandidateCommitItemMock.mockReset();
    generateStudyCardCandidateJsonMock.mockReset();
    buildLearnerContextSummaryMock.mockReset();
    generateCandidatePreviewImageMock.mockReset();
    generateCandidatePreviewImageMock.mockImplementation(async ({ clientId }) => ({
      id: `image-${clientId}`,
      filename: `${clientId}.webp`,
      url: `/api/study/media/image-${clientId}`,
      mediaKind: 'image',
      source: 'generated',
    }));
    mockPrisma.studyVariantGroup.create.mockReset();
    mockPrisma.studyVariantGroup.findUnique.mockReset();
    mockPrisma.studyVariantGroup.update.mockReset();
    mockPrisma.studyVariantSentence.findMany.mockReset();
    mockPrisma.studyVariantSentence.update.mockReset();
    mockPrisma.studyCardDraft.findMany.mockReset();
    mockPrisma.studyCardDraft.update.mockReset();
    mockPrisma.studyCardDraft.updateMany.mockReset();
  });

  it('creates generating drafts for an async vocab bundle request', async () => {
    mockPrisma.studyVariantGroup.create.mockResolvedValue({
      id: 'group-1',
      sentences: [0, 1, 2].map((ordinal) => ({
        id: `sentence-${ordinal}`,
        ordinal,
      })),
    });
    createGeneratingManualCardDraftsInTransactionMock.mockImplementation(async ({ drafts }) =>
      drafts.map((draft: StudyManualCardDraftCreateRequest, index: number) => ({
        ...draft,
        id: `draft-${index}`,
        status: 'generating',
      }))
    );

    const { createStudyVocabBundleDrafts } =
      await import('../../../services/studyVocabBundleService.js');
    const result = await createStudyVocabBundleDrafts({
      userId: 'user-1',
      request: {
        targetWord: '営業する',
        sourceSentence: '営業の仕事は楽しいです。',
        context: 'business chapter',
        includeLearnerContext: true,
      },
    });

    expect(result.groupId).toBe('group-1');
    expect(result.drafts).toHaveLength(11);
    expect(mockPrisma.studyVariantGroup.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          includeLearnerContext: true,
        }),
      })
    );
    expect(createGeneratingManualCardDraftsInTransactionMock).toHaveBeenCalledWith({
      tx: mockPrisma,
      userId: 'user-1',
      drafts: expect.arrayContaining([
        expect.objectContaining({
          creationKind: 'audio-recognition',
          variantKind: 'sentence_audio_recognition',
          variantStage: 1,
          variantStatus: 'available',
          variantGroupId: 'group-1',
        }),
        expect.objectContaining({
          creationKind: 'cloze',
          variantKind: 'sentence_cloze',
          variantStage: 5,
          variantStatus: 'locked',
          variantGroupId: 'group-1',
        }),
      ]),
    });
  });

  it('processes queued vocab bundle drafts without re-enabling omitted learner context', async () => {
    const group = vocabGroup(false);
    mockPrisma.studyVariantGroup.findUnique.mockResolvedValue(group);
    mockPrisma.studyVariantGroup.update.mockResolvedValue(group);
    mockPrisma.studyVariantSentence.findMany.mockResolvedValue(group.sentences);
    mockPrisma.studyVariantSentence.update.mockImplementation(async ({ where, data }) => ({
      id: where.id,
      ...data,
    }));
    mockPrisma.studyCardDraft.findMany.mockResolvedValue(group.drafts);
    mockPrisma.studyCardDraft.update.mockImplementation(async ({ where, data }) => ({
      id: where.id,
      ...data,
    }));
    generateStudyCardCandidateJsonMock.mockResolvedValue(vocabBundleJson());
    resolveStudyCardCandidateCommitItemMock.mockImplementation(async ({ item }) => ({
      item,
      prompt: item.prompt,
      answer: item.answer,
      previewAudioId: item.previewAudio?.id ?? null,
      previewAudioRole: item.previewAudioRole ?? null,
      previewImageId: item.previewImage?.id ?? null,
    }));
    getOwnedPreviewMediaIdsMock.mockImplementation(async ({ mediaIds }) => new Set(mediaIds));

    const { processStudyVocabBundleDrafts } =
      await import('../../../services/studyVocabBundleService.js');
    const result = await processStudyVocabBundleDrafts('group-1');

    expect(result).toEqual({ groupId: 'group-1', completedDraftCount: 11 });
    expect(buildLearnerContextSummaryMock).not.toHaveBeenCalled();
    expect(generateCandidatePreviewImageMock).toHaveBeenCalledTimes(3);
    expect(generateCandidatePreviewImageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        clientId: 'sentence-cloze-0',
        imagePrompt: expect.stringContaining('No text'),
      })
    );
    expect(mockPrisma.studyCardDraft.update).toHaveBeenCalledTimes(11);
    expect(mockPrisma.studyCardDraft.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'draft-8' },
        data: expect.objectContaining({
          cardType: 'cloze',
          imagePlacement: 'both',
          imagePrompt: expect.stringContaining('No text'),
          previewImageJson: expect.objectContaining({
            id: 'image-sentence-cloze-0',
            mediaKind: 'image',
          }),
        }),
      })
    );
    expect(mockPrisma.studyCardDraft.updateMany).not.toHaveBeenCalled();
  });

  it('keeps cloze drafts ready with image prompts when preview image generation fails', async () => {
    const group = vocabGroup(false);
    mockPrisma.studyVariantGroup.findUnique.mockResolvedValue(group);
    mockPrisma.studyVariantGroup.update.mockResolvedValue(group);
    mockPrisma.studyVariantSentence.findMany.mockResolvedValue(group.sentences);
    mockPrisma.studyVariantSentence.update.mockImplementation(async ({ where, data }) => ({
      id: where.id,
      ...data,
    }));
    mockPrisma.studyCardDraft.findMany.mockResolvedValue(group.drafts);
    mockPrisma.studyCardDraft.update.mockImplementation(async ({ where, data }) => ({
      id: where.id,
      ...data,
    }));
    generateStudyCardCandidateJsonMock.mockResolvedValue(vocabBundleJson());
    generateCandidatePreviewImageMock.mockRejectedValue(new Error('image provider timeout'));
    resolveStudyCardCandidateCommitItemMock.mockImplementation(async ({ item }) => ({
      item,
      prompt: item.prompt,
      answer: item.answer,
      previewAudioId: item.previewAudio?.id ?? null,
      previewAudioRole: item.previewAudioRole ?? null,
      previewImageId: item.previewImage?.id ?? null,
    }));
    getOwnedPreviewMediaIdsMock.mockImplementation(async ({ mediaIds }) => new Set(mediaIds));

    const { processStudyVocabBundleDrafts } =
      await import('../../../services/studyVocabBundleService.js');
    const result = await processStudyVocabBundleDrafts('group-1');

    expect(result).toEqual({ groupId: 'group-1', completedDraftCount: 11 });
    expect(generateCandidatePreviewImageMock).toHaveBeenCalledTimes(3);
    expect(mockPrisma.studyCardDraft.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'draft-8' },
        data: expect.objectContaining({
          status: 'ready',
          cardType: 'cloze',
          imagePlacement: 'both',
          imagePrompt: expect.stringContaining('No text'),
          previewImageJson: Prisma.JsonNull,
        }),
      })
    );
    expect(mockPrisma.studyCardDraft.updateMany).not.toHaveBeenCalled();
  });

  it('marks generating drafts as error immediately when generated variants do not match placeholders', async () => {
    const group = vocabGroup(false);
    const mismatchError = 'Generated vocab bundle did not match queued draft placeholders.';
    mockPrisma.studyVariantGroup.findUnique.mockResolvedValue(group);
    mockPrisma.studyVariantGroup.update.mockResolvedValue(group);
    mockPrisma.studyVariantSentence.findMany.mockResolvedValue(group.sentences);
    mockPrisma.studyVariantSentence.update.mockImplementation(async ({ where, data }) => ({
      id: where.id,
      ...data,
    }));
    mockPrisma.studyCardDraft.findMany.mockResolvedValue(group.drafts.slice(0, 10));
    generateStudyCardCandidateJsonMock.mockResolvedValue(vocabBundleJson());
    resolveStudyCardCandidateCommitItemMock.mockImplementation(async ({ item }) => ({
      item,
      prompt: item.prompt,
      answer: item.answer,
      previewAudioId: item.previewAudio?.id ?? null,
      previewAudioRole: item.previewAudioRole ?? null,
      previewImageId: item.previewImage?.id ?? null,
    }));
    getOwnedPreviewMediaIdsMock.mockImplementation(async ({ mediaIds }) => new Set(mediaIds));

    const { processStudyVocabBundleDrafts } =
      await import('../../../services/studyVocabBundleService.js');

    await expect(
      processStudyVocabBundleDrafts('group-1', { markDraftsOnError: false })
    ).rejects.toThrow(mismatchError);
    expect(mockPrisma.studyCardDraft.update).not.toHaveBeenCalled();
    expect(mockPrisma.studyCardDraft.updateMany).toHaveBeenCalledWith({
      where: { variantGroupId: 'group-1', userId: 'user-1', status: 'generating' },
      data: {
        status: 'error',
        errorMessage:
          'Could not generate this vocab bundle. Please retry or edit the drafts manually.',
      },
    });
  });

  it('marks generating drafts as error when placeholder draft variant keys are duplicated', async () => {
    const group = vocabGroup(false);
    const mismatchError = 'Generated vocab bundle did not match queued draft placeholders.';
    mockPrisma.studyVariantGroup.findUnique.mockResolvedValue(group);
    mockPrisma.studyVariantGroup.update.mockResolvedValue(group);
    mockPrisma.studyVariantSentence.findMany.mockResolvedValue(group.sentences);
    mockPrisma.studyVariantSentence.update.mockImplementation(async ({ where, data }) => ({
      id: where.id,
      ...data,
    }));
    mockPrisma.studyCardDraft.findMany.mockResolvedValue([
      ...group.drafts.slice(0, 10),
      {
        ...group.drafts[10],
        variantStage: 1,
        variantSentenceId: 'sentence-0',
      },
    ]);
    generateStudyCardCandidateJsonMock.mockResolvedValue(vocabBundleJson());
    resolveStudyCardCandidateCommitItemMock.mockImplementation(async ({ item }) => ({
      item,
      prompt: item.prompt,
      answer: item.answer,
      previewAudioId: item.previewAudio?.id ?? null,
      previewAudioRole: item.previewAudioRole ?? null,
      previewImageId: item.previewImage?.id ?? null,
    }));
    getOwnedPreviewMediaIdsMock.mockImplementation(async ({ mediaIds }) => new Set(mediaIds));

    const { processStudyVocabBundleDrafts } =
      await import('../../../services/studyVocabBundleService.js');

    await expect(processStudyVocabBundleDrafts('group-1')).rejects.toThrow(mismatchError);
    expect(mockPrisma.studyCardDraft.update).not.toHaveBeenCalled();
    expect(mockPrisma.studyCardDraft.updateMany).toHaveBeenCalledWith({
      where: { variantGroupId: 'group-1', userId: 'user-1', status: 'generating' },
      data: {
        status: 'error',
        errorMessage:
          'Could not generate this vocab bundle. Please retry or edit the drafts manually.',
      },
    });
  });

  it('leaves drafts generating on retryable processor failures before the final attempt', async () => {
    const group = vocabGroup(false);
    mockPrisma.studyVariantGroup.findUnique.mockResolvedValue(group);
    generateStudyCardCandidateJsonMock.mockRejectedValue(new Error('provider timeout'));

    const { processStudyVocabBundleDrafts } =
      await import('../../../services/studyVocabBundleService.js');

    await expect(
      processStudyVocabBundleDrafts('group-1', { markDraftsOnError: false })
    ).rejects.toThrow('provider timeout');
    expect(mockPrisma.studyCardDraft.updateMany).not.toHaveBeenCalled();
  });

  it('can complete drafts on a retry after an early retryable processor failure', async () => {
    const group = vocabGroup(false);
    mockPrisma.studyVariantGroup.findUnique.mockResolvedValue(group);
    mockPrisma.studyVariantGroup.update.mockResolvedValue(group);
    mockPrisma.studyVariantSentence.findMany.mockResolvedValue(group.sentences);
    mockPrisma.studyVariantSentence.update.mockImplementation(async ({ where, data }) => ({
      id: where.id,
      ...data,
    }));
    mockPrisma.studyCardDraft.findMany.mockResolvedValue(group.drafts);
    mockPrisma.studyCardDraft.update.mockImplementation(async ({ where, data }) => ({
      id: where.id,
      ...data,
    }));
    generateStudyCardCandidateJsonMock
      .mockRejectedValueOnce(new Error('provider timeout'))
      .mockResolvedValue(vocabBundleJson());
    resolveStudyCardCandidateCommitItemMock.mockImplementation(async ({ item }) => ({
      item,
      prompt: item.prompt,
      answer: item.answer,
      previewAudioId: item.previewAudio?.id ?? null,
      previewAudioRole: item.previewAudioRole ?? null,
      previewImageId: item.previewImage?.id ?? null,
    }));
    getOwnedPreviewMediaIdsMock.mockImplementation(async ({ mediaIds }) => new Set(mediaIds));

    const { processStudyVocabBundleDrafts } =
      await import('../../../services/studyVocabBundleService.js');

    await expect(
      processStudyVocabBundleDrafts('group-1', { markDraftsOnError: false })
    ).rejects.toThrow('provider timeout');
    const retryResult = await processStudyVocabBundleDrafts('group-1', {
      markDraftsOnError: false,
    });

    expect(retryResult).toEqual({ groupId: 'group-1', completedDraftCount: 11 });
    expect(mockPrisma.studyCardDraft.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.studyCardDraft.update).toHaveBeenCalledTimes(11);
  });

  it('defaults direct processing calls to store a safe user-facing error message', async () => {
    const group = vocabGroup(false);
    mockPrisma.studyVariantGroup.findUnique.mockResolvedValue(group);
    generateStudyCardCandidateJsonMock.mockRejectedValue(
      new Error('provider leaked prompt detail')
    );

    const { processStudyVocabBundleDrafts } =
      await import('../../../services/studyVocabBundleService.js');

    await expect(processStudyVocabBundleDrafts('group-1')).rejects.toThrow(
      'provider leaked prompt detail'
    );
    expect(mockPrisma.studyCardDraft.updateMany).toHaveBeenCalledWith({
      where: { variantGroupId: 'group-1', userId: 'user-1', status: 'generating' },
      data: {
        status: 'error',
        errorMessage:
          'Could not generate this vocab bundle. Please retry or edit the drafts manually.',
      },
    });
  });

  it('stores safe client AppError messages on final draft processing failures', async () => {
    const group = vocabGroup(false);
    mockPrisma.studyVariantGroup.findUnique.mockResolvedValue(group);
    generateStudyCardCandidateJsonMock.mockRejectedValue(
      new AppError('Target word is required.', 400)
    );

    const { processStudyVocabBundleDrafts } =
      await import('../../../services/studyVocabBundleService.js');

    await expect(processStudyVocabBundleDrafts('group-1')).rejects.toThrow(
      'Target word is required.'
    );
    expect(mockPrisma.studyCardDraft.updateMany).toHaveBeenCalledWith({
      where: { variantGroupId: 'group-1', userId: 'user-1', status: 'generating' },
      data: {
        status: 'error',
        errorMessage: 'Target word is required.',
      },
    });
  });
});
