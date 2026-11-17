import { expect, test, type Page, type Route } from '@playwright/test';
import type { JournalEntry } from '../client/src/features/journal/types';

test.use({ baseURL: process.env.BASE_URL ?? 'http://127.0.0.1:5173' });

async function entryResponse(route: Route, entries: Map<string, JournalEntry>) {
  const request = route.request();
  const path = new URL(request.url()).pathname;
  const id = path.split('/')[4];
  if (request.method() === 'PUT') {
    const body = request.postDataJSON();
    entries.set(id, {
      ...body,
      id,
      version: body.expectedVersion + 1,
      createdAt: 'now',
      updatedAt: 'now',
    });
  }
  if (path.endsWith('/analysis')) {
    await route.fulfill({ json: { data: null, entry: entries.get(id) } });
    return;
  }
  if (request.method() === 'DELETE') entries.delete(id);
  await route.fulfill({ json: { data: entries.get(id) ?? null } });
}

async function journalFixture(page: Page) {
  const entries = new Map<string, JournalEntry>();
  await page.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/auth/me')) {
      await route.fulfill({
        json: {
          id: 1,
          name: 'Journal reader',
          displayName: 'Journal reader',
          email: 'reader@example.test',
          onboardingCompleted: true,
        },
      });
      return;
    }
    if (path === '/api/journal/entries') {
      await route.fulfill({ json: { data: [...entries.values()], nextCursor: null } });
      return;
    }
    if (path.startsWith('/api/journal/entries/')) {
      await entryResponse(route, entries);
      return;
    }
    if (path === '/api/journal/tutor') {
      await route.fulfill({
        json: {
          data: {
            selectedId: 'hana',
            tutors: [{ id: 'hana', name: 'Hana', avatarUrl: '/images/tutor-hana.webp' }],
          },
        },
      });
      return;
    }
    await route.fulfill({ status: 503, json: { message: 'Not needed in this Journal fixture' } });
  });
  return entries;
}

test('Journal starts blank, saves on typing, closes deliberately, and resumes today on the next visit', async ({
  page,
}, info) => {
  const entries = await journalFixture(page);
  await page.goto('/app/journal');
  const notebook = page.getByRole('textbox', { name: 'Journal entry in Japanese' });
  await expect(notebook).toBeVisible();
  await expect(notebook).toHaveValue('');
  expect(entries.size).toBe(0);
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.startsWith('convolab:journal:v1:'))
    )
  ).toEqual([]);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(notebook).toHaveValue('');
  await page.screenshot({ path: info.outputPath('blank-notebook.png'), fullPage: true });
  await notebook.fill('今日、映画を見た。');
  await expect(notebook).toBeFocused();
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.startsWith('convolab:journal:v1:'))
    )
  ).toHaveLength(1);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Keep draft & close' }).click();
  await expect(notebook).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Continue draft' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: info.outputPath('continue-draft-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Continue draft' }).click();
  await expect(notebook).toHaveValue('今日、映画を見た。');
  await page.goto('/app/journal');
  await expect(page).toHaveURL(/\/app\/journal\/[a-z0-9]+$/);
  await expect(notebook).toHaveValue('今日、映画を見た。');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Keep draft & close' }).click();
  await expect(notebook).toHaveValue('');
  await page.reload();
  await expect(page).toHaveURL(/\/app\/journal\/[a-z0-9]+$/);
  await expect(notebook).toHaveValue('今日、映画を見た。');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Delete draft', exact: true }).click();
  await expect(notebook).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Continue draft' })).toHaveCount(0);
  expect(entries.size).toBe(0);
});
