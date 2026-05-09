import type {
  StudyManualCardDraftCreateRequest,
  StudyVocabBundleCommitVariant,
} from '@languageflow/shared/src/types.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockPrisma } from '../../setup.js';

const createReadyManualCardDraftsInTransactionMock = vi.hoisted(() => vi.fn());
const getOwnedPreviewMediaIdsMock = vi.hoisted(() => vi.fn());
const resolveStudyCardCandidateCommitItemMock = vi.hoisted(() => vi.fn());

vi.mock('../../../services/study/manualCardDrafts.js', () => ({
  createReadyManualCardDraftsInTransaction: createReadyManualCardDraftsInTransactionMock,
}));

vi.mock('../../../services/study/candidates/previewMedia.js', () => ({
  addPreviewAudio: vi.fn(async (_userId, candidate) => candidate),
  getOwnedPreviewMediaIds: getOwnedPreviewMediaIdsMock,
}));

vi.mock('../../../services/study/candidates/candidateCommit.js', () => ({
  resolveStudyCardCandidateCommitItem: resolveStudyCardCandidateCommitItemMock,
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

describe('studyVocabBundleService', () => {
  beforeEach(() => {
    createReadyManualCardDraftsInTransactionMock.mockReset();
    getOwnedPreviewMediaIdsMock.mockReset();
    resolveStudyCardCandidateCommitItemMock.mockReset();
    mockPrisma.studyVariantGroup.create.mockReset();
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
});
