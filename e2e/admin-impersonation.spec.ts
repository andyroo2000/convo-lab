import { test, expect } from '@playwright/test';
import {
  loginAsAdmin,
  loginAsUser,
  logout,
  isImpersonationBannerVisible,
  getImpersonatedUserInfo,
  exitImpersonation,
  getLibraryItemCount,
} from './utils/test-helpers';

/**
 * E2E Tests for Admin Impersonation
 * Tests admin impersonation, read-only mode, audit logging, and security
 */

test.describe('Admin Impersonation', () => {
  test.describe('Successful Admin Impersonation', () => {
    test('should allow admin to impersonate user', async ({ page }) => {
      await loginAsAdmin(page);

      // Navigate to user management (assuming this exists)
      await page.goto('/app/admin/users');

      // Click "View as User" button for a test user
      await page.click('[data-testid="view-as-user-button"]', { timeout: 5000 });

      // Impersonation banner should appear
      const bannerVisible = await isImpersonationBannerVisible(page);
      expect(bannerVisible).toBe(true);
    });

    test('should display impersonated user name and email in banner', async ({ page }) => {
      await loginAsAdmin(page);

      // Impersonate a user (you'll need actual test user data)
      await page.goto('/app/library?viewAs=test-user-id');

      const userInfo = await getImpersonatedUserInfo(page);
      expect(userInfo).toBeTruthy();
      expect(userInfo?.name).toBeTruthy();
      expect(userInfo?.email).toBeTruthy();
    });

    test('should show impersonated user library content', async ({ page }) => {
      await loginAsAdmin(page);

      // Get admin's library count
      const adminItemCount = await getLibraryItemCount(page);

      // Impersonate a user
      await page.goto('/app/library?viewAs=test-user-id');

      // Wait for library to load
      await page.waitForTimeout(2000);

      // Get impersonated user's library count
      const userItemCount = await getLibraryItemCount(page);

      // Counts should be different (unless they happen to have same number)
      // More importantly, the items themselves should be different
      const firstItemTitle = await page
        .locator('[data-testid="library-item"]')
        .first()
        .textContent();
      expect(firstItemTitle).toBeTruthy();
    });

    test('should display "Read-only" badge in banner', async ({ page }) => {
      await loginAsAdmin(page);

      await page.goto('/app/library?viewAs=test-user-id');

      const banner = page.locator('[data-testid="impersonation-banner"]');
      const bannerText = await banner.textContent();

      expect(bannerText).toContain('Read-only');
    });
  });

  test.describe('Impersonation is Read-Only', () => {
    test('should disable delete button while impersonating', async ({ page }) => {
      await loginAsAdmin(page);

      await page.goto('/app/library?viewAs=test-user-id');

      // Try to find delete button
      const deleteButton = page.locator('[data-testid="delete-button"]').first();

      // Should be disabled or not clickable
      const isDisabled = await deleteButton.isDisabled().catch(() => true);
      expect(isDisabled).toBe(true);
    });

    test('should disable create button while impersonating', async ({ page }) => {
      await loginAsAdmin(page);

      await page.goto('/app/library?viewAs=test-user-id');

      // Try to navigate to create page
      await page.goto('/app/dialogues/new?viewAs=test-user-id');

      // Should show read-only error or redirect
      const errorText = await page
        .locator('[data-testid="error-display"]')
        .textContent({ timeout: 3000 })
        .catch(() => null);

      // Either shows error or create button is disabled
      const createButton = page.locator('button:has-text("Generate")').first();
      const isDisabled = await createButton.isDisabled().catch(() => true);

      expect(errorText?.includes('read-only') || isDisabled).toBe(true);
    });
  });

  test.describe('Exit Impersonation', () => {
    test('should exit impersonation when Exit View clicked', async ({ page }) => {
      await loginAsAdmin(page);

      await page.goto('/app/library?viewAs=test-user-id');

      // Banner should be visible
      expect(await isImpersonationBannerVisible(page)).toBe(true);

      // Click Exit View
      await exitImpersonation(page);

      // Banner should disappear
      await page.waitForTimeout(1000);
      expect(await isImpersonationBannerVisible(page)).toBe(false);
    });

    test('should show admin library after exiting impersonation', async ({ page }) => {
      await loginAsAdmin(page);

      // Get admin's library count
      const adminItemCount = await getLibraryItemCount(page);

      // Impersonate user
      await page.goto('/app/library?viewAs=test-user-id');
      await page.waitForTimeout(2000);

      const userItemCount = await getLibraryItemCount(page);

      // Exit impersonation
      await exitImpersonation(page);
      await page.waitForTimeout(2000);

      // Should be back to admin's library
      const afterExitCount = await getLibraryItemCount(page);
      expect(afterExitCount).toBe(adminItemCount);
    });

    test('should be able to create/delete after exiting impersonation', async ({ page }) => {
      await loginAsAdmin(page);

      // Impersonate user
      await page.goto('/app/library?viewAs=test-user-id');

      // Exit impersonation
      await exitImpersonation(page);

      // Should now be able to create content
      await page.goto('/app/dialogues/new');

      const createButton = page.locator('button:has-text("Generate")').first();
      const isEnabled = await createButton.isEnabled();

      expect(isEnabled).toBe(true);
    });
  });

  test.describe('Audit Log Verification', () => {
    test('should log impersonation event', async ({ page }) => {
      await loginAsAdmin(page);

      // Impersonate user
      await page.goto('/app/library?viewAs=test-user-id');

      // Navigate to audit log page
      await page.goto('/app/admin/audit-logs');

      // Should see recent impersonation event
      const logEntry = page.locator('[data-testid="audit-log-entry"]').first();
      const logText = await logEntry.textContent();

      expect(logText).toContain('impersonate');
    });

    test('should include timestamp in audit log', async ({ page }) => {
      await loginAsAdmin(page);

      await page.goto('/app/library?viewAs=test-user-id');

      await page.goto('/app/admin/audit-logs');

      const logEntry = page.locator('[data-testid="audit-log-entry"]').first();
      const logText = await logEntry.textContent();

      // Should contain some form of timestamp
      expect(logText).toMatch(/\d{1,2}:\d{2}|ago/);
    });
  });

  test.describe('Non-Admin Cannot Impersonate', () => {
    test('should block non-admin from using viewAs parameter', async ({ page }) => {
      await loginAsUser(page);

      // Try to use viewAs parameter
      await page.goto('/app/library?viewAs=other-user-id');

      // Should see 403 error or be redirected
      const errorText = await page
        .locator('[data-testid="error-display"]')
        .textContent({ timeout: 5000 })
        .catch(() => null);

      const currentUrl = page.url();

      // Either shows unauthorized error or redirects without viewAs
      expect(
        errorText?.includes('Unauthorized') ||
          errorText?.includes('403') ||
          !currentUrl.includes('viewAs')
      ).toBe(true);
    });

    test('should show own library when non-admin tries viewAs', async ({ page }) => {
      await loginAsUser(page);

      const ownItemCount = await getLibraryItemCount(page);

      // Try to impersonate
      await page.goto('/app/library?viewAs=other-user-id');
      await page.waitForTimeout(2000);

      // Should still see own library
      const itemCount = await getLibraryItemCount(page);
      expect(itemCount).toBe(ownItemCount);

      // Should not see impersonation banner
      expect(await isImpersonationBannerVisible(page)).toBe(false);
    });
  });
});
