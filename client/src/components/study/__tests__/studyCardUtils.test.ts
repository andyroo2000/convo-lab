import { describe, expect, it, vi } from 'vitest';

import type { StudyCardSummary } from '@languageflow/shared/src/types';

import {
  getStudyCardAudio,
  getStudyCardAudioUrl,
  getStudyCardDisplayLabel,
  getStudyCardDisplayMeaning,
  getPresentedCardDisplayLabel,
  getStudyCardReviewAudio,
  isAudioLedPromptCard,
  isMediaLedPromptCard,
  toAssetUrl,
} from '../studyCardUtils';

vi.mock('../../../config', () => ({
  API_URL: 'http://localhost:8080',
}));

describe('studyCardUtils', () => {
  const card = {
    prompt: {},
    answer: {},
  } as StudyCardSummary;

  it('keeps direct Study API media on the browser origin', () => {
    expect(toAssetUrl('/api/study/media/media-1')).toBe('/api/study/media/media-1');
    expect(toAssetUrl('/api/daily-audio-practice/practice-1/tracks/track-1/audio')).toBe(
      '/api/daily-audio-practice/practice-1/tracks/track-1/audio'
    );
  });

  it('continues resolving unrelated relative assets against the configured API origin', () => {
    expect(toAssetUrl('/audio/example.mp3')).toBe('http://localhost:8080/audio/example.mp3');
    expect(toAssetUrl('https://cdn.example/audio.mp3')).toBe('https://cdn.example/audio.mp3');
    expect(toAssetUrl(null)).toBeNull();
  });

  it('resolves prompt-only audio as the card audio', () => {
    const cueAudio = {
      id: 'prompt-audio',
      filename: 'prompt.mp3',
      url: '/api/study/media/prompt-audio',
      mediaKind: 'audio' as const,
      source: 'imported' as const,
    };

    expect(getStudyCardAudio({ ...card, prompt: { cueAudio } })).toBe(cueAudio);
  });

  it('keeps answer-only cards compatible and prefers the prompt cue on conflicts', () => {
    const cueAudio = {
      id: 'prompt-audio',
      filename: 'prompt.mp3',
      mediaKind: 'audio' as const,
      source: 'imported' as const,
    };
    const answerAudio = {
      id: 'answer-audio',
      filename: 'answer.mp3',
      mediaKind: 'audio' as const,
      source: 'generated' as const,
    };

    expect(getStudyCardAudio({ ...card, answer: { answerAudio } })).toBe(answerAudio);
    expect(getStudyCardAudio({ ...card, prompt: { cueAudio }, answer: { answerAudio } })).toBe(
      cueAudio
    );
  });

  it('uses presentation v1 for review audio and autoplay without changing raw editor media', () => {
    const rawAudio = {
      filename: 'raw.mp3',
      url: '/raw.mp3',
      mediaKind: 'audio' as const,
      source: 'imported' as const,
    };
    const presentedCard = {
      ...card,
      cardType: 'recognition' as const,
      answer: { answerAudio: rawAudio },
      presentation: {
        version: 1 as const,
        front: {
          mode: 'media' as const,
          text: null,
          ruby: null,
          hint: null,
          media: { audio: { url: '/presented.mp3' }, image: null },
          autoplayAudio: true,
        },
        answer: {
          heading: null,
          ruby: null,
          restored: null,
          meaning: null,
          sentences: {
            japanese: { text: null, ruby: null },
            english: { text: null, ruby: null },
          },
          notes: [],
          media: { image: null },
          audio: { url: '/presented.mp3' },
          pitchAccent: null,
        },
      },
    } as StudyCardSummary;

    expect(getStudyCardAudio(presentedCard)).toBe(rawAudio);
    expect(getStudyCardReviewAudio(presentedCard)).toEqual({ url: '/presented.mp3' });
    expect(getStudyCardAudioUrl(presentedCard)).toBe('http://localhost:8080/presented.mp3');
    expect(isAudioLedPromptCard(presentedCard)).toBe(true);
  });

  it('does not let legacy media fields override a server-owned text front', () => {
    const cardWithRawMedia = {
      ...card,
      cardType: 'recognition' as const,
      prompt: {
        cueAudio: {
          filename: 'raw.mp3',
          url: '/raw.mp3',
          mediaKind: 'audio' as const,
          source: 'imported' as const,
        },
      },
      presentation: {
        version: 1 as const,
        front: {
          mode: 'text' as const,
          text: 'server text',
          ruby: null,
          hint: null,
          media: { audio: null, image: null },
          autoplayAudio: false,
        },
        answer: {
          heading: null,
          ruby: null,
          restored: null,
          meaning: null,
          sentences: {
            japanese: { text: null, ruby: null },
            english: { text: null, ruby: null },
          },
          notes: [],
          media: { image: null },
          audio: null,
          pitchAccent: null,
        },
      },
    } as StudyCardSummary;

    expect(isMediaLedPromptCard(cardWithRawMedia)).toBe(false);
  });

  it('does not resurrect raw audio that the server presentation suppresses', () => {
    const presentedCard = {
      ...card,
      cardType: 'recognition' as const,
      answer: {
        answerAudio: {
          filename: 'stale.mp3',
          url: '/stale.mp3',
          mediaKind: 'audio' as const,
          source: 'imported' as const,
        },
      },
      presentation: {
        version: 1 as const,
        front: {
          mode: 'text' as const,
          text: '会社',
          ruby: null,
          hint: null,
          media: { audio: null, image: null },
          autoplayAudio: false,
        },
        answer: {
          heading: '会社',
          ruby: null,
          restored: null,
          meaning: 'company',
          sentences: {
            japanese: { text: null, ruby: null },
            english: { text: null, ruby: null },
          },
          notes: [],
          media: { image: null },
          audio: null,
          pitchAccent: null,
        },
      },
    } as StudyCardSummary;

    expect(getStudyCardAudioUrl(presentedCard)).toBeNull();
    expect(getStudyCardReviewAudio(presentedCard)).toBeNull();
  });

  it('uses known-v1 presentation labels and meanings instead of divergent raw fields', () => {
    const presentedCard = {
      ...card,
      prompt: { cueText: 'raw prompt', cueMeaning: 'raw prompt meaning' },
      answer: { expression: 'raw answer', meaning: 'raw answer meaning' },
      presentation: {
        version: 1 as const,
        front: {
          mode: 'text' as const,
          text: 'server label',
          ruby: null,
          hint: null,
          media: { audio: null, image: null },
          autoplayAudio: false,
        },
        answer: {
          heading: 'server heading',
          ruby: null,
          restored: null,
          meaning: 'server meaning',
          sentences: {
            japanese: { text: null, ruby: null },
            english: { text: null, ruby: null },
          },
          notes: [],
          media: { image: null },
          audio: null,
          pitchAccent: null,
        },
      },
    } as StudyCardSummary;

    expect(getStudyCardDisplayLabel(presentedCard, 'fallback')).toBe('server heading');
    expect(getStudyCardDisplayMeaning(presentedCard)).toBe('server meaning');
  });

  it('uses text-mode answer priority and skips blank fields despite a stale outer cloze type', () => {
    const presentedCard = {
      ...card,
      cardType: 'cloze' as const,
      prompt: { cueText: 'raw production prompt' },
      answer: { expression: 'raw production answer' },
      presentation: {
        version: 1 as const,
        front: {
          mode: 'text' as const,
          text: 'company',
          ruby: null,
          hint: null,
          media: { audio: null, image: null },
          autoplayAudio: false,
        },
        answer: {
          heading: ' 会社 ',
          ruby: '   ',
          restored: 'wrong restored label',
          meaning: '   ',
          sentences: {
            japanese: { text: null, ruby: null },
            english: { text: null, ruby: null },
          },
          notes: [],
          media: { image: null },
          audio: null,
          pitchAccent: null,
        },
      },
    } as StudyCardSummary;

    expect(getPresentedCardDisplayLabel(presentedCard, 'fallback')).toBe('会社');
    expect(getStudyCardDisplayLabel(presentedCard, 'fallback')).toBe('会社');
    expect(getStudyCardDisplayMeaning(presentedCard)).toBeNull();
  });

  it('uses cloze-mode restored priority despite a stale outer recognition type', () => {
    const presentedCard = {
      ...card,
      cardType: 'recognition' as const,
      prompt: { clozeDisplayText: 'raw [...] prompt' },
      answer: { restoredText: 'raw restored answer' },
      presentation: {
        version: 1 as const,
        front: {
          mode: 'cloze' as const,
          text: 'server [...] prompt',
          ruby: null,
          hint: null,
          media: { audio: null, image: null },
          autoplayAudio: false,
        },
        answer: {
          heading: 'wrong heading',
          ruby: '',
          restored: ' server restored answer ',
          meaning: null,
          sentences: {
            japanese: { text: null, ruby: null },
            english: { text: null, ruby: null },
          },
          notes: [],
          media: { image: null },
          audio: null,
          pitchAccent: null,
        },
      },
    } as StudyCardSummary;

    expect(getPresentedCardDisplayLabel(presentedCard, 'fallback')).toBe('server restored answer');
    expect(getStudyCardDisplayLabel(presentedCard, 'fallback')).toBe('server restored answer');
    expect(getStudyCardDisplayMeaning(presentedCard)).toBeNull();
  });

  it('does not resurrect raw labels or meanings when known-v1 fields are null', () => {
    const presentedCard = {
      ...card,
      prompt: { cueText: 'raw prompt', cueMeaning: 'raw prompt meaning' },
      answer: { expression: 'raw answer', meaning: 'raw answer meaning' },
      presentation: {
        version: 1 as const,
        front: {
          mode: 'text' as const,
          text: null,
          ruby: null,
          hint: null,
          media: { audio: null, image: null },
          autoplayAudio: false,
        },
        answer: {
          heading: null,
          ruby: null,
          restored: null,
          meaning: null,
          sentences: {
            japanese: { text: null, ruby: null },
            english: { text: null, ruby: null },
          },
          notes: [],
          media: { image: null },
          audio: null,
          pitchAccent: null,
        },
      },
    } as StudyCardSummary;

    expect(getStudyCardDisplayLabel(presentedCard, 'fallback')).toBe('fallback');
    expect(getStudyCardDisplayMeaning(presentedCard)).toBeNull();
    expect(
      getStudyCardDisplayLabel({ ...presentedCard, presentation: undefined }, 'fallback')
    ).toBe('raw answer');
  });
});
