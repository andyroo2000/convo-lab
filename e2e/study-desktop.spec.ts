import { expect, test } from '@playwright/test';

import { loginAsUser } from './utils/test-helpers';

test.describe('Study desktop experience', () => {
  test('dashboard, focused review, and browse smoke cleanly on desktop', async ({ page }) => {
    await loginAsUser(page);

    await page.goto('/app/study');
    await expect(page.getByRole('heading', { name: 'Study', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Begin Study' })).toBeVisible();

    await page.getByRole('button', { name: 'Begin Study' }).click();
    await expect(page.getByTestId('study-focus-shell')).toBeVisible();
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await expect(page.getByTestId('study-review-actions')).toBeVisible();

    await page.goto('/app/study/browse');
    await expect(page.getByRole('heading', { name: 'Browse cards' })).toBeVisible();
    await expect(page.getByTestId('study-browser-note-list')).toBeVisible();
    await page.locator('[data-testid="study-browser-note-list"] tbody tr').first().click();
    await expect(page.getByTestId('study-browser-preview')).toBeVisible();
  });

  test('import flow shows a successful .colpkg upload and can return to study', async ({
    page,
  }) => {
    await loginAsUser(page);

    await page.route('**/api/study/imports', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'import-1',
          status: 'completed',
          sourceFilename: 'japanese.colpkg',
          deckName: '日本語',
          importedAt: '2026-04-22T18:00:00.000Z',
          errorMessage: null,
          preview: {
            deckName: '日本語',
            noteCount: 4,
            cardCount: 6,
            reviewLogCount: 3,
            mediaReferenceCount: 8,
            skippedMediaCount: 1,
            warnings: ['nested/0: Skipped unsafe archive entry.'],
            noteTypeBreakdown: [],
          },
        }),
      });
    });

    await page.goto('/app/study/import');
    await expect(page.getByRole('heading', { name: 'Import Anki deck' })).toBeVisible();

    await page.getByLabel('Anki collection backup').setInputFiles({
      name: 'japanese.colpkg',
      mimeType: 'application/zip',
      buffer: Buffer.from('PK\x03\x04fixture'),
    });
    await page.getByRole('button', { name: 'Import .colpkg' }).click();

    await expect(page.getByText('Imported 6 cards and 3 review logs from 日本語.')).toBeVisible();
    await expect(page.getByText('Skipped 1 unsafe or missing media reference.')).toBeVisible();

    await page.getByRole('link', { name: 'Back to Study' }).click();
    await expect(page).toHaveURL(/\/app\/study$/);
    await expect(page.getByRole('button', { name: 'Begin Study' })).toBeVisible();
  });
});
