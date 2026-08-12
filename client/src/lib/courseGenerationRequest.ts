import { LanguageCode } from '../types';
import { JsonRequestError } from './apiClient';
import { errorMessageFromPayload } from './apiError';
import { courseApi } from './courseApi';
import { GenerationRequestAcknowledgement } from './generationRequest';

export interface CourseCreationPayload extends Record<string, unknown> {
  title: string;
  episodeIds?: string[];
  sourceText?: string;
  nativeLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  maxLessonDurationMinutes: number;
  l1VoiceId: string;
  jlptLevel: string;
  speaker1Gender: 'male' | 'female';
  speaker2Gender: 'male' | 'female';
  speaker1VoiceId: string;
  speaker2VoiceId: string;
}

export interface CourseGenerationIntentPayload {
  course: CourseCreationPayload;
  viewAsUserId?: string;
}

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const message = errorMessageFromPayload(payload) ?? 'Request failed';
    throw new JsonRequestError(message, response.status, payload);
  }
  return response.json();
}

export async function submitCourseGenerationIntent(
  intentId: string,
  payload: CourseGenerationIntentPayload,
  signal?: AbortSignal
): Promise<{ courseId: string; acknowledgement: GenerationRequestAcknowledgement }> {
  const viewAsParam = payload.viewAsUserId
    ? `?${new URLSearchParams({ viewAs: payload.viewAsUserId })}`
    : '';
  const course = await postJson<{ id: string }>(
    `${courseApi.collection}${viewAsParam}`,
    { ...payload.course, id: intentId },
    signal
  );

  const acknowledgement = await postJson<GenerationRequestAcknowledgement>(
    `${courseApi.operation(course.id, 'generate')}${viewAsParam}`,
    { clientRequestId: intentId },
    signal
  );
  if (acknowledgement.clientRequestId !== intentId) {
    throw new Error('The server acknowledged a different generation request.');
  }
  return { courseId: course.id, acknowledgement };
}
