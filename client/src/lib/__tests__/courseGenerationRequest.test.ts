import { beforeEach, describe, expect, it, vi } from 'vitest';
import { submitCourseGenerationIntent } from '../courseGenerationRequest';

const REQUEST_ID = '11111111-1111-4111-8111-111111111111';

const payload = {
  course: {
    title: 'Dialogue follow-up',
    episodeIds: ['episode-123'],
    nativeLanguage: 'en' as const,
    targetLanguage: 'ja' as const,
    maxLessonDurationMinutes: 20,
    l1VoiceId: 'en-one',
    jlptLevel: 'N5',
    speaker1Gender: 'male' as const,
    speaker2Gender: 'female' as const,
    speaker1VoiceId: 'ja-one',
    speaker2VoiceId: 'ja-two',
  },
  viewAsUserId: 'effective-owner',
};

function response(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  );
}

describe('submitCourseGenerationIntent', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('keeps the same resource and request ID through the optional post-dialogue course flow', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementationOnce(() => response({ id: REQUEST_ID, existing: false }))
      .mockImplementationOnce(() =>
        response({
          clientRequestId: REQUEST_ID,
          state: 'pending',
          jobId: REQUEST_ID,
          courseId: REQUEST_ID,
          message: 'Course generation started',
        })
      );

    await submitCourseGenerationIntent(REQUEST_ID, payload);

    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/convolab/courses?viewAs=effective-owner');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      id: REQUEST_ID,
      episodeIds: ['episode-123'],
    });
    expect(String(fetchMock.mock.calls[1][0])).toBe(
      `/api/convolab/courses/${REQUEST_ID}/generate?viewAs=effective-owner`
    );
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
      clientRequestId: REQUEST_ID,
    });
  });

  it('does not start paid generation when resource creation acknowledges a different ID', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() =>
      response({
        id: '22222222-2222-4222-8222-222222222222',
        existing: false,
      })
    );

    await expect(submitCourseGenerationIntent(REQUEST_ID, payload)).rejects.toThrow(
      /created a different course/
    );
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
