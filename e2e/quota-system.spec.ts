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
 * Tests tier-based quota enforcement (free: lifetime per-type, paid: 30/month), cooldown periods, and admin bypass
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
      // Badge should show quota info (format depends on tier - free tier shows per-type, paid shows combined)
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

      // Set quota to 1/2 for dialogues (50% usage - should be blue)
      const userId = 'test-user-id'; // You'll need to get actual user ID
      await clearUserQuota(page, userId);
      await setUserQuota(page, userId, 1);

      await page.reload();

      const badge = page.locator('[data-testid="quota-badge"]').first();
      const badgeClass = await badge.getAttribute('class');

      expect(badgeClass).toContain('bg-blue');
      expect(await badge.textContent()).toContain('1/2');
    });

    // Note: Skipping 80-89% orange badge test for free tier dialogue quota
    // Free tier has only 2 dialogues lifetime, so percentages are: 0/2=0%, 1/2=50%, 2/2=100%
    // There's no way to achieve 80-89% usage with only 2 items
    test.skip('should show orange badge with "Running low" when usage 80-89%', async ({ page }) => {
      // This test would need a paid tier user with 30/month quota to test 80-89% range (24-26 used)
      await loginAsUser(page);
    });

    test('should show red badge with "Low quota" when usage >= 90%', async ({ page }) => {
      await loginAsUser(page);

      // Set quota to 2/2 for dialogues (100% usage - should be red)
      const userId = 'test-user-id';
      await setUserQuota(page, userId, 2);

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

      // Set quota to 2/2 (exhausted for free tier dialogues)
      const userId = 'test-user-id';
      await setUserQuota(page, userId, 2);

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
      expect(errorText).toContain('2 of 2');
    });

    // Note: Free tier quotas are lifetime limits and never reset
    // Paid tier quotas reset on the 1st of each month
    test.skip('should show quota reset date in error message', async ({ page }) => {
      // This test would need to be updated for paid tier (monthly reset)
      // or removed since free tier quotas don't reset
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
