import type { Page } from '@playwright/test';

export const entry = {
  id: '01arz3ndektsv4rrffq69g5fav',
  title: '雨の日',
  body: '雨が降る。',
  entryDate: '2026-11-17',
  version: 1,
  createdAt: '2026-11-17T10:00:00Z',
  updatedAt: '2026-11-17T10:00:00Z',
};
const tutor = {
  id: 'hana',
  name: 'Hana',
  gender: 'F',
  avatar: 'hana-v1',
  avatarUrl: '/images/tutor-hana.webp',
};
const analysis = {
  id: '01arz3ndektsv4rrffq69g5faw',
  sourceVersion: 1,
  status: 'ready',
  error: null,
  updatedAt: entry.updatedAt,
  replyRevision: 0,
  result: {
    title: entry.title,
    correctedText: entry.body,
    correctedReading: entry.body,
    question: '今日は何をしましたか。',
    questionReading: '今日は何をしましたか。',
    questionTranslation: 'What did you do today?',
    segments: [
      {
        text: entry.body,
        reading: entry.body,
        kind: 'plain',
        suggestion: null,
        suggestionReading: null,
        explanation: null,
        explanationReading: null,
      },
    ],
  },
};
export async function journalKeyboardFixture(page: Page) {
  const writes: Array<{ path: string; body: Record<string, unknown> }> = [];
  await page.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (['POST', 'PUT'].includes(request.method()))
      writes.push({ path, body: request.postDataJSON() });
    if (request.method() === 'PUT' && /^\/api\/journal\/entries\/[^/]+$/.test(path)) {
      await route.fulfill({
        json: { data: { ...entry, ...request.postDataJSON(), id: path.split('/').at(-1) } },
      });
      return;
    }
    const responses: Record<string, unknown> = {
      '/api/convolab/auth/me': {
        id: 'keyboard-user',
        name: 'Andrew',
        onboardingCompleted: true,
        email: 'test@example.test',
      },
      '/api/feature-flags': {
        flashcardsEnabled: false,
        readingsEnabled: false,
        studyTimeEnabled: false,
      },
      '/api/journal/entries': { data: [entry], nextCursor: null },
      [`/api/journal/entries/${entry.id}`]: { data: entry },
      [`/api/journal/entries/${entry.id}/analysis`]: { data: analysis, entry },
      [`/api/journal/entries/${entry.id}/corrected`]: {
        data: {
          ...analysis,
          replyRevision: 1,
          correctedDocument: {
            text: request.postDataJSON()?.text,
            reading: request.postDataJSON()?.text,
            suggestions: [],
          },
        },
      },
      [`/api/journal/entries/${entry.id}/conversation`]: { data: [] },
      [`/api/journal/entries/${entry.id}/question`]: {
        data: {
          id: 'question',
          text: analysis.result.question,
          reading: analysis.result.question,
          translation: analysis.result.questionTranslation,
          tutor,
        },
      },
      [`/api/journal/entries/${entry.id}/audio`]: { data: { voiceId: 'haru', hasAudio: false } },
      '/api/journal/tutor': { data: { selectedId: 'hana', tutors: [tutor] } },
    };
    await route.fulfill({ json: responses[path] ?? { data: [], nextCursor: null } });
  });
  return writes;
}
