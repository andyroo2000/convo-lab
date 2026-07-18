import { describe, expect, it } from 'vitest';

import {
  rewriteLearningOsStudyMediaUrl,
  rewriteStudyCardDraftMediaUrls,
  rewriteStudyCardMediaUrls,
} from '../../../../routes/learningOs/studyMediaUrls.js';

describe('Learning OS Study media URLs', () => {
  it('rewrites only exact Learning OS ULID media paths', () => {
    expect(rewriteLearningOsStudyMediaUrl('/api/study/media/01arz3ndektsv4rrffq69g5faw')).toBe(
      '/api/learning-os/study/media/01ARZ3NDEKTSV4RRFFQ69G5FAW'
    );
    expect(
      rewriteLearningOsStudyMediaUrl('/api/study/media/123e4567-e89b-42d3-a456-426614174000')
    ).toBe('/api/study/media/123e4567-e89b-42d3-a456-426614174000');
    expect(rewriteLearningOsStudyMediaUrl('https://cdn.example.test/word.mp3')).toBe(
      'https://cdn.example.test/word.mp3'
    );
    expect(rewriteLearningOsStudyMediaUrl('/api/study/media/not-a-ulid')).toBe(
      '/api/study/media/not-a-ulid'
    );
    expect(rewriteLearningOsStudyMediaUrl(null)).toBeNull();
  });

  it('rewrites known card media fields without changing card text', () => {
    const card = {
      prompt: {
        cueText: '/api/study/media/01ARZ3NDEKTSV4RRFFQ69G5FAV',
        cueAudio: {
          url: '/api/study/media/01ARZ3NDEKTSV4RRFFQ69G5FAW',
        },
      },
      answer: {
        notes: '/api/study/media/01ARZ3NDEKTSV4RRFFQ69G5FAX',
        answerImage: {
          url: '/api/study/media/01ARZ3NDEKTSV4RRFFQ69G5FAY',
        },
      },
    };

    expect(rewriteStudyCardMediaUrls(card)).toEqual({
      prompt: {
        cueText: '/api/study/media/01ARZ3NDEKTSV4RRFFQ69G5FAV',
        cueAudio: {
          url: '/api/learning-os/study/media/01ARZ3NDEKTSV4RRFFQ69G5FAW',
        },
      },
      answer: {
        notes: '/api/study/media/01ARZ3NDEKTSV4RRFFQ69G5FAX',
        answerImage: {
          url: '/api/learning-os/study/media/01ARZ3NDEKTSV4RRFFQ69G5FAY',
        },
      },
    });
  });

  it('rewrites draft preview media as well as final card payload media', () => {
    const draft = {
      prompt: {},
      answer: {},
      previewAudio: {
        url: '/api/study/media/01ARZ3NDEKTSV4RRFFQ69G5FAW',
      },
      previewImage: {
        url: '/api/study/media/123e4567-e89b-42d3-a456-426614174000',
      },
    };

    expect(rewriteStudyCardDraftMediaUrls(draft)).toEqual({
      ...draft,
      previewAudio: {
        url: '/api/learning-os/study/media/01ARZ3NDEKTSV4RRFFQ69G5FAW',
      },
    });
  });
});
