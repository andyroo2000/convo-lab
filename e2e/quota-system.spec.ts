import { test, expect } from '@playwright/test';
import {
  loginAsUser,
  loginAsAdmin,
  logout,
  waitForQuotaBadge,
  generateDialogue,
  clearUserQuota,
  clearCooldowns,
  setUserQuota,
  wait,
} from './utils/test-helpers';

/**
 * E2E Tests for Quota System
 * Tests monthly quota enforcement, cooldown periods, and admin bypass.
 */

test.describe('Quota System', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing cooldowns before each test
    await clearCooldowns(page);
  });

  test.describe('Regular User Quota Enforcement', () => {
    test('should display initial quota badge', async ({ page }) => {
      await loginAsUser(page);

      const quotaText = await waitForQuotaBadge(page);
      expect(quotaText).toBeTruthy();
      expect(quotaText).toMatch(/\d+/); // Should contain numbers
    });

    test('should update quota badge after generation', async ({ page }) => {
      await loginAsUser(page);

      const initialQuota = await waitForQuotaBadge(page);
      const initialMatch = initialQuota?.match(/(\d+)\/(\d+)/);
      const initialRemaining = initialMatch ? parseInt(initialMatch[1]) : 0;

      // Generate content
      await generateDialogue(page);

      // Wait for quota to update
      await wait(2000);
      await page.reload();

      const updatedQuota = await waitForQuotaBadge(page);
      const updatedMatch = updatedQuota?.match(/(\d+)\/(\d+)/);
      const updatedRemaining = updatedMatch ? parseInt(updatedMatch[1]) : 0;

      expect(updatedRemaining).toBe(initialRemaining - 1);
    });

    test('should show blue badge when usage < 80%', async ({ page }) => {
      await loginAsUser(page);

      // One generation used is below 80% of the default monthly limit.
      const userId = 'test-user-id'; // You'll need to get actual user ID
      await clearUserQuota(page, userId);
      await setUserQuota(page, userId, 1);

      await page.reload();

      const badge = page.locator('[data-testid="quota-badge"]').first();
      const badgeClass = await badge.getAttribute('class');

      expect(badgeClass).toContain('bg-blue');
      expect(await badge.textContent()).toContain('29/30');
    });

    test('should show orange badge with "Running low" when usage 80-89%', async ({ page }) => {
      await loginAsUser(page);

      const userId = 'test-user-id';
      await setUserQuota(page, userId, 24);
      await page.reload();

      const badge = page.locator('[data-testid="quota-badge"]').first();
      expect(await badge.getAttribute('class')).toContain('bg-orange');
      expect(await badge.textContent()).toContain('6/30');
    });

    test('should show red badge with "Low quota" when usage >= 90%', async ({ page }) => {
      await loginAsUser(page);

      // Twenty-seven generations is 90% of the default monthly limit.
      const userId = 'test-user-id';
      await setUserQuota(page, userId, 27);

      await page.reload();

      const badge = page.locator('[data-testid="quota-badge"]').first();
      const badgeClass = await badge.getAttribute('class');

      expect(badgeClass).toContain('bg-red');
      expect(await page.textContent('body')).toContain('Low quota');
    });
  });

  test.describe('Cooldown Enforcement', () => {
    test('should enforce 30-second cooldown between generations', async ({ page }) => {
      await loginAsUser(page);

      // First generation
      await generateDialogue(page);

      // Immediately try to generate again
      await page.goto('/app/dialogues/new');
      await page.fill('textarea[name="topic"]', 'Another test conversation');
      await page.click('button:has-text("Generate")');

      // Should see cooldown error
      const errorText = await page
        .locator('[data-testid="error-display"]')
        .textContent({ timeout: 5000 });
      expect(errorText).toContain('Please wait');
      expect(errorText).toContain('seconds');
    });

    test('should allow generation after cooldown expires', async ({ page }) => {
      await loginAsUser(page);

      // First generation
      await generateDialogue(page);

      // Wait for cooldown to expire (30 seconds + buffer)
      await wait(32000);

      // Try to generate again
      await page.goto('/app/dialogues/new');
      await page.fill('textarea[name="topic"]', 'Another test conversation');
      await page.click('button:has-text("Generate")');

      // Should succeed this time
      await page.waitForSelector('[data-testid="dialogue-result"]', { timeout: 60000 });
    });
  });

  test.describe('Quota Exhaustion', () => {
    test('should block generation when quota exhausted', async ({ page }) => {
      await loginAsUser(page);

      // Exhaust the default monthly limit.
      const userId = 'test-user-id';
      await setUserQuota(page, userId, 30);

      await page.reload();

      // Try to generate
      await page.goto('/app/dialogues/new');
      await page.fill('textarea[name="topic"]', 'Test conversation');
      await page.click('button:has-text("Generate")');

      // Should see quota exceeded error
      const errorText = await page
        .locator('[data-testid="error-display"]')
        .textContent({ timeout: 5000 });
      expect(errorText).toContain('Quota exceeded');
      expect(errorText).toContain('30 of 30');
    });

    test.skip('should show quota reset date in error message', async ({ page }) => {
      await loginAsUser(page);
    });
  });

  test.describe('Admin Bypass', () => {
    test('should not show quota badge for admin users', async ({ page }) => {
      await loginAsAdmin(page);

      const quotaText = await waitForQuotaBadge(page);
      expect(quotaText).toBeNull(); // Admin should not see quota badge
    });

    test('should allow unlimited generations for admin', async ({ page }) => {
      await loginAsAdmin(page);

      // Generate multiple times without cooldown
      for (let i = 0; i < 3; i++) {
        await generateDialogue(page);
        // No wait needed - admins bypass cooldown
      }

      // All should succeed
      expect(await page.textContent('body')).not.toContain('quota exceeded');
    });
  });
});
