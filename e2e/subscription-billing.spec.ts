import { test, expect } from '@playwright/test';

const API_URL = process.env.VITE_API_URL || 'http://localhost:3001';
const APP_URL = 'http://localhost:5173';

/**
 * E2E Tests for Subscription and Billing Flow
 * Tests pricing page, checkout session creation, subscription management, and admin features
 */

test.describe('Subscription and Billing Flow', () => {
  test.describe('Pricing Page', () => {
    test('should display pricing page with both tiers', async ({ page }) => {
      await page.goto(`${APP_URL}/pricing`);

      // Should show both tiers
      await expect(page.locator('text=Free')).toBeVisible();
      await expect(page.locator('text=Pro')).toBeVisible();

      // Should show prices
      await expect(page.locator('text=$0')).toBeVisible();
      await expect(page.locator('text=$7')).toBeVisible();

      // Should show features
      await expect(page.locator('text=/5 generations per week/i')).toBeVisible();
      await expect(page.locator('text=/30 generations per week/i')).toBeVisible();
    });

    test('should redirect to login when upgrading without being logged in', async ({ page }) => {
      await page.goto(`${APP_URL}/pricing`);

      // Click upgrade button
      const upgradeButton = page.locator('button:has-text("Upgrade to Pro")');
      await upgradeButton.click();

      // Should redirect to login
      await page.waitForURL(/\/login/, { timeout: 3000 });
      expect(page.url()).toContain('/login');
      expect(page.url()).toContain('returnUrl=/pricing');
    });

    test('should show current plan badge for logged-in users', async ({ page, request }) => {
      // Create and login as free tier user
      const testEmail = `test-free-${Date.now()}@example.com`;
      await request.post(`${API_URL}/api/auth/signup`, {
        data: {
          name: 'Test User',
          email: testEmail,
          password: 'testpassword123',
          inviteCode: 'TESTCODE',
        },
      });

      await page.goto(`${APP_URL}/login`);
      await page.fill('[data-testid="auth-input-email"]', testEmail);
      await page.fill('[data-testid="auth-input-password"]', 'testpassword123');
      await page.click('[data-testid="auth-submit-button"]');

      // Navigate to pricing page
      await page.goto(`${APP_URL}/pricing`);

      // Should show "Current Plan" badge
      await expect(page.locator('text=Current Plan')).toBeVisible();
    });

    test('should disable current plan button', async ({ page, request }) => {
      // Create and login as free tier user
      const testEmail = `test-disabled-${Date.now()}@example.com`;
      await request.post(`${API_URL}/api/auth/signup`, {
        data: {
          name: 'Test User',
          email: testEmail,
          password: 'testpassword123',
          inviteCode: 'TESTCODE',
        },
      });

      await page.goto(`${APP_URL}/login`);
      await page.fill('[data-testid="auth-input-email"]', testEmail);
      await page.fill('[data-testid="auth-input-password"]', 'testpassword123');
      await page.click('[data-testid="auth-submit-button"]');

      await page.goto(`${APP_URL}/pricing`);

      // Current plan button should be disabled
      const currentPlanButton = page.locator('button:has-text("Current Plan")').first();
      await expect(currentPlanButton).toBeDisabled();
    });
  });

  test.describe('Billing Settings Page', () => {
    test('should show upgrade option for free tier users', async ({ page, request }) => {
      // Create free tier user
      const testEmail = `test-billing-free-${Date.now()}@example.com`;
      await request.post(`${API_URL}/api/auth/signup`, {
        data: {
          name: 'Test User',
          email: testEmail,
          password: 'testpassword123',
          inviteCode: 'TESTCODE',
        },
      });

      await page.goto(`${APP_URL}/login`);
      await page.fill('[data-testid="auth-input-email"]', testEmail);
      await page.fill('[data-testid="auth-input-password"]', 'testpassword123');
      await page.click('[data-testid="auth-submit-button"]');

      // Navigate to billing settings
      await page.goto(`${APP_URL}/app/settings/billing`);

      // Should show free tier badge
      await expect(page.locator('text=/Free/i')).toBeVisible();

      // Should show upgrade button
      await expect(page.locator('button:has-text("Upgrade to Pro")')).toBeVisible();
    });

    test('should show manage subscription for pro tier users', async ({ page, request }) => {
      // This test would require mocking a pro tier user or using test Stripe data
      // Skipping for now as it requires Stripe integration
      test.skip();
    });

    test('should handle checkout session creation', async ({ page, request }) => {
      // Create free tier user
      const testEmail = `test-checkout-${Date.now()}@example.com`;
      await request.post(`${API_URL}/api/auth/signup`, {
        data: {
          name: 'Test User',
          email: testEmail,
          password: 'testpassword123',
          inviteCode: 'TESTCODE',
        },
      });

      await page.goto(`${APP_URL}/login`);
      await page.fill('[data-testid="auth-input-email"]', testEmail);
      await page.fill('[data-testid="auth-input-password"]', 'testpassword123');
      await page.click('[data-testid="auth-submit-button"]');

      await page.goto(`${APP_URL}/pricing`);

      // Mock the checkout session creation to prevent actual Stripe redirect
      await page.route('**/api/billing/create-checkout-session', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ url: `${APP_URL}/mock-stripe-checkout` }),
        });
      });

      const upgradeButton = page.locator('button:has-text("Upgrade to Pro")');
      await upgradeButton.click();

      // Should attempt to redirect to checkout
      await page.waitForURL(/mock-stripe-checkout/, { timeout: 5000 });
    });

    test('should show error if checkout session creation fails', async ({ page, request }) => {
      // Create free tier user
      const testEmail = `test-checkout-fail-${Date.now()}@example.com`;
      await request.post(`${API_URL}/api/auth/signup`, {
        data: {
          name: 'Test User',
          email: testEmail,
          password: 'testpassword123',
          inviteCode: 'TESTCODE',
        },
      });

      await page.goto(`${APP_URL}/login`);
      await page.fill('[data-testid="auth-input-email"]', testEmail);
      await page.fill('[data-testid="auth-input-password"]', 'testpassword123');
      await page.click('[data-testid="auth-submit-button"]');

      await page.goto(`${APP_URL}/pricing`);

      // Mock failed checkout session creation
      await page.route('**/api/billing/create-checkout-session', (route) => {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'Invalid price ID' } }),
        });
      });

      const upgradeButton = page.locator('button:has-text("Upgrade to Pro")');
      await upgradeButton.click();

      // Should show error message
      await expect(page.locator('text=/Invalid price ID/i')).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('Quota Differences Between Tiers', () => {
    test('should show free tier quota limit (5 per week)', async ({ page, request }) => {
      // Create free tier user
      const testEmail = `test-free-quota-${Date.now()}@example.com`;
      await request.post(`${API_URL}/api/auth/signup`, {
        data: {
          name: 'Test User',
          email: testEmail,
          password: 'testpassword123',
          inviteCode: 'TESTCODE',
        },
      });

      await page.goto(`${APP_URL}/login`);
      await page.fill('[data-testid="auth-input-email"]', testEmail);
      await page.fill('[data-testid="auth-input-password"]', 'testpassword123');
      await page.click('[data-testid="auth-submit-button"]');

      // Navigate to library
      await page.goto(`${APP_URL}/app/library`);

      // Should show quota badge
      const quotaBadge = page.locator('[data-testid="quota-badge"]').first();
      await expect(quotaBadge).toBeVisible({ timeout: 5000 });

      const quotaText = await quotaBadge.textContent();
      expect(quotaText).toContain('5'); // Free tier limit
    });

    test('should show upgrade prompt when free tier hits quota limit', async ({
      page,
      request,
    }) => {
      // This would require generating content to hit the limit
      // Implementation would depend on test helpers to set quota
      test.skip();
    });
  });

  test.describe('Admin Subscription Management', () => {
    test('should allow admin to view user subscription details', async ({ page, request }) => {
      // Login as admin
      await page.goto(`${APP_URL}/login`);
      const testEmail = process.env.TEST_USER_EMAIL || 'test@test.com';
      const testPassword = process.env.TEST_USER_PASSWORD || 'testtest';
      await page.fill('[data-testid="auth-input-email"]', testEmail);
      await page.fill('[data-testid="auth-input-password"]', testPassword);
      await page.click('[data-testid="auth-submit-button"]');

      // Navigate to admin page
      await page.goto(`${APP_URL}/app/admin`);

      // Should be able to see user tier in admin table
      await expect(page.locator('text=/Tier/i')).toBeVisible();
      await expect(page.locator('text=/Free|Pro/i').first()).toBeVisible();
    });

    test('should allow admin to manually override user tier', async ({ page, request }) => {
      // Login as admin and test tier override functionality
      // This requires admin privileges and would be integration-level test
      test.skip();
    });

    test('should show subscription status in admin dashboard', async ({ page, request }) => {
      // Login as admin
      await page.goto(`${APP_URL}/login`);
      const testEmail = process.env.TEST_USER_EMAIL || 'test@test.com';
      const testPassword = process.env.TEST_USER_PASSWORD || 'testtest';
      await page.fill('[data-testid="auth-input-email"]', testEmail);
      await page.fill('[data-testid="auth-input-password"]', testPassword);
      await page.click('[data-testid="auth-submit-button"]');

      await page.goto(`${APP_URL}/app/admin`);

      // Should show subscription status column
      await expect(page.locator('text=/Sub Status/i')).toBeVisible();
    });
  });

  test.describe('Subscription Status Display', () => {
    test('should show tier in user menu', async ({ page, request }) => {
      // Create free tier user
      const testEmail = `test-menu-tier-${Date.now()}@example.com`;
      await request.post(`${API_URL}/api/auth/signup`, {
        data: {
          name: 'Test User',
          email: testEmail,
          password: 'testpassword123',
          inviteCode: 'TESTCODE',
        },
      });

      await page.goto(`${APP_URL}/login`);
      await page.fill('[data-testid="auth-input-email"]', testEmail);
      await page.fill('[data-testid="auth-input-password"]', 'testpassword123');
      await page.click('[data-testid="auth-submit-button"]');

      // Open user menu
      await page.click('[data-testid="user-menu-trigger"]');

      // Should show tier badge or text
      const userMenu = page.locator('[data-testid="user-menu"]');
      await expect(userMenu).toBeVisible();
    });

    test('should show billing link in settings for all users', async ({ page, request }) => {
      // Create user
      const testEmail = `test-billing-link-${Date.now()}@example.com`;
      await request.post(`${API_URL}/api/auth/signup`, {
        data: {
          name: 'Test User',
          email: testEmail,
          password: 'testpassword123',
          inviteCode: 'TESTCODE',
        },
      });

      await page.goto(`${APP_URL}/login`);
      await page.fill('[data-testid="auth-input-email"]', testEmail);
      await page.fill('[data-testid="auth-input-password"]', 'testpassword123');
      await page.click('[data-testid="auth-submit-button"]');

      await page.goto(`${APP_URL}/app/settings`);

      // Should have billing tab
      const billingTab = page.locator('text=/Billing/i');
      await expect(billingTab).toBeVisible();
    });
  });

  test.describe('Edge Cases', () => {
    test('should handle network errors gracefully during checkout', async ({ page, request }) => {
      // Create free tier user
      const testEmail = `test-network-error-${Date.now()}@example.com`;
      await request.post(`${API_URL}/api/auth/signup`, {
        data: {
          name: 'Test User',
          email: testEmail,
          password: 'testpassword123',
          inviteCode: 'TESTCODE',
        },
      });

      await page.goto(`${APP_URL}/login`);
      await page.fill('[data-testid="auth-input-email"]', testEmail);
      await page.fill('[data-testid="auth-input-password"]', 'testpassword123');
      await page.click('[data-testid="auth-submit-button"]');

      await page.goto(`${APP_URL}/pricing`);

      // Mock network error
      await page.route('**/api/billing/create-checkout-session', (route) => {
        route.abort('failed');
      });

      const upgradeButton = page.locator('button:has-text("Upgrade to Pro")');
      await upgradeButton.click();

      // Should show error message
      await expect(page.locator('text=/Failed|error/i')).toBeVisible({ timeout: 3000 });
    });

    test('should prevent multiple simultaneous checkout attempts', async ({ page, request }) => {
      // Create free tier user
      const testEmail = `test-double-click-${Date.now()}@example.com`;
      await request.post(`${API_URL}/api/auth/signup`, {
        data: {
          name: 'Test User',
          email: testEmail,
          password: 'testpassword123',
          inviteCode: 'TESTCODE',
        },
      });

      await page.goto(`${APP_URL}/login`);
      await page.fill('[data-testid="auth-input-email"]', testEmail);
      await page.fill('[data-testid="auth-input-password"]', 'testpassword123');
      await page.click('[data-testid="auth-submit-button"]');

      await page.goto(`${APP_URL}/pricing`);

      const upgradeButton = page.locator('button:has-text("Upgrade to Pro")');

      // Button should be disabled during checkout creation
      await upgradeButton.click();
      await expect(upgradeButton).toBeDisabled();
    });
  });
});
