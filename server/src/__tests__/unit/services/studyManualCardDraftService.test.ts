import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  IMAGE_PROMPT_IMMERSION_GUIDANCE,
  IMAGE_PROMPT_STYLE,
} from '../../../services/imagePromptGuidance.js';
import { generateStudyCardCandidateJson } from '../../../services/llmClient.js';
import {
  generateCandidatePreviewImage,
  getOwnedPreviewMediaIds,
  synthesizeCandidatePreviewAudio,
} from '../../../services/study/candidates/previewMedia.js';
import {
  completeManualStudyCardDraft,
  createManualStudyCard,
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
    expect(result.prompt.clozeDisplayText).toBe('My [...] and [...] sentence.');
    expect(result.prompt.clozeAnswerText).toBe('second');
    expect(result.answer.restoredText).toBe('My example and second sentence.');
    expect(result.imagePrompt).toContain('No text');
    expect(generateStudyCardCandidateJson).toHaveBeenCalledWith(
      expect.stringContaining('"creationKind": "cloze"'),
      expect.stringContaining('{{c1::...}}')
    );
    const systemInstruction = vi.mocked(generateStudyCardCandidateJson).mock.calls[0]?.[1] ?? '';
    expect(systemInstruction).toContain(IMAGE_PROMPT_STYLE);
    expect(systemInstruction).toContain(IMAGE_PROMPT_IMMERSION_GUIDANCE);
    expect(systemInstruction).toContain('Cloze hints are required');
    expect(systemInstruction).toContain('English only');
  });

  it('fills a missing manual cloze hint from the English sentence meaning', async () => {
    vi.mocked(generateStudyCardCandidateJson).mockResolvedValue(
      JSON.stringify({
        prompt: {
          clozeText: '試合に{{c1::勝ちました}}。',
          clozeHint: null,
        },
        answer: {
          restoredText: '試合に勝ちました。',
          meaning: 'I won the match.',
        },
        imagePrompt: null,
      })
    );

    const result = await completeManualStudyCardDraft({
      userId: 'user-1',
      request: {
        creationKind: 'cloze',
        cardType: 'cloze',
        prompt: { clozeText: '試合に[勝ちました]。' },
        answer: {},
        imagePlacement: 'none',
        imagePrompt: null,
      },
    });

    expect(result.prompt.clozeHint).toBe('I won the match.');
    expect(result.prompt.clozeDisplayText).toBe('試合に[...]。');
    expect(result.answer.restoredText).toBe('試合に勝ちました。');
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

  it('fills a draft with a Ren or Yumi voice and generated preview audio', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    vi.mocked(generateStudyCardCandidateJson).mockResolvedValue(
      JSON.stringify({
        prompt: {
          cueText: '会社',
        },
        answer: {
          expression: '会社',
          expressionReading: '会社[かいしゃ]',
          meaning: 'company',
        },
        imagePrompt: null,
      })
    );
    vi.mocked(synthesizeCandidatePreviewAudio).mockResolvedValue({
      id: 'audio-1',
      filename: 'manual-preview.mp3',
      url: '/api/study/media/audio-1',
      mediaKind: 'audio',
      source: 'generated',
    });

    const result = await completeManualStudyCardDraft({
      userId: 'user-1',
      request: {
        creationKind: 'text-recognition',
        cardType: 'recognition',
        prompt: { cueText: '会社' },
        answer: {},
        imagePlacement: 'none',
        imagePrompt: null,
      },
    });

    expect(result.answer.answerAudioVoiceId).toBe('fishaudio:9639f090aa6346329d7d3aca7e6b7226');
    expect(result.previewAudio?.id).toBe('audio-1');
    expect(result.previewAudioRole).toBe('answer');
    expect(result.answer.answerAudio?.id).toBe('audio-1');
    expect(synthesizeCandidatePreviewAudio).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        candidateKind: 'text-recognition',
        answer: expect.objectContaining({
          answerAudioVoiceId: 'fishaudio:9639f090aa6346329d7d3aca7e6b7226',
        }),
      })
    );
    randomSpy.mockRestore();
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

  it('preserves prompt images on audio-recognition cards', async () => {
    vi.mocked(getOwnedPreviewMediaIds).mockResolvedValue(new Set(['image-1']));
    vi.mocked(synthesizeCandidatePreviewAudio).mockResolvedValue({
      id: 'audio-1',
      filename: 'manual.mp3',
      url: '/api/study/media/audio-1',
      mediaKind: 'audio',
      source: 'generated',
    });
    vi.mocked(createStudyCard).mockResolvedValue({ id: 'card-1' } as never);
    const cueImage = {
      id: 'image-1',
      filename: 'front.webp',
      url: '/api/study/media/image-1',
      mediaKind: 'image' as const,
      source: 'generated' as const,
    };

    await createManualStudyCard({
      userId: 'user-1',
      creationKind: 'audio-recognition',
      cardType: 'recognition',
      prompt: { cueImage },
      answer: { expression: '会社', meaning: 'company' },
    });

    expect(getOwnedPreviewMediaIds).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        mediaIds: ['image-1'],
        mediaKind: 'image',
      })
    );
    expect(createStudyCard).toHaveBeenCalledWith(
      expect.objectContaining({
        imageMediaId: 'image-1',
        prompt: {
          cueImage,
          cueAudio: expect.objectContaining({ id: 'audio-1' }),
        },
        promptAudioMediaId: 'audio-1',
        answerAudioMediaId: 'audio-1',
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

  it('validates generated preview audio ownership before creating a manual card', async () => {
    vi.mocked(getOwnedPreviewMediaIds).mockImplementation(async ({ mediaKind }) =>
      mediaKind === 'audio' ? new Set(['audio-1']) : new Set()
    );
    vi.mocked(createStudyCard).mockResolvedValue({ id: 'card-1' } as never);

    await createManualStudyCard({
      userId: 'user-1',
      creationKind: 'text-recognition',
      cardType: 'recognition',
      prompt: { cueText: '会社' },
      answer: {
        expression: '会社',
        meaning: 'company',
        answerAudio: {
          id: 'audio-1',
          filename: 'manual-preview.mp3',
          url: '/api/study/media/audio-1',
          mediaKind: 'audio',
          source: 'generated',
        },
      },
    });

    expect(getOwnedPreviewMediaIds).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        mediaIds: ['audio-1'],
        mediaKind: 'audio',
      })
    );
    expect(createStudyCard).toHaveBeenCalledWith(
      expect.objectContaining({
        answerAudioMediaId: 'audio-1',
        answer: expect.objectContaining({
          answerAudio: expect.objectContaining({ id: 'audio-1' }),
        }),
      })
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
