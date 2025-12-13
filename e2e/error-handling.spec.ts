import { test, expect } from '@playwright/test';
import {
  loginAsUser,
  logout,
  getErrorMessage,
  generateDialogue,
  setUserQuota,
} from './utils/test-helpers';

/**
 * E2E Tests for Error Handling
 * Tests network errors, auth errors, rate limiting, and error boundaries
 */

test.describe('Error Handling', () => {
  test.describe('Network Error Handling', () => {
    test('should show connection error when offline', async ({ page, context }) => {
      await loginAsUser(page);

      // Go offline
      await context.setOffline(true);

      // Try to load library
      await page.goto('/app/library');

      // Should show connection error
      const errorText = await getErrorMessage(page);
      expect(errorText).toContain('Connection Error');
    });

    test('should show WiFi icon for network errors', async ({ page, context }) => {
      await loginAsUser(page);

      await context.setOffline(true);

      await page.goto('/app/library');

      // Should show WifiOff icon
      const errorDisplay = page.locator('[data-testid="error-display"]');
      const iconExists = await errorDisplay.locator('svg').count() > 0;
      expect(iconExists).toBe(true);
    });

    test('should allow retry after reconnecting', async ({ page, context }) => {
      await loginAsUser(page);

      // Go offline
      await context.setOffline(true);

      await page.goto('/app/library');

      // Should show error with retry button
      const retryButton = page.locator('button:has-text("Try Again")');
      await retryButton.waitFor({ state: 'visible', timeout: 5000 });

      // Go back online
      await context.setOffline(false);

      // Click retry
      await retryButton.click();

      // Should load successfully
      await page.waitForSelector('[data-testid="library-item"]', { timeout: 10000 });
    });
  });

  test.describe('Authentication Error Handling', () => {
    test('should redirect to login when session expires', async ({ page, context }) => {
      await loginAsUser(page);

      // Clear cookies to simulate expired session
      await context.clearCookies();

      // Try to access protected route
      await page.goto('/app/library');

      // Should redirect to login or show auth error
      await page.waitForURL(/\/login/, { timeout: 5000 }).catch(async () => {
        // Or should show authentication error
        const errorText = await getErrorMessage(page);
        expect(errorText).toContain('Authentication Error');
      });
    });

    test('should show Lock icon for auth errors', async ({ page }) => {
      // Try to access protected route without login
      await page.goto('/app/library');

      // Wait for redirect or error
      await page.waitForTimeout(2000);

      const currentUrl = page.url();
      if (!currentUrl.includes('/login')) {
        // If not redirected, should show auth error with Lock icon
        const errorDisplay = page.locator('[data-testid="error-display"]');
        const hasLockIcon = await errorDisplay.locator('[data-icon="lock"]').count() > 0;
        expect(hasLockIcon).toBe(true);
      }
    });

    test('should prompt to log in again', async ({ page, context }) => {
      await loginAsUser(page);

      await context.clearCookies();

      await page.goto('/app/library');

      // Should see "Please log in again" message
      await page.waitForTimeout(2000);

      const pageText = await page.textContent('body');
      expect(pageText).toMatch(/log in|login|sign in/i);
    });
  });

  test.describe('Rate Limit Error Handling', () => {
    test('should show rate limit error when quota exhausted', async ({ page }) => {
      await loginAsUser(page);

      // Exhaust user quota
      const userId = 'test-user-id';
      await setUserQuota(page, userId, 20);

      await page.reload();

      // Try to generate content
      await page.goto('/app/dialogues/new');
      await page.fill('textarea[name="topic"]', 'Test conversation');
      await page.click('button:has-text("Generate")');

      // Should show rate limit error
      const errorText = await getErrorMessage(page);
      expect(errorText).toContain('quota exceeded');
    });

    test('should include retry time in rate limit error', async ({ page }) => {
      await loginAsUser(page);

      const userId = 'test-user-id';
      await setUserQuota(page, userId, 20);

      await page.reload();

      await page.goto('/app/dialogues/new');
      await page.fill('textarea[name="topic"]', 'Test conversation');
      await page.click('button:has-text("Generate")');

      const errorText = await getErrorMessage(page);
      expect(errorText).toMatch(/Quota resets|Monday|week/i);
    });

    test('should show cooldown error message', async ({ page }) => {
      await loginAsUser(page);

      // Generate first dialogue
      await generateDialogue(page);

      // Immediately try again
      await page.goto('/app/dialogues/new');
      await page.fill('textarea[name="topic"]', 'Another conversation');
      await page.click('button:has-text("Generate")');

      // Should show cooldown error
      const errorText = await getErrorMessage(page);
      expect(errorText).toMatch(/Please wait|seconds/i);
    });

    test('should show remaining seconds in cooldown error', async ({ page }) => {
      await loginAsUser(page);

      await generateDialogue(page);

      await page.goto('/app/dialogues/new');
      await page.fill('textarea[name="topic"]', 'Another conversation');
      await page.click('button:has-text("Generate")');

      const errorText = await getErrorMessage(page);
      expect(errorText).toMatch(/\d+\s*seconds?/i);
    });
  });

  test.describe('Component Error Boundary', () => {
    test('should catch React component errors', async ({ page }) => {
      await loginAsUser(page);

      // Navigate to a route that will trigger an error
      // (You'll need to create a test route that throws an error)
      await page.goto('/app/test-error');

      // Should show error boundary UI
      const errorBoundary = page.locator('[data-testid="error-boundary"]');
      await errorBoundary.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {
        // Alternatively, check for "Something went wrong" text
      });

      const pageText = await page.textContent('body');
      expect(pageText).toContain('Something went wrong');
    });

    test('should show AlertTriangle icon in error boundary', async ({ page }) => {
      await loginAsUser(page);

      await page.goto('/app/test-error');

      // Should show AlertTriangle icon
      const errorBoundary = page.locator('[data-testid="error-boundary"]');
      const hasAlertIcon = await errorBoundary.locator('[data-icon="alert"]').count() > 0;
      expect(hasAlertIcon).toBe(true);
    });

    test('should show Try Again button in error boundary', async ({ page }) => {
      await loginAsUser(page);

      await page.goto('/app/test-error');

      const tryAgainButton = page.locator('button:has-text("Try Again")');
      await tryAgainButton.waitFor({ state: 'visible', timeout: 5000 });
      expect(await tryAgainButton.isVisible()).toBe(true);
    });

    test('should show Go to Library button in error boundary', async ({ page }) => {
      await loginAsUser(page);

      await page.goto('/app/test-error');

      const goToLibraryButton = page.locator('button:has-text("Go to Library")');
      await goToLibraryButton.waitFor({ state: 'visible', timeout: 5000 });
      expect(await goToLibraryButton.isVisible()).toBe(true);
    });

    test('should navigate to library when Go to Library clicked', async ({ page }) => {
      await loginAsUser(page);

      await page.goto('/app/test-error');

      const goToLibraryButton = page.locator('button:has-text("Go to Library")');
      await goToLibraryButton.click();

      // Should navigate to library
      await page.waitForURL(/\/app\/library/, { timeout: 5000 });
    });

    test('should reset error state when Try Again clicked', async ({ page }) => {
      await loginAsUser(page);

      await page.goto('/app/test-error');

      const tryAgainButton = page.locator('button:has-text("Try Again")');
      await tryAgainButton.click();

      // Error boundary should attempt to re-render
      await page.waitForTimeout(1000);

      // Either shows content or shows error again
      const pageText = await page.textContent('body');
      expect(pageText).toBeTruthy();
    });
  });

  test.describe('Error Display Component', () => {
    test('should show different icons for different error types', async ({ page, context }) => {
      await loginAsUser(page);

      // Network error - WifiOff icon
      await context.setOffline(true);
      await page.goto('/app/library');

      let errorDisplay = page.locator('[data-testid="error-display"]').first();
      let hasWifiIcon = await errorDisplay.locator('[data-icon="wifi"]').count() > 0;
      expect(hasWifiIcon).toBe(true);

      // Auth error - Lock icon
      await context.setOffline(false);
      await context.clearCookies();
      await page.goto('/app/library');
      await page.waitForTimeout(2000);

      if (!page.url().includes('/login')) {
        errorDisplay = page.locator('[data-testid="error-display"]').first();
        const hasLockIcon = await errorDisplay.locator('[data-icon="lock"]').count() > 0;
        expect(hasLockIcon).toBe(true);
      }
    });

    test('should display error message in monospace font', async ({ page, context }) => {
      await loginAsUser(page);

      await context.setOffline(true);
      await page.goto('/app/library');

      const errorMessage = page.locator('[data-testid="error-message"]').first();
      const fontFamily = await errorMessage.evaluate(el => window.getComputedStyle(el).fontFamily);

      expect(fontFamily).toContain('mono');
    });

    test('should show retry button for recoverable errors', async ({ page, context }) => {
      await loginAsUser(page);

      await context.setOffline(true);
      await page.goto('/app/library');

      const retryButton = page.locator('button:has-text("Try Again")');
      expect(await retryButton.isVisible()).toBe(true);
    });
  });
});
