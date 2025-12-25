import { test, expect } from '@playwright/test';

const API_URL = process.env.VITE_API_URL || 'http://localhost:3001';
const APP_URL = 'http://localhost:5173';

/**
 * E2E Tests for Email Verification Flow
 * Tests signup, email verification, and resend verification email functionality
 */

test.describe('Email Verification Flow', () => {
  // Helper to extract verification token from API response (simulating email)
  async function getVerificationToken(userId: string): Promise<string> {
    const response = await fetch(`${API_URL}/api/test/get-verification-token/${userId}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to get verification token');
    }

    const { token } = await response.json();
    return token;
  }

  test.describe('Signup and Verification', () => {
    test('should create account and require email verification', async ({ page }) => {
      const testEmail = `test-${Date.now()}@example.com`;
      const testPassword = 'testpassword123';

      // Navigate to signup page
      await page.goto(`${APP_URL}/login`);

      // Switch to signup tab
      await page.click('[data-testid="auth-tab-signup"]');

      // Fill in signup form
      await page.fill('[data-testid="auth-input-name"]', 'Test User');
      await page.fill('[data-testid="auth-input-email"]', testEmail);
      await page.fill('[data-testid="auth-input-password"]', testPassword);
      await page.fill('[data-testid="auth-input-invite-code"]', 'TESTCODE');

      // Submit signup form
      await page.click('[data-testid="auth-submit-button"]');

      // Wait for redirect to library or verify email page
      await page.waitForURL(/\/(verify-email|library)/, { timeout: 5000 });

      // User should see verification reminder in settings
      await page.goto(`${APP_URL}/app/settings`);

      // Should show email verification reminder
      const verificationReminder = page.locator('text=/verify.*email/i').first();
      await expect(verificationReminder).toBeVisible();
    });

    test('should successfully verify email with valid token', async ({ page, request }) => {
      // Create a test user
      const signupResponse = await request.post(`${API_URL}/api/auth/signup`, {
        data: {
          name: 'Test User',
          email: `test-verify-${Date.now()}@example.com`,
          password: 'testpassword123',
          inviteCode: 'TESTCODE',
        },
      });

      expect(signupResponse.ok()).toBeTruthy();
      const { user } = await signupResponse.json();

      // Get verification token
      const token = await getVerificationToken(user.id);

      // Visit verification URL
      await page.goto(`${APP_URL}/verify-email/${token}`);

      // Should show success message
      await expect(page.locator('text=/Email Verified!/i')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=/successfully verified/i')).toBeVisible();

      // Should redirect to library after 3 seconds
      await page.waitForURL(/\/library/, { timeout: 5000 });
      expect(page.url()).toContain('/library');
    });

    test('should show error for invalid verification token', async ({ page }) => {
      const invalidToken = 'invalid-token-12345';

      await page.goto(`${APP_URL}/verify-email/${invalidToken}`);

      // Should show error message
      await expect(page.locator('text=/Verification Failed/i')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=/Invalid or expired/i')).toBeVisible();
    });

    test('should show error for expired verification token', async ({ page, request }) => {
      // Create a test user
      const signupResponse = await request.post(`${API_URL}/api/auth/signup`, {
        data: {
          name: 'Test User',
          email: `test-expired-${Date.now()}@example.com`,
          password: 'testpassword123',
          inviteCode: 'TESTCODE',
        },
      });

      expect(signupResponse.ok()).toBeTruthy();
      const { user } = await signupResponse.json();

      // Expire the verification token (would need API helper for this)
      await request.post(`${API_URL}/api/test/expire-verification-token/${user.id}`);

      const token = await getVerificationToken(user.id);

      await page.goto(`${APP_URL}/verify-email/${token}`);

      // Should show error message
      await expect(page.locator('text=/Verification Failed/i')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Resend Verification Email', () => {
    test('should allow user to resend verification email', async ({ page, request }) => {
      // Create unverified user
      const testEmail = `test-resend-${Date.now()}@example.com`;
      const signupResponse = await request.post(`${API_URL}/api/auth/signup`, {
        data: {
          name: 'Test User',
          email: testEmail,
          password: 'testpassword123',
          inviteCode: 'TESTCODE',
        },
      });

      expect(signupResponse.ok()).toBeTruthy();

      // Login as the unverified user
      await page.goto(`${APP_URL}/login`);
      await page.fill('[data-testid="auth-input-email"]', testEmail);
      await page.fill('[data-testid="auth-input-password"]', 'testpassword123');
      await page.click('[data-testid="auth-submit-button"]');

      // Navigate to verify email page
      await page.goto(`${APP_URL}/verify-email`);

      // Should show resend button
      const resendButton = page.locator('button:has-text("Resend Verification Email")');
      await expect(resendButton).toBeVisible();

      // Click resend button
      await resendButton.click();

      // Should show success message
      await expect(page.locator('text=/Verification email sent!/i')).toBeVisible({ timeout: 3000 });
    });

    test('should show error if resending to already verified email', async ({ page, request }) => {
      // Create and verify user
      const testEmail = `test-already-verified-${Date.now()}@example.com`;
      const signupResponse = await request.post(`${API_URL}/api/auth/signup`, {
        data: {
          name: 'Test User',
          email: testEmail,
          password: 'testpassword123',
          inviteCode: 'TESTCODE',
        },
      });

      expect(signupResponse.ok()).toBeTruthy();
      const { user } = await signupResponse.json();

      // Verify the email
      const token = await getVerificationToken(user.id);
      await request.get(`${API_URL}/api/verification/${token}`);

      // Login
      await page.goto(`${APP_URL}/login`);
      await page.fill('[data-testid="auth-input-email"]', testEmail);
      await page.fill('[data-testid="auth-input-password"]', 'testpassword123');
      await page.click('[data-testid="auth-submit-button"]');

      // Try to access verify email page
      await page.goto(`${APP_URL}/verify-email`);

      // Should show "already verified" message
      await expect(page.locator('text=/Email Already Verified/i')).toBeVisible();
    });

    test('should allow resending after failed verification', async ({ page }) => {
      const invalidToken = 'invalid-token-12345';

      await page.goto(`${APP_URL}/verify-email/${invalidToken}`);

      // Should show error
      await expect(page.locator('text=/Verification Failed/i')).toBeVisible({ timeout: 5000 });

      // Should show resend button
      const resendButton = page.locator('button:has-text("Resend Verification Email")');
      await expect(resendButton).toBeVisible();
    });
  });

  test.describe('Email Verification Reminder', () => {
    test('should show verification reminder in settings for unverified users', async ({
      page,
      request,
    }) => {
      // Create unverified user
      const testEmail = `test-reminder-${Date.now()}@example.com`;
      const signupResponse = await request.post(`${API_URL}/api/auth/signup`, {
        data: {
          name: 'Test User',
          email: testEmail,
          password: 'testpassword123',
          inviteCode: 'TESTCODE',
        },
      });

      expect(signupResponse.ok()).toBeTruthy();

      // Login
      await page.goto(`${APP_URL}/login`);
      await page.fill('[data-testid="auth-input-email"]', testEmail);
      await page.fill('[data-testid="auth-input-password"]', 'testpassword123');
      await page.click('[data-testid="auth-submit-button"]');

      // Navigate to settings
      await page.goto(`${APP_URL}/app/settings`);

      // Should show verification reminder
      const reminder = page.locator('text=/verify.*email/i').first();
      await expect(reminder).toBeVisible();
    });

    test('should not show verification reminder for verified users', async ({ page, request }) => {
      // Create and verify user
      const testEmail = `test-no-reminder-${Date.now()}@example.com`;
      const signupResponse = await request.post(`${API_URL}/api/auth/signup`, {
        data: {
          name: 'Test User',
          email: testEmail,
          password: 'testpassword123',
          inviteCode: 'TESTCODE',
        },
      });

      expect(signupResponse.ok()).toBeTruthy();
      const { user } = await signupResponse.json();

      // Verify the email
      const token = await getVerificationToken(user.id);
      await request.get(`${API_URL}/api/verification/${token}`);

      // Login
      await page.goto(`${APP_URL}/login`);
      await page.fill('[data-testid="auth-input-email"]', testEmail);
      await page.fill('[data-testid="auth-input-password"]', 'testpassword123');
      await page.click('[data-testid="auth-submit-button"]');

      // Navigate to settings
      await page.goto(`${APP_URL}/app/settings`);

      // Should NOT show verification reminder
      const reminder = page.locator('text=/verify.*email/i');
      await expect(reminder).not.toBeVisible();
    });
  });

  test.describe('Edge Cases', () => {
    test('should handle multiple verification attempts with same token', async ({
      page,
      request,
    }) => {
      // Create user
      const signupResponse = await request.post(`${API_URL}/api/auth/signup`, {
        data: {
          name: 'Test User',
          email: `test-multi-${Date.now()}@example.com`,
          password: 'testpassword123',
          inviteCode: 'TESTCODE',
        },
      });

      expect(signupResponse.ok()).toBeTruthy();
      const { user } = await signupResponse.json();

      const token = await getVerificationToken(user.id);

      // First verification attempt - should succeed
      await page.goto(`${APP_URL}/verify-email/${token}`);
      await expect(page.locator('text=/Email Verified!/i')).toBeVisible({ timeout: 5000 });

      // Second verification attempt with same token - should fail
      await page.goto(`${APP_URL}/verify-email/${token}`);
      await expect(page.locator('text=/Verification Failed/i')).toBeVisible({ timeout: 5000 });
    });

    test('should preserve return URL through verification flow', async ({ page, request }) => {
      // Create user
      const testEmail = `test-returnurl-${Date.now()}@example.com`;
      const signupResponse = await request.post(`${API_URL}/api/auth/signup`, {
        data: {
          name: 'Test User',
          email: testEmail,
          password: 'testpassword123',
          inviteCode: 'TESTCODE',
        },
      });

      expect(signupResponse.ok()).toBeTruthy();
      const { user } = await signupResponse.json();

      const token = await getVerificationToken(user.id);

      // Visit verification URL
      await page.goto(`${APP_URL}/verify-email/${token}`);

      // Should redirect to library after verification
      await page.waitForURL(/\/library/, { timeout: 5000 });
      expect(page.url()).toContain('/library');
    });
  });
});
