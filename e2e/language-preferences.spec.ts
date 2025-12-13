import { test, expect } from '@playwright/test';
import { loginAsUser, waitForLoadingComplete } from './utils/test-helpers';

/**
 * E2E Tests for Language Preferences
 * Tests centralized language selection, auto-application to forms, and narrator voice defaults
 */

test.describe('Language Preferences', () => {
  test.describe('Set Language Preferences', () => {
    test('should allow setting study language', async ({ page }) => {
      await loginAsUser(page);

      // Navigate to Settings
      await page.goto('/app/settings');
      await waitForLoadingComplete(page);

      // Select study language
      await page.selectOption('[name="studyLanguage"]', 'ja');

      // Wait for auto-save
      await page.waitForTimeout(1000);

      // Verify it was saved
      const selectedValue = await page.inputValue('[name="studyLanguage"]');
      expect(selectedValue).toBe('ja');
    });

    test('should allow setting native language', async ({ page }) => {
      await loginAsUser(page);

      await page.goto('/app/settings');
      await waitForLoadingComplete(page);

      // Select native language
      await page.selectOption('[name="nativeLanguage"]', 'en');

      await page.waitForTimeout(1000);

      const selectedValue = await page.inputValue('[name="nativeLanguage"]');
      expect(selectedValue).toBe('en');
    });

    test('should auto-save without save button', async ({ page }) => {
      await loginAsUser(page);

      await page.goto('/app/settings');
      await waitForLoadingComplete(page);

      // Change language
      await page.selectOption('[name="studyLanguage"]', 'es');

      // Reload page
      await page.reload();
      await waitForLoadingComplete(page);

      // Should persist
      const selectedValue = await page.inputValue('[name="studyLanguage"]');
      expect(selectedValue).toBe('es');
    });

    test('should show language badge in header', async ({ page }) => {
      await loginAsUser(page);

      await page.goto('/app/settings');
      await waitForLoadingComplete(page);

      // Set Japanese as study language
      await page.selectOption('[name="studyLanguage"]', 'ja');
      await page.waitForTimeout(1000);

      // Navigate away
      await page.goto('/app/library');

      // Should show JA badge in header
      const languageBadge = page.locator('[data-testid="language-badge"]');
      const badgeText = await languageBadge.textContent();
      expect(badgeText).toContain('JA');
    });

    test('should update language badge when preferences change', async ({ page }) => {
      await loginAsUser(page);

      await page.goto('/app/settings');

      // Set Japanese
      await page.selectOption('[name="studyLanguage"]', 'ja');
      await page.waitForTimeout(1000);

      await page.goto('/app/library');
      let badgeText = await page.locator('[data-testid="language-badge"]').textContent();
      expect(badgeText).toContain('JA');

      // Change to Spanish
      await page.goto('/app/settings');
      await page.selectOption('[name="studyLanguage"]', 'es');
      await page.waitForTimeout(1000);

      await page.goto('/app/library');
      badgeText = await page.locator('[data-testid="language-badge"]').textContent();
      expect(badgeText).toContain('ES');
    });
  });

  test.describe('Preferences Auto-Apply to Forms', () => {
    test('should not show language selector in dialogue form', async ({ page }) => {
      await loginAsUser(page);

      // Set preferences first
      await page.goto('/app/settings');
      await page.selectOption('[name="studyLanguage"]', 'ja');
      await page.selectOption('[name="nativeLanguage"]', 'en');
      await page.waitForTimeout(1000);

      // Navigate to create dialogue
      await page.goto('/app/dialogues/new');

      // Language selectors should not be visible
      const studyLanguageSelector = page.locator('[name="studyLanguage"]');
      const isVisible = await studyLanguageSelector.isVisible().catch(() => false);
      expect(isVisible).toBe(false);
    });

    test('should use preferences for dialogue generation', async ({ page }) => {
      await loginAsUser(page);

      // Set Japanese/English preferences
      await page.goto('/app/settings');
      await page.selectOption('[name="studyLanguage"]', 'ja');
      await page.selectOption('[name="nativeLanguage"]', 'en');
      await page.waitForTimeout(1000);

      // Create dialogue
      await page.goto('/app/dialogues/new');
      await page.fill('textarea[name="topic"]', 'Test conversation about food');
      await page.click('button:has-text("Generate")');

      // Wait for generation
      await page.waitForSelector('[data-testid="dialogue-result"]', { timeout: 60000 });

      // Check that content is in Japanese
      const dialogueContent = await page.locator('[data-testid="dialogue-line"]').first().textContent();

      // Should contain Japanese characters
      expect(dialogueContent).toMatch(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/);
    });

    test('should use preferences for course generation', async ({ page }) => {
      await loginAsUser(page);

      await page.goto('/app/settings');
      await page.selectOption('[name="studyLanguage"]', 'fr');
      await page.selectOption('[name="nativeLanguage"]', 'en');
      await page.waitForTimeout(1000);

      // Create course
      await page.goto('/app/courses/new');
      await page.fill('input[name="title"]', 'Test Course');
      await page.click('button:has-text("Generate")');

      await page.waitForSelector('[data-testid="course-result"]', { timeout: 60000 });

      // Course content should be in French
      const courseContent = await page.locator('[data-testid="course-content"]').first().textContent();

      // Should contain French characters or common French words
      expect(courseContent).toMatch(/[àâäæçéèêëïîôùûü]|le|la|les|de|et/i);
    });
  });

  test.describe('Prevent Same Language Selection', () => {
    test('should show validation error when selecting same language', async ({ page }) => {
      await loginAsUser(page);

      await page.goto('/app/settings');

      // Set both to Japanese
      await page.selectOption('[name="studyLanguage"]', 'ja');
      await page.selectOption('[name="nativeLanguage"]', 'ja');

      // Should show validation error
      const errorMessage = page.locator('[data-testid="validation-error"]');
      await errorMessage.waitFor({ state: 'visible', timeout: 3000 });

      const errorText = await errorMessage.textContent();
      expect(errorText).toMatch(/same|different/i);
    });

    test('should prevent saving invalid combination', async ({ page }) => {
      await loginAsUser(page);

      await page.goto('/app/settings');

      // Set both to Spanish
      await page.selectOption('[name="studyLanguage"]', 'es');
      await page.selectOption('[name="nativeLanguage"]', 'es');

      // Try to navigate away
      await page.goto('/app/library');

      // Go back to settings
      await page.goto('/app/settings');

      // Should not have saved the invalid combination
      const studyLang = await page.inputValue('[name="studyLanguage"]');
      const nativeLang = await page.inputValue('[name="nativeLanguage"]');

      expect(studyLang).not.toBe(nativeLang);
    });

    test('should clear error when valid combination selected', async ({ page }) => {
      await loginAsUser(page);

      await page.goto('/app/settings');

      // First, trigger error
      await page.selectOption('[name="studyLanguage"]', 'ja');
      await page.selectOption('[name="nativeLanguage"]', 'ja');

      // Error should appear
      await page.waitForSelector('[data-testid="validation-error"]', { timeout: 3000 });

      // Fix by changing native language
      await page.selectOption('[name="nativeLanguage"]', 'en');

      // Error should disappear
      await page.waitForSelector('[data-testid="validation-error"]', { state: 'hidden', timeout: 3000 });
    });
  });

  test.describe('Default Narrator Voice Selection', () => {
    test('should select Spanish narrator for Spanish native language', async ({ page }) => {
      await loginAsUser(page);

      // Set Spanish as native language
      await page.goto('/app/settings');
      await page.selectOption('[name="nativeLanguage"]', 'es');
      await page.waitForTimeout(1000);

      // Create dialogue
      await page.goto('/app/dialogues/new');

      // Check narrator voice dropdown
      const narratorVoice = await page.inputValue('[name="narratorVoice"]');
      expect(narratorVoice).toMatch(/sergio|spanish/i);
    });

    test('should select French narrator for French native language', async ({ page }) => {
      await loginAsUser(page);

      await page.goto('/app/settings');
      await page.selectOption('[name="nativeLanguage"]', 'fr');
      await page.waitForTimeout(1000);

      await page.goto('/app/dialogues/new');

      const narratorVoice = await page.inputValue('[name="narratorVoice"]');
      expect(narratorVoice).toMatch(/remi|french/i);
    });

    test('should select English narrator for English native language', async ({ page }) => {
      await loginAsUser(page);

      await page.goto('/app/settings');
      await page.selectOption('[name="nativeLanguage"]', 'en');
      await page.waitForTimeout(1000);

      await page.goto('/app/dialogues/new');

      const narratorVoice = await page.inputValue('[name="narratorVoice"]');
      expect(narratorVoice).toMatch(/brian|english|american/i);
    });

    test('should update narrator when native language changes', async ({ page }) => {
      await loginAsUser(page);

      // Start with Spanish
      await page.goto('/app/settings');
      await page.selectOption('[name="nativeLanguage"]', 'es');
      await page.waitForTimeout(1000);

      await page.goto('/app/dialogues/new');
      let narratorVoice = await page.inputValue('[name="narratorVoice"]');
      expect(narratorVoice).toMatch(/sergio|spanish/i);

      // Change to French
      await page.goto('/app/settings');
      await page.selectOption('[name="nativeLanguage"]', 'fr');
      await page.waitForTimeout(1000);

      await page.goto('/app/dialogues/new');
      narratorVoice = await page.inputValue('[name="narratorVoice"]');
      expect(narratorVoice).toMatch(/remi|french/i);
    });

    test('should allow manual override of narrator voice', async ({ page }) => {
      await loginAsUser(page);

      // Set default
      await page.goto('/app/settings');
      await page.selectOption('[name="nativeLanguage"]', 'en');
      await page.waitForTimeout(1000);

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

      // Set preferences
      await page.goto('/app/settings');
      await page.selectOption('[name="studyLanguage"]', 'ja');
      await page.selectOption('[name="nativeLanguage"]', 'en');
      await page.waitForTimeout(1000);

      // Close and reopen browser
      await context.close();

      // Create new context and login again
      const newPage = await context.newPage();
      await loginAsUser(newPage);

      await newPage.goto('/app/settings');
      await waitForLoadingComplete(newPage);

      // Preferences should persist
      const studyLang = await newPage.inputValue('[name="studyLanguage"]');
      const nativeLang = await newPage.inputValue('[name="nativeLanguage"]');

      expect(studyLang).toBe('ja');
      expect(nativeLang).toBe('en');
    });

    test('should apply persisted preferences to new content', async ({ page }) => {
      await loginAsUser(page);

      // Set preferences
      await page.goto('/app/settings');
      await page.selectOption('[name="studyLanguage"]', 'fr');
      await page.waitForTimeout(1000);

      // Reload page
      await page.reload();

      // Create new dialogue
      await page.goto('/app/dialogues/new');

      // Should use French
      await page.fill('textarea[name="topic"]', 'Test');
      await page.click('button:has-text("Generate")');

      await page.waitForSelector('[data-testid="dialogue-result"]', { timeout: 60000 });

      const dialogueContent = await page.locator('[data-testid="dialogue-line"]').first().textContent();
      expect(dialogueContent).toMatch(/[àâäæçéèêëïîôùûü]|le|la|les|de|et/i);
    });
  });
});
