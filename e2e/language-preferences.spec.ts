import { test, expect } from '@playwright/test';
import { loginAsUser, waitForLoadingComplete } from './utils/test-helpers';

/**
 * E2E Tests for Language Preferences
 * Tests JLPT selection, auto-application to forms, and narrator voice defaults
 * Note: This app is Japanese-only, so study language is always 'ja' and native language is always 'en'
 */

test.describe('Language Preferences', () => {
  test.describe('Verify Language Settings', () => {
    test('should show Japanese as study language', async ({ page }) => {
      await loginAsUser(page);

      // Navigate to Settings
      await page.goto('/app/settings');
      await waitForLoadingComplete(page);

      // Verify study language is Japanese
      const selectedValue = await page.inputValue('[name="studyLanguage"]');
      expect(selectedValue).toBe('ja');
    });

    test('should show English as native language', async ({ page }) => {
      await loginAsUser(page);

      await page.goto('/app/settings');
      await waitForLoadingComplete(page);

      // Verify native language is English
      const selectedValue = await page.inputValue('[name="nativeLanguage"]');
      expect(selectedValue).toBe('en');
    });

    test('should show language badge in header', async ({ page }) => {
      await loginAsUser(page);

      await page.goto('/app/settings');
      await waitForLoadingComplete(page);

      // Navigate away
      await page.goto('/app/library');

      // Should show JA badge in header
      const languageBadge = page.locator('[data-testid="language-badge"]');
      const badgeText = await languageBadge.textContent();
      expect(badgeText).toContain('JA');
    });
  });

  test.describe('JLPT Level Selection', () => {
    test('should show JLPT level selector', async ({ page }) => {
      await loginAsUser(page);

      await page.goto('/app/settings');
      await waitForLoadingComplete(page);

      // JLPT level selector should be visible
      const jlptSelector = page.locator('[data-testid="settings-select-jlpt-level"]');
      await expect(jlptSelector).toBeVisible();
    });

    test('should allow changing JLPT level', async ({ page }) => {
      await loginAsUser(page);

      await page.goto('/app/settings');
      await waitForLoadingComplete(page);

      // Change JLPT level
      const jlptSelector = page.locator('[data-testid="settings-select-jlpt-level"]');
      await jlptSelector.selectOption('N3');

      // Wait for auto-save
      await page.waitForTimeout(1000);

      // Verify it was saved
      const selectedValue = await jlptSelector.inputValue();
      expect(selectedValue).toBe('N3');
    });

    test('should persist JLPT level after reload', async ({ page }) => {
      await loginAsUser(page);

      await page.goto('/app/settings');
      await waitForLoadingComplete(page);

      // Change JLPT level
      const jlptSelector = page.locator('[data-testid="settings-select-jlpt-level"]');
      await jlptSelector.selectOption('N2');
      await page.waitForTimeout(1000);

      // Reload page
      await page.reload();
      await waitForLoadingComplete(page);

      // Should persist
      const selectedValue = await page
        .locator('[data-testid="settings-select-jlpt-level"]')
        .inputValue();
      expect(selectedValue).toBe('N2');
    });
  });

  test.describe('Preferences Auto-Apply to Forms', () => {
    test('should not show language selector in dialogue form', async ({ page }) => {
      await loginAsUser(page);

      // Navigate to create dialogue
      await page.goto('/app/dialogues/new');

      // Language selectors should not be visible
      const studyLanguageSelector = page.locator('[name="studyLanguage"]');
      const isVisible = await studyLanguageSelector.isVisible().catch(() => false);
      expect(isVisible).toBe(false);
    });

    test('should use Japanese for dialogue generation', async ({ page }) => {
      await loginAsUser(page);

      // Create dialogue
      await page.goto('/app/dialogues/new');
      await page.fill('textarea[name="topic"]', 'Test conversation about food');
      await page.click('button:has-text("Generate")');

      // Wait for generation
      await page.waitForSelector('[data-testid="dialogue-result"]', { timeout: 60000 });

      // Check that content is in Japanese
      const dialogueContent = await page
        .locator('[data-testid="dialogue-line"]')
        .first()
        .textContent();

      // Should contain Japanese characters
      expect(dialogueContent).toMatch(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/);
    });
  });

  test.describe('Default Narrator Voice Selection', () => {
    test('should select English narrator for English native language', async ({ page }) => {
      await loginAsUser(page);

      await page.goto('/app/dialogues/new');

      const narratorVoice = await page.inputValue('[name="narratorVoice"]');
      expect(narratorVoice).toMatch(/brian|english|american/i);
    });

    test('should allow manual override of narrator voice', async ({ page }) => {
      await loginAsUser(page);

      await page.goto('/app/dialogues/new');

      // Manually change narrator
      await page.selectOption('[name="narratorVoice"]', 'spanish-sergio');

      const narratorVoice = await page.inputValue('[name="narratorVoice"]');
      expect(narratorVoice).toContain('sergio');
    });
  });

  test.describe('Language Preference Persistence', () => {
    test('should persist preferences across sessions', async ({ page, context }) => {
      await loginAsUser(page);

      // Verify preferences
      await page.goto('/app/settings');
      await waitForLoadingComplete(page);

      const studyLang = await page.inputValue('[name="studyLanguage"]');
      const nativeLang = await page.inputValue('[name="nativeLanguage"]');

      expect(studyLang).toBe('ja');
      expect(nativeLang).toBe('en');
    });
  });
});
