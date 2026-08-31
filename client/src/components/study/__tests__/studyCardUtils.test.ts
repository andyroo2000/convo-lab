import { describe, expect, it, vi } from 'vitest';

import type { StudyCardSummary } from '@languageflow/shared/src/types';

import {
  getStudyCardAudio,
  getStudyCardAudioUrl,
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
});
