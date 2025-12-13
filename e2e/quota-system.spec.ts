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
 * Tests weekly quota enforcement, cooldown periods, and admin bypass
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
      expect(quotaText).toContain('generations left this week');
    });

    test('should update quota badge after generation', async ({ page }) => {
      await loginAsUser(page);

      const initialQuota = await waitForQuotaBadge(page);
      const initialMatch = initialQuota?.match(/(\d+)\/20/);
      const initialRemaining = initialMatch ? parseInt(initialMatch[1]) : 20;

      // Generate content
      await generateDialogue(page);

      // Wait for quota to update
      await wait(2000);
      await page.reload();

      const updatedQuota = await waitForQuotaBadge(page);
      const updatedMatch = updatedQuota?.match(/(\d+)\/20/);
      const updatedRemaining = updatedMatch ? parseInt(updatedMatch[1]) : 20;

      expect(updatedRemaining).toBe(initialRemaining - 1);
    });

    test('should show blue badge when usage < 80%', async ({ page }) => {
      await loginAsUser(page);

      // Set quota to 15/20 (75% usage)
      const userId = 'test-user-id'; // You'll need to get actual user ID
      await clearUserQuota(page, userId);
      await setUserQuota(page, userId, 5);

      await page.reload();

      const badge = page.locator('[data-testid="quota-badge"]').first();
      const badgeClass = await badge.getAttribute('class');

      expect(badgeClass).toContain('bg-blue');
      expect(await badge.textContent()).toContain('15/20');
    });

    test('should show orange badge with "Running low" when usage 80-89%', async ({ page }) => {
      await loginAsUser(page);

      // Set quota to 4/20 remaining (80% usage)
      const userId = 'test-user-id';
      await setUserQuota(page, userId, 16);

      await page.reload();

      const badge = page.locator('[data-testid="quota-badge"]').first();
      const badgeClass = await badge.getAttribute('class');

      expect(badgeClass).toContain('bg-orange');
      expect(await page.textContent('body')).toContain('Running low');
    });

    test('should show red badge with "Low quota" when usage >= 90%', async ({ page }) => {
      await loginAsUser(page);

      // Set quota to 2/20 remaining (90% usage)
      const userId = 'test-user-id';
      await setUserQuota(page, userId, 18);

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
      const errorText = await page.locator('[data-testid="error-display"]').textContent({ timeout: 5000 });
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

      // Set quota to 20/20 (exhausted)
      const userId = 'test-user-id';
      await setUserQuota(page, userId, 20);

      await page.reload();

      // Try to generate
      await page.goto('/app/dialogues/new');
      await page.fill('textarea[name="topic"]', 'Test conversation');
      await page.click('button:has-text("Generate")');

      // Should see quota exceeded error
      const errorText = await page.locator('[data-testid="error-display"]').textContent({ timeout: 5000 });
      expect(errorText).toContain('Weekly quota exceeded');
      expect(errorText).toContain('20 of 20');
    });

    test('should show quota reset date in error message', async ({ page }) => {
      await loginAsUser(page);

      // Set quota to 20/20 (exhausted)
      const userId = 'test-user-id';
      await setUserQuota(page, userId, 20);

      await page.reload();

      // Try to generate
      await page.goto('/app/dialogues/new');
      await page.fill('textarea[name="topic"]', 'Test conversation');
      await page.click('button:has-text("Generate")');

      // Should show reset date
      const errorText = await page.locator('[data-testid="error-display"]').textContent({ timeout: 5000 });
      expect(errorText).toMatch(/Quota resets/i);
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
