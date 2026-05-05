import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generateStudyCardCandidateJson } from '../../../services/llmClient.js';
import {
  generateCandidatePreviewImage,
  getOwnedPreviewMediaIds,
  synthesizeCandidatePreviewAudio,
} from '../../../services/study/candidates/previewMedia.js';
import {
  completeManualStudyCardDraft,
  createManualStudyCard,
  selectStudyImagePromptTreatment,
} from '../../../services/study/manualCardDraft.js';
import { createStudyCard } from '../../../services/studySchedulerService.js';

vi.mock('../../../services/llmClient.js', () => ({
  generateStudyCardCandidateJson: vi.fn(),
}));

vi.mock('../../../services/study/candidates/previewMedia.js', () => ({
  generateCandidatePreviewImage: vi.fn(),
  getOwnedPreviewMediaIds: vi.fn(),
  synthesizeCandidatePreviewAudio: vi.fn(),
}));

vi.mock('../../../services/studySchedulerService.js', () => ({
  createStudyCard: vi.fn(),
}));

describe('manual study card drafts', () => {
  beforeEach(() => {
    vi.mocked(generateStudyCardCandidateJson).mockReset();
    vi.mocked(generateCandidatePreviewImage).mockReset();
    vi.mocked(getOwnedPreviewMediaIds).mockReset();
    vi.mocked(synthesizeCandidatePreviewAudio).mockReset();
    vi.mocked(createStudyCard).mockReset();
  });

  it('completes a cloze draft and normalizes loose bracket notation', async () => {
    vi.mocked(generateStudyCardCandidateJson).mockResolvedValue(
      JSON.stringify({
        prompt: {
          clozeText: 'My [example] and [second] sentence.',
          clozeHint: 'missing word',
        },
        answer: {
          restoredText: 'My example and second sentence.',
          meaning: 'Example sentence',
        },
        imagePrompt: 'A realistic photo of a notebook. No text.',
      })
    );

    const result = await completeManualStudyCardDraft({
      userId: 'user-1',
      request: {
        creationKind: 'cloze',
        cardType: 'cloze',
        prompt: { clozeText: 'My [example] and [second] sentence.' },
        answer: {},
        imagePlacement: 'none',
        imagePrompt: null,
      },
    });

    expect(result.prompt.clozeText).toBe('My {{c1::example}} and {{c1::second}} sentence.');
    expect(result.answer.restoredText).toBe('My example and second sentence.');
    expect(result.imagePrompt).toContain('No text');
    expect(generateStudyCardCandidateJson).toHaveBeenCalledWith(
      expect.stringContaining('"creationKind": "cloze"'),
      expect.stringContaining('{{c1::...}}')
    );
  });

  it('fills only blank draft fields when the LLM returns nulls or conflicting values', async () => {
    vi.mocked(generateStudyCardCandidateJson).mockResolvedValue(
      JSON.stringify({
        prompt: {
          cueText: null,
          cueReading: '会社[かいしゃ]',
          cueMeaning: 'company prompt hint',
        },
        answer: {
          expression: null,
          expressionReading: '会社[かいしゃ]',
          meaning: 'LLM meaning should not replace user meaning',
          answerAudioVoiceId: 'different-voice',
        },
        imagePrompt: null,
      })
    );

    const result = await completeManualStudyCardDraft({
      userId: 'user-1',
      request: {
        creationKind: 'text-recognition',
        cardType: 'recognition',
        prompt: { cueText: '会社' },
        answer: {
          meaning: 'company',
          answerAudioVoiceId: 'user-voice',
        },
        imagePlacement: 'none',
        imagePrompt: null,
      },
    });

    expect(result.prompt).toMatchObject({
      cueText: '会社',
      cueReading: '会社[かいしゃ]',
      cueMeaning: 'company prompt hint',
    });
    expect(result.answer).toMatchObject({
      expressionReading: '会社[かいしゃ]',
      meaning: 'company',
      answerAudioVoiceId: 'user-voice',
    });
  });

  it('auto-generates a preview image for production from image drafts', async () => {
    vi.mocked(generateStudyCardCandidateJson).mockResolvedValue(
      JSON.stringify({
        prompt: { cueMeaning: 'weather' },
        answer: { expression: '曇り', meaning: 'cloudy weather' },
        imagePrompt: 'A vintage National Geographic editorial photo of cloudy weather. No text.',
      })
    );
    vi.mocked(generateCandidatePreviewImage).mockResolvedValue({
      id: 'image-1',
      filename: 'image.webp',
      url: '/api/study/media/image-1',
      mediaKind: 'image',
      source: 'generated',
    });

    const result = await completeManualStudyCardDraft({
      userId: 'user-1',
      request: {
        creationKind: 'production-image',
        cardType: 'production',
        prompt: {},
        answer: { meaning: 'cloudy weather' },
        imagePlacement: 'none',
        imagePrompt: null,
      },
    });

    expect(result.imagePlacement).toBe('prompt');
    expect(result.previewImage?.id).toBe('image-1');
    expect(generateCandidatePreviewImage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        imagePrompt: expect.stringContaining('No text'),
      })
    );
  });

  it('uses a stable image prompt treatment for the same seed', () => {
    expect(selectStudyImagePromptTreatment('曇り cloudy weather')).toBe(
      selectStudyImagePromptTreatment('曇り cloudy weather')
    );
  });

  it('creates audio-recognition cards with one generated audio ref on both sides', async () => {
    vi.mocked(synthesizeCandidatePreviewAudio).mockResolvedValue({
      id: 'audio-1',
      filename: 'manual.mp3',
      url: '/api/study/media/audio-1',
      mediaKind: 'audio',
      source: 'generated',
    });
    vi.mocked(createStudyCard).mockResolvedValue({ id: 'card-1' } as never);

    await createManualStudyCard({
      userId: 'user-1',
      creationKind: 'audio-recognition',
      cardType: 'recognition',
      prompt: { cueText: 'ignored' },
      answer: { expression: '会社', meaning: 'company' },
    });

    expect(createStudyCard).toHaveBeenCalledWith(
      expect.objectContaining({
        promptAudioMediaId: 'audio-1',
        answerAudioMediaId: 'audio-1',
        prompt: {
          cueAudio: expect.objectContaining({ id: 'audio-1' }),
        },
        answer: expect.objectContaining({
          expression: '会社',
          answerAudio: expect.objectContaining({ id: 'audio-1' }),
        }),
      })
    );
  });

  it('rejects audio-recognition cards when prompt audio cannot be generated', async () => {
    vi.mocked(synthesizeCandidatePreviewAudio).mockResolvedValue(null);

    await expect(
      createManualStudyCard({
        userId: 'user-1',
        creationKind: 'audio-recognition',
        cardType: 'recognition',
        prompt: {},
        answer: { expression: '会社', meaning: 'company' },
      })
    ).rejects.toThrow('Could not generate audio for this card.');

    expect(createStudyCard).not.toHaveBeenCalled();
  });

  it('validates generated preview image ownership before creating a manual card', async () => {
    vi.mocked(getOwnedPreviewMediaIds).mockResolvedValue(new Set(['image-1']));
    vi.mocked(createStudyCard).mockResolvedValue({ id: 'card-1' } as never);

    await createManualStudyCard({
      userId: 'user-1',
      creationKind: 'production-text',
      cardType: 'production',
      prompt: {
        cueText: 'cloudy weather',
        cueImage: {
          id: 'image-1',
          filename: 'image.webp',
          url: '/api/study/media/image-1',
          mediaKind: 'image',
          source: 'generated',
        },
      },
      answer: { expression: '曇り', meaning: 'cloudy weather' },
    });

    expect(getOwnedPreviewMediaIds).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        mediaIds: ['image-1'],
        mediaKind: 'image',
      })
    );
    expect(createStudyCard).toHaveBeenCalledWith(
      expect.objectContaining({ imageMediaId: 'image-1' })
    );
  });

  it('rejects manual cards when attached preview image ownership cannot be validated', async () => {
    vi.mocked(getOwnedPreviewMediaIds).mockResolvedValue(new Set());

    await expect(
      createManualStudyCard({
        userId: 'user-1',
        creationKind: 'production-text',
        cardType: 'production',
        prompt: {
          cueText: 'cloudy weather',
          cueImage: {
            id: 'image-1',
            filename: 'image.webp',
            url: '/api/study/media/image-1',
            mediaKind: 'image',
            source: 'generated',
          },
        },
        answer: { expression: '曇り', meaning: 'cloudy weather' },
      })
    ).rejects.toThrow('Preview image was not found for this user.');

    expect(createStudyCard).not.toHaveBeenCalled();
  });
});
