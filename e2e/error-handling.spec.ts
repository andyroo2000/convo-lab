import { test, expect } from '@playwright/test';
import { loginAsUser, getErrorMessage } from './utils/test-helpers';

test.describe('Error Handling', () => {
  test.describe('Authentication Error Handling', () => {
    test('should redirect to login when session expires', async ({ page, context }) => {
      await loginAsUser(page);

      // Clear cookies to simulate expired session
      await context.clearCookies();

      // Try to access protected route
      await page.goto('/app/study');

      // Should redirect to login or show auth error
      await page.waitForURL(/\/login/, { timeout: 5000 }).catch(async () => {
        // Or should show authentication error
        const errorText = await getErrorMessage(page);
        expect(errorText).toContain('Authentication Error');
      });
    });

    test('should show Lock icon for auth errors', async ({ page }) => {
      // Try to access protected route without login
      await page.goto('/app/study');

      // Wait for redirect or error
      await page.waitForTimeout(2000);

      const currentUrl = page.url();
      if (!currentUrl.includes('/login')) {
        // If not redirected, should show auth error with Lock icon
        const errorDisplay = page.locator('[data-testid="error-display"]');
        const hasLockIcon = (await errorDisplay.locator('[data-icon="lock"]').count()) > 0;
        expect(hasLockIcon).toBe(true);
      }
    });

    test('should prompt to log in again', async ({ page, context }) => {
      await loginAsUser(page);

      await context.clearCookies();

      await page.goto('/app/study');

      // Should see "Please log in again" message
      await page.waitForTimeout(2000);

      const pageText = await page.textContent('body');
      expect(pageText).toMatch(/log in|login|sign in/i);
    });
  });
});
