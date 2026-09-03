import { describe, expect, it } from 'vitest';

import {
  buildCourseCreationIntentPayload,
  buildCourseCreationRequest,
  getCourseCreationValidationError,
  getCourseDraftErrorMessage,
} from '../courseCreationRequest';

const baseInput = {
  title: '  Weekend Course  ',
  sourceText: '  Plan a weekend trip  ',
  nativeLanguage: 'en' as const,
  targetLanguage: 'ja' as const,
  maxDuration: 30,
  selectedVoice: 'narrator-1',
  jlptLevel: 'N4',
  speaker1VoiceId: 'speaker-1',
  speaker2VoiceId: 'speaker-2',
};

describe('course creation request helpers', () => {
  it.each([
    [{ title: ' ' }, 'audioCourse:alerts.fillRequired'],
    [{ sourceText: ' ' }, 'audioCourse:alerts.fillRequired'],
    [{ selectedVoice: '' }, 'audioCourse:alerts.selectVoice'],
  ])('returns the expected validation error', (override, expected) => {
    expect(getCourseCreationValidationError({ ...baseInput, ...override })).toBe(expected);
  });

  it('accepts an episode without source text', () => {
    expect(
      getCourseCreationValidationError({ ...baseInput, sourceText: '', episodeId: 'episode-1' })
    ).toBeNull();
  });

  it('builds a trimmed source-text course request', () => {
    expect(buildCourseCreationRequest(baseInput)).toEqual({
      title: 'Weekend Course',
      sourceText: 'Plan a weekend trip',
      nativeLanguage: 'en',
      targetLanguage: 'ja',
      maxLessonDurationMinutes: 30,
      l1VoiceId: 'narrator-1',
      jlptLevel: 'N4',
      speaker1Gender: 'male',
      speaker2Gender: 'female',
      speaker1VoiceId: 'speaker-1',
      speaker2VoiceId: 'speaker-2',
    });
  });

  it('builds an episode-scoped impersonated generation intent', () => {
    const payload = buildCourseCreationIntentPayload({
      ...baseInput,
      sourceText: '',
      episodeId: 'episode-1',
      viewAsUserId: 'user-2',
    });

    expect(payload.course).toMatchObject({
      title: 'Weekend Course',
      episodeIds: ['episode-1'],
    });
    expect(payload.course).not.toHaveProperty('sourceText');
    expect(payload.viewAsUserId).toBe('user-2');
  });

  it('omits an empty impersonation scope', () => {
    expect(buildCourseCreationIntentPayload(baseInput)).not.toHaveProperty('viewAsUserId');
  });

  it.each([
    [{ message: 'top-level' }, 'top-level'],
    [{ error: { message: 'nested' } }, 'nested'],
    [{ error: 'plain' }, 'plain'],
    [{}, 'Failed to create course'],
  ])('extracts the course draft API error', (response, expected) => {
    expect(getCourseDraftErrorMessage(response)).toBe(expected);
  });
});
