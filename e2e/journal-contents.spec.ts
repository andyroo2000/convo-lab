import { expect, test, type Page } from '@playwright/test';

const entry = {
  id: '01arz3ndektsv4rrffq69g5fav',
  title: '日本語のレッスン',
  body: '今朝は日本語のレッスンがあった。今日のレッスンは楽しかった。先生と一緒に笑った。',
  entryDate: '2026-11-17',
  version: 1,
  createdAt: '2026-11-17T10:00:00Z',
  updatedAt: '2026-11-17T10:00:00Z',
};
const tutors = [
  { id: 'hana', name: 'Hana', gender: 'F', avatar: 'hana-v1', avatarUrl: '/fixture-hana.webp' },
  { id: 'ren', name: 'Ren', gender: 'M', avatar: 'ren-v1', avatarUrl: '/fixture-ren.webp' },
];
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
    question: '今日は先生と何を話しましたか。',
    questionReading: '今日は先生と何を話しましたか。',
    questionTranslation: 'What did you talk about with your teacher today?',
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

async function fixture(page: Page) {
  let selectedId = 'hana';
  await page.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }));
  await page.route('**/fixture-*.webp', async (route) => {
    const source = process.env.JOURNAL_AVATAR_DIRECTORY;
    if (source)
      await route.fulfill({
        path: `${source}/${route.request().url().includes('hana') ? 'professor-female' : 'male-02'}-preview.webp`,
      });
    else await route.fulfill({ status: 404 });
  });
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/journal/tutor' && route.request().method() === 'PUT')
      selectedId = route.request().postDataJSON().tutorId;
    const responses: Record<string, unknown> = {
      '/api/convolab/auth/me': {
        id: 'reader',
        name: 'Andrew',
        role: 'user',
        email: 'reader@example.test',
        onboardingCompleted: true,
      },
      '/api/feature-flags': {
        id: 'flags',
        flashcardsEnabled: false,
        readingsEnabled: false,
        studyTimeEnabled: false,
      },
      '/api/journal/entries': { data: [entry], nextCursor: null },
      [`/api/journal/entries/${entry.id}`]: { data: entry },
      [`/api/journal/entries/${entry.id}/analysis`]: { data: analysis, entry },
      [`/api/journal/entries/${entry.id}/conversation`]: { data: [] },
      [`/api/journal/entries/${entry.id}/question`]: {
        data: {
          id: 'question',
          text: analysis.result.question,
          reading: analysis.result.questionReading,
          translation: analysis.result.questionTranslation,
          tutor: tutors[0],
        },
      },
      [`/api/journal/entries/${entry.id}/audio`]: { data: { voiceId: 'ren', hasAudio: false } },
      '/api/journal/voices': { data: [{ id: 'ren', name: 'Ren', avatarUrl: '/fixture-ren.webp' }] },
      '/api/journal/tutor': { data: { selectedId, tutors } },
    };
    await route.fulfill({ json: responses[path] ?? { data: [] } });
  });
  await page.goto(`/app/journal/${entry.id}`);
  await expect(page.getByRole('button', { name: 'Contents', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Hana, your tutor' })).toBeVisible();
  await page.getByRole('button', { name: 'Final', exact: true }).click();
  await expect(page.locator('.journal-narrator-avatar')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

test('Contents, entry actions, and account preferences stay at their proper levels', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await fixture(page);
  await page.screenshot({ path: info.outputPath('desktop-contents.png'), fullPage: true });
  const nav = page.locator('.journal-topbar');
  await expect(nav.getByRole('button', { name: 'Contents', exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: /New entry/ })).toHaveCount(0);
  await expect(nav.getByRole('button', { name: 'Final', exact: true })).toHaveCount(0);
  const logo = await nav.getByRole('link', { name: 'ConvoLab Journal home' }).boundingBox();
  const account = await nav.getByRole('button', { name: 'Account menu' }).boundingBox();
  expect(logo!.x).toBeLessThan(40);
  expect(1440 - account!.x - account!.width).toBeLessThan(40);
  await nav.getByRole('button', { name: 'Contents', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Contents' })).toBeVisible();
  await page.keyboard.press('Escape');
  await nav.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  await page.getByRole('button', { name: 'Sans-serif', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Journal appearance' })).toBeVisible();
  await page.getByRole('button', { name: 'Close appearance' }).click();
  await nav.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('button', { name: 'Choose your tutor', exact: true }).click();
  await page.getByRole('button', { name: 'Ren (M)' }).click();
  await expect(page.getByRole('dialog', { name: 'Choose your tutor' })).not.toBeVisible();
  await expect(page.getByRole('img', { name: 'Hana, your tutor' })).toBeVisible();
});

test('phone header fits and the larger illustrated Listen bars stay attached to entries', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page);
  await page.screenshot({ path: info.outputPath('phone-contents.png'), fullPage: true });
  for (const width of [390, 375, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    for (const name of ['Contents', 'Account menu']) {
      const box = await page.getByRole('button', { name, exact: true }).boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
  }
});
