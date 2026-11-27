import { requestJson } from '../../lib/apiClient';
import type { LearnAction, LearnCollection, LearnSession } from './types';

export const getLearnCollection = (signal?: AbortSignal) =>
  requestJson<LearnCollection>('/api/learn/lessons', { signal });

export async function openLearnLesson(lessonId: string, signal?: AbortSignal) {
  const result = await requestJson<{ data: LearnSession }>(
    `/api/learn/lessons/${encodeURIComponent(lessonId)}/session`,
    { method: 'POST', signal }
  );
  return result.data;
}

export async function getLearnSession(id: string, signal?: AbortSignal) {
  const result = await requestJson<{ data: LearnSession }>(
    `/api/learn/sessions/${encodeURIComponent(id)}`,
    { signal }
  );
  return result.data;
}

export async function sendLearnTurn(session: LearnSession, action: LearnAction, text?: string) {
  const result = await requestJson<{ data: LearnSession }>(
    `/api/learn/sessions/${encodeURIComponent(session.id)}/turn`,
    {
      method: 'POST',
      body: JSON.stringify({
        action,
        text,
        expectedVersion: session.version,
        requestId: crypto.randomUUID(),
      }),
    }
  );
  return result.data;
}
