import { expect, test } from '@playwright/test';

import { expectNoHorizontalOverflow, loginAsUser } from './utils/test-helpers';

test.describe('Study mobile experience', () => {
  test('dashboard and focused review work on iPhone 13', async ({ page }) => {
    await loginAsUser(page);

    await page.goto('/app/study');
    await expect(page.getByRole('heading', { name: 'Study', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Begin Study' })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: 'Begin Study' }).click();
    await expect(page.getByTestId('study-focus-shell')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: 'Reveal answer' }).click();
    const gradeTray = page.getByTestId('study-grade-tray');
    await expect(gradeTray).toBeVisible();
    const gradeTrayBox = await gradeTray.boundingBox();
    const viewport = page.viewportSize();
    expect(gradeTrayBox).not.toBeNull();
    expect(viewport).not.toBeNull();
    if (gradeTrayBox && viewport) {
      expect(gradeTrayBox.y + gradeTrayBox.height).toBeGreaterThanOrEqual(viewport.height - 2);
      expect(gradeTrayBox.y).toBeGreaterThan(viewport.height - 120);
    }

    const reviewActions = page.getByTestId('study-review-actions');
    await expect(reviewActions).toBeAttached();
    const reviewActionsBox = await reviewActions.boundingBox();
    if (reviewActionsBox && gradeTrayBox) {
      expect(reviewActionsBox.y).toBeGreaterThanOrEqual(gradeTrayBox.y - 4);
    }
    await reviewActions.scrollIntoViewIfNeeded();
    await expect(reviewActions).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit card' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Set due' })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const answerAudio = page.getByTestId('study-answer-audio');
    if ((await answerAudio.count()) > 0) {
      await expect(answerAudio).toBeVisible();
      const audioBox = await answerAudio.boundingBox();
      const viewport = page.viewportSize();
      expect(audioBox).not.toBeNull();
      expect(viewport).not.toBeNull();
      if (audioBox && viewport) {
        expect(audioBox.x + audioBox.width).toBeLessThanOrEqual(viewport.width + 1);
      }
    }

    await page.getByRole('button', { name: 'Set due' }).click();
    await expect(page.getByTestId('study-set-due-controls')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: 'Edit card' }).click();
    await expect(page.getByTestId('study-card-editor')).toBeVisible();
    await expect(page.getByLabel('Answer meaning')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('browse is usable on mobile and preserves maintenance actions', async ({ page }) => {
    await loginAsUser(page);

    await page.goto('/app/study/browse');
    await expect(page.getByRole('heading', { name: 'Browse cards' })).toBeVisible();
    await expect(page.getByTestId('study-browser-note-list')).toBeVisible();
    await expect(page.getByTestId('study-browser-detail')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const firstNote = page.getByTestId('study-browser-note-item').first();
    await firstNote.click();
    await expect(page.getByTestId('study-browser-preview')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Set due' })).toBeVisible();

    await page.getByRole('button', { name: 'Set due' }).click();
    await expect(page.getByTestId('study-set-due-controls')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: 'Edit' }).click();
    await expect(page.getByTestId('study-card-editor')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('create and history routes smoke cleanly on mobile', async ({ page }) => {
    await loginAsUser(page);

    await page.goto('/app/study/create');
    await expect(page.getByRole('heading', { name: 'Create study card' })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto('/app/study/history');
    await expect(page.getByRole('heading', { name: 'Study history' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

test.describe('Study mobile narrow overflow checks', () => {
  test('dashboard and browse avoid horizontal overflow at 320px', async ({ page }) => {
    await loginAsUser(page);
    await page.setViewportSize({ width: 320, height: 844 });

    await page.goto('/app/study');
    await expect(page.getByRole('heading', { name: 'Study', exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.getByRole('button', { name: 'Begin Study' }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await expect(page.getByTestId('study-grade-tray')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto('/app/study/browse');
    await expect(page.getByRole('heading', { name: 'Browse cards' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
