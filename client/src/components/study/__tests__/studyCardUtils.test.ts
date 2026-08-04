import { describe, expect, it, vi } from 'vitest';

import type { StudyCardSummary } from '@languageflow/shared/src/types';

import { getStudyCardAudio, toAssetUrl } from '../studyCardUtils';

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
});
