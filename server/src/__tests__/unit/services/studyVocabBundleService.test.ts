import type {
  StudyManualCardDraftCreateRequest,
  StudyVocabBundleCommitVariant,
} from '@languageflow/shared/src/types.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockPrisma } from '../../setup.js';

const createReadyManualCardDraftsInTransactionMock = vi.hoisted(() => vi.fn());
const createGeneratingManualCardDraftsInTransactionMock = vi.hoisted(() => vi.fn());
const getOwnedPreviewMediaIdsMock = vi.hoisted(() => vi.fn());
const resolveStudyCardCandidateCommitItemMock = vi.hoisted(() => vi.fn());
const generateStudyCardCandidateJsonMock = vi.hoisted(() => vi.fn());
const buildLearnerContextSummaryMock = vi.hoisted(() => vi.fn());

vi.mock('../../../services/study/manualCardDrafts.js', () => ({
  createGeneratingManualCardDraftsInTransaction: createGeneratingManualCardDraftsInTransactionMock,
  createReadyManualCardDraftsInTransaction: createReadyManualCardDraftsInTransactionMock,
}));

vi.mock('../../../services/study/candidates/previewMedia.js', () => ({
  addPreviewAudio: vi.fn(async (_userId, candidate) => candidate),
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

function sentence(ordinal: number) {
  return {
    ordinal,
    sentenceJp: `例文${ordinal + 1}`,
    sentenceReading: `例文[れいぶん]${ordinal + 1}`,
    sentenceEn: `Example sentence ${ordinal + 1}.`,
    notes: null,
  };
}

function variant(index: number) {
  const sentenceOrdinal = index % 3;
  const isCloze = index >= 8;
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
  } satisfies StudyVocabBundleCommitVariant;
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
    createReadyManualCardDraftsInTransactionMock.mockReset();
    getOwnedPreviewMediaIdsMock.mockReset();
    resolveStudyCardCandidateCommitItemMock.mockReset();
    generateStudyCardCandidateJsonMock.mockReset();
    buildLearnerContextSummaryMock.mockReset();
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

  it('commits generated vocab variants into the shared manual draft queue', async () => {
    const variants = Array.from({ length: 11 }, (_value, index) => variant(index));
    mockPrisma.studyVariantGroup.create.mockResolvedValue({
      id: 'group-1',
      sentences: [0, 1, 2].map((ordinal) => ({
        id: `sentence-${ordinal}`,
        ordinal,
      })),
    });
    resolveStudyCardCandidateCommitItemMock.mockImplementation(async ({ item }) => ({
      item,
      prompt: item.prompt,
      answer: item.answer,
      previewAudioId: item.previewAudio?.id ?? null,
      previewAudioRole: item.previewAudioRole ?? null,
      previewImageId: null,
    }));
    getOwnedPreviewMediaIdsMock.mockImplementation(async ({ mediaIds }) => new Set(mediaIds));
    createReadyManualCardDraftsInTransactionMock.mockImplementation(
      async ({ drafts }: { drafts: StudyManualCardDraftCreateRequest[] }) =>
        drafts.map((draft, index) => ({ ...draft, id: `draft-${index}`, status: 'ready' }))
    );

    const { commitStudyVocabBundle } = await import('../../../services/studyVocabBundleService.js');
    const result = await commitStudyVocabBundle({
      userId: 'user-1',
      request: {
        targetWord: '営業する',
        targetReading: '営業[えいぎょう]する',
        targetMeaning: 'to do sales',
        sourceSentence: '営業の仕事は楽しいです。',
        sourceContext: 'business chapter',
        sentences: [sentence(0), sentence(1), sentence(2)],
        variants,
      },
    });

    expect(result.groupId).toBe('group-1');
    expect(result.drafts).toHaveLength(11);
    expect(createReadyManualCardDraftsInTransactionMock).toHaveBeenCalledWith({
      tx: mockPrisma,
      userId: 'user-1',
      drafts: expect.arrayContaining([
        expect.objectContaining({
          variantStage: 1,
          variantStatus: 'available',
          variantGroupId: 'group-1',
        }),
        expect.objectContaining({
          variantStage: 2,
          variantStatus: 'locked',
          variantGroupId: 'group-1',
        }),
      ]),
    });
  });

  it('rejects commit variants that do not match the staged bundle shape', async () => {
    const variants = Array.from({ length: 11 }, (_value, index) => variant(index));
    variants[7] = {
      ...variants[7],
      stage: 1,
      variantKind: 'sentence_audio_recognition',
      variantSentenceOrdinal: 0,
    };
    const { commitStudyVocabBundle } = await import('../../../services/studyVocabBundleService.js');

    await expect(
      commitStudyVocabBundle({
        userId: 'user-1',
        request: {
          targetWord: '営業する',
          targetReading: '営業[えいぎょう]する',
          targetMeaning: 'to do sales',
          sourceSentence: '営業の仕事は楽しいです。',
          sourceContext: 'business chapter',
          sentences: [sentence(0), sentence(1), sentence(2)],
          variants,
        },
      })
    ).rejects.toThrow('Vocab variant candidate kind does not match its stage.');

    expect(mockPrisma.studyVariantGroup.create).not.toHaveBeenCalled();
    expect(createReadyManualCardDraftsInTransactionMock).not.toHaveBeenCalled();
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
    expect(mockPrisma.studyCardDraft.update).toHaveBeenCalledTimes(11);
    expect(mockPrisma.studyCardDraft.updateMany).not.toHaveBeenCalled();
  });

  it('marks generating drafts as error when generated variants do not match placeholders', async () => {
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
});
