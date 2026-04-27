import { expect, test, type Page } from '@playwright/test';

import { expectNoHorizontalOverflow, loginAsUser } from './utils/test-helpers';

async function expectMobilePrimaryNavInUserMenu(page: Page) {
  await page.getByTestId('user-menu-button').click();
  await expect(page.getByTestId('user-menu-mobile-nav-library')).toBeVisible();
  await expect(page.getByTestId('user-menu-mobile-nav-create')).toBeVisible();
  // The e2e fixture enables flashcards, so Study should be present in mobile primary nav.
  await expect(page.getByTestId('user-menu-mobile-nav-study')).toBeVisible();
  await page.keyboard.press('Escape');
}

async function expectTopbarControlsDoNotOverlap(page: Page) {
  const logo = page.locator('nav a[href*="/app/library"]').first();
  const userMenu = page.getByTestId('user-menu-button');
  const logoBox = await logo.boundingBox();
  const userMenuBox = await userMenu.boundingBox();

  expect(logoBox).not.toBeNull();
  expect(userMenuBox).not.toBeNull();
  if (logoBox && userMenuBox) {
    expect(logoBox.x + logoBox.width).toBeLessThanOrEqual(userMenuBox.x);
  }
}

test.describe('Study mobile experience', () => {
  test('dashboard and focused review work on iPhone 13', async ({ page }) => {
    await loginAsUser(page);

    await page.goto('/app/study');
    await expect(page.getByRole('button', { name: 'Begin Study' })).toBeVisible();
    await expectTopbarControlsDoNotOverlap(page);
    await expectMobilePrimaryNavInUserMenu(page);
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: 'Begin Study' }).click();
    await expect(page.getByTestId('study-focus-shell')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: 'Reveal answer' }).click();
    const reviewHeader = page.getByTestId('study-review-header');
    const reviewHeaderBox = await reviewHeader.boundingBox();
    expect(reviewHeaderBox).not.toBeNull();
    if (reviewHeaderBox) {
      expect(reviewHeaderBox.height).toBeLessThanOrEqual(44);
    }

    const gradeTray = page.getByTestId('study-grade-tray');
    await expect(gradeTray).toBeVisible();
    const gradeTrayBox = await gradeTray.boundingBox();
    const viewport = page.viewportSize();
    expect(gradeTrayBox).not.toBeNull();
    expect(viewport).not.toBeNull();
    if (gradeTrayBox && viewport) {
      expect(gradeTrayBox.y + gradeTrayBox.height).toBeGreaterThanOrEqual(viewport.height - 2);
      expect(gradeTrayBox.y).toBeGreaterThan(viewport.height - 120);
      expect(gradeTrayBox.height).toBeLessThanOrEqual(64);
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

    const answerAudioButton = page.getByTestId('study-answer-audio-button');
    if ((await answerAudioButton.count()) > 0) {
      await expect(answerAudioButton).toBeVisible();
      await expect(answerAudioButton).toHaveAccessibleName('Play answer audio');
      const audioBox = await answerAudioButton.boundingBox();
      const viewport = page.viewportSize();
      expect(audioBox).not.toBeNull();
      expect(viewport).not.toBeNull();
      if (audioBox && viewport) {
        expect(audioBox.x + audioBox.width).toBeLessThanOrEqual(viewport.width + 1);
        expect(audioBox.height).toBeLessThanOrEqual(64);
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

  test('create route smokes cleanly on mobile', async ({ page }) => {
    await loginAsUser(page);

    await page.goto('/app/study/create');
    await expect(page.getByRole('heading', { name: 'Create study card' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('retired history route intentionally renders 404', async ({ page }) => {
    await loginAsUser(page);

    await page.goto('/app/study/history');
    await expect(page.getByText('404')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Page Not Found' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Study history' })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });
});

test.describe('Study mobile narrow overflow checks', () => {
  test('dashboard and browse avoid horizontal overflow at 320px', async ({ page }) => {
    await loginAsUser(page);
    await page.setViewportSize({ width: 320, height: 844 });

    await page.goto('/app/study');
    await expect(page.getByRole('button', { name: 'Begin Study' })).toBeVisible();
    await expectTopbarControlsDoNotOverlap(page);
    await expectMobilePrimaryNavInUserMenu(page);
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
