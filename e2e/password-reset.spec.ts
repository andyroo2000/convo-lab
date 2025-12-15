import { test, expect } from '@playwright/test';

const API_URL = process.env.VITE_API_URL || 'http://localhost:3001';
const APP_URL = 'http://localhost:5173';

/**
 * E2E Tests for Password Reset Flow
 * Tests forgot password, token verification, password reset, and security measures
 */

test.describe('Password Reset Flow', () => {
  // Helper to extract password reset token from API (simulating email)
  async function getPasswordResetToken(userId: string): Promise<string> {
    const response = await fetch(`${API_URL}/api/test/get-password-reset-token/${userId}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to get password reset token');
    }

    const { token } = await response.json();
    return token;
  }

  test.describe('Forgot Password Page', () => {
    test('should render forgot password form', async ({ page }) => {
      await page.goto(`${APP_URL}/forgot-password`);

      await expect(page.locator('h1:has-text("ConvoLab")')).toBeVisible();
      await expect(page.locator('h2:has-text("Forgot Password")')).toBeVisible();
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('button:has-text("Send Reset Link")')).toBeVisible();
    });

    test('should submit email and show success message', async ({ page }) => {
      await page.goto(`${APP_URL}/forgot-password`);

      await page.fill('input[type="email"]', 'test@example.com');
      await page.click('button:has-text("Send Reset Link")');

      await expect(page.locator('h2:has-text("Check Your Email")')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=test@example.com')).toBeVisible();
    });

    it('should show success message even for non-existent email (prevent enumeration)', async ({ page }) => {
      await page.goto(`${APP_URL}/forgot-password`);

      await page.fill('input[type="email"]', 'nonexistent@example.com');
      await page.click('button:has-text("Send Reset Link")');

      // Should still show success message to prevent email enumeration
      await expect(page.locator('h2:has-text("Check Your Email")')).toBeVisible({ timeout: 5000 });
    });

    test('should show back to login link', async ({ page }) => {
      await page.goto(`${APP_URL}/forgot-password`);

      const backLink = page.locator('a:has-text("Back to Login")');
      await expect(backLink).toBeVisible();
      await expect(backLink).toHaveAttribute('href', '/login');
    });

    test('should require email field', async ({ page }) => {
      await page.goto(`${APP_URL}/forgot-password`);

      const emailInput = page.locator('input[type="email"]');
      await expect(emailInput).toHaveAttribute('required', '');
    });
  });

  test.describe('Password Reset with Token', () => {
    test('should validate token on page load', async ({ page, request }) => {
      // Create a user
      const signupResponse = await request.post(`${API_URL}/api/auth/signup`, {
        data: {
          name: 'Test User',
          email: `test-reset-${Date.now()}@example.com`,
          password: 'oldpassword123',
          inviteCode: 'TESTCODE',
        },
      });

      expect(signupResponse.ok()).toBeTruthy();
      const { user } = await signupResponse.json();

      // Get password reset token
      const token = await getPasswordResetToken(user.id);

      // Visit reset password page
      await page.goto(`${APP_URL}/reset-password/${token}`);

      // Should show reset form
      await expect(page.locator('h2:has-text("Reset Password")')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('input[id="new-password"]')).toBeVisible();
      await expect(page.locator('input[id="confirm-password"]')).toBeVisible();
    });

    test('should show error for invalid token', async ({ page }) => {
      await page.goto(`${APP_URL}/reset-password/invalid-token-123`);

      await expect(page.locator('text=/Invalid or expired/i')).toBeVisible({ timeout: 5000 });
    });

    test('should successfully reset password with valid token', async ({ page, request }) => {
      // Create a user
      const testEmail = `test-success-${Date.now()}@example.com`;
      const signupResponse = await request.post(`${API_URL}/api/auth/signup`, {
        data: {
          name: 'Test User',
          email: testEmail,
          password: 'oldpassword123',
          inviteCode: 'TESTCODE',
        },
      });

      expect(signupResponse.ok()).toBeTruthy();
      const { user } = await signupResponse.json();

      const token = await getPasswordResetToken(user.id);

      // Visit reset password page
      await page.goto(`${APP_URL}/reset-password/${token}`);

      await page.waitForSelector('input[id="new-password"]', { timeout: 5000 });

      // Fill in new password
      await page.fill('input[id="new-password"]', 'newpassword123');
      await page.fill('input[id="confirm-password"]', 'newpassword123');

      // Submit
      await page.click('button:has-text("Reset Password")');

      // Should show success message
      await expect(page.locator('h2:has-text("Password Reset Successfully")')).toBeVisible({ timeout: 5000 });

      // Wait for redirect
      await page.waitForURL(/\/login/, { timeout: 5000 });

      // Verify new password works
      await page.fill('[data-testid="auth-input-email"]', testEmail);
      await page.fill('[data-testid="auth-input-password"]', 'newpassword123');
      await page.click('[data-testid="auth-submit-button"]');

      await page.waitForURL(/\/library/, { timeout: 5000 });
      expect(page.url()).toContain('/library');
    });

    test('should reject passwords shorter than 8 characters', async ({ page, request }) => {
      // Create a user
      const signupResponse = await request.post(`${API_URL}/api/auth/signup`, {
        data: {
          name: 'Test User',
          email: `test-short-${Date.now()}@example.com`,
          password: 'oldpassword123',
          inviteCode: 'TESTCODE',
        },
      });

      expect(signupResponse.ok()).toBeTruthy();
      const { user } = await signupResponse.json();

      const token = await getPasswordResetToken(user.id);

      await page.goto(`${APP_URL}/reset-password/${token}`);
      await page.waitForSelector('input[id="new-password"]', { timeout: 5000 });

      // Try short password
      await page.fill('input[id="new-password"]', 'short');
      await page.fill('input[id="confirm-password"]', 'short');
      await page.click('button:has-text("Reset Password")');

      await expect(page.locator('text=/Password must be at least 8 characters/i')).toBeVisible();
    });

    test('should reject mismatched passwords', async ({ page, request }) => {
      // Create a user
      const signupResponse = await request.post(`${API_URL}/api/auth/signup`, {
        data: {
          name: 'Test User',
          email: `test-mismatch-${Date.now()}@example.com`,
          password: 'oldpassword123',
          inviteCode: 'TESTCODE',
        },
      });

      expect(signupResponse.ok()).toBeTruthy();
      const { user } = await signupResponse.json();

      const token = await getPasswordResetToken(user.id);

      await page.goto(`${APP_URL}/reset-password/${token}`);
      await page.waitForSelector('input[id="new-password"]', { timeout: 5000 });

      // Try mismatched passwords
      await page.fill('input[id="new-password"]', 'newpassword123');
      await page.fill('input[id="confirm-password"]', 'different123');
      await page.click('button:has-text("Reset Password")');

      await expect(page.locator('text=/Passwords do not match/i')).toBeVisible();
    });
  });

  test.describe('Security Measures', () => {
    test('should invalidate token after successful use', async ({ page, request }) => {
      // Create a user
      const signupResponse = await request.post(`${API_URL}/api/auth/signup`, {
        data: {
          name: 'Test User',
          email: `test-one-time-${Date.now()}@example.com`,
          password: 'oldpassword123',
          inviteCode: 'TESTCODE',
        },
      });

      expect(signupResponse.ok()).toBeTruthy();
      const { user } = await signupResponse.json();

      const token = await getPasswordResetToken(user.id);

      // Use token once
      await page.goto(`${APP_URL}/reset-password/${token}`);
      await page.waitForSelector('input[id="new-password"]', { timeout: 5000 });
      await page.fill('input[id="new-password"]', 'newpassword123');
      await page.fill('input[id="confirm-password"]', 'newpassword123');
      await page.click('button:has-text("Reset Password")');

      await expect(page.locator('h2:has-text("Password Reset Successfully")')).toBeVisible({ timeout: 5000 });

      // Try to use the same token again
      await page.goto(`${APP_URL}/reset-password/${token}`);

      await expect(page.locator('text=/Invalid or expired/i')).toBeVisible({ timeout: 5000 });
    });

    test('should expire tokens after time limit', async ({ page, request }) => {
      // This test would require API helper to create expired token
      // Implementation depends on test infrastructure
      test.skip();
    });

    test('should send password changed confirmation email', async ({ page, request }) => {
      // This test would require email verification in test environment
      // Implementation depends on test infrastructure
      test.skip();
    });
  });

  test.describe('Complete Flow Integration', () => {
    test('should complete full password reset flow from forgot to login', async ({ page, request }) => {
      const testEmail = `test-full-flow-${Date.now()}@example.com`;

      // 1. Create user
      const signupResponse = await request.post(`${API_URL}/api/auth/signup`, {
        data: {
          name: 'Test User',
          email: testEmail,
          password: 'originalpassword123',
          inviteCode: 'TESTCODE',
        },
      });

      expect(signupResponse.ok()).toBeTruthy();
      const { user } = await signupResponse.json();

      // 2. Request password reset
      await page.goto(`${APP_URL}/forgot-password`);
      await page.fill('input[type="email"]', testEmail);
      await page.click('button:has-text("Send Reset Link")');

      await expect(page.locator('h2:has-text("Check Your Email")')).toBeVisible();

      // 3. Get reset token
      const token = await getPasswordResetToken(user.id);

      // 4. Reset password
      await page.goto(`${APP_URL}/reset-password/${token}`);
      await page.waitForSelector('input[id="new-password"]', { timeout: 5000 });
      await page.fill('input[id="new-password"]', 'newpassword123');
      await page.fill('input[id="confirm-password"]', 'newpassword123');
      await page.click('button:has-text("Reset Password")');

      await expect(page.locator('h2:has-text("Password Reset Successfully")')).toBeVisible();

      // 5. Verify redirect to login
      await page.waitForURL(/\/login/, { timeout: 5000 });

      // 6. Login with new password
      await page.fill('[data-testid="auth-input-email"]', testEmail);
      await page.fill('[data-testid="auth-input-password"]', 'newpassword123');
      await page.click('[data-testid="auth-submit-button"]');

      // Should successfully login
      await page.waitForURL(/\/library/, { timeout: 5000 });
      expect(page.url()).toContain('/library');

      // 7. Verify old password no longer works
      await page.goto(`${APP_URL}/login`);
      await page.fill('[data-testid="auth-input-email"]', testEmail);
      await page.fill('[data-testid="auth-input-password"]', 'originalpassword123');
      await page.click('[data-testid="auth-submit-button"]');

      // Should show error
      await expect(page.locator('text=/Invalid credentials/i')).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('UI/UX Features', () => {
    test('should show loading state during submission', async ({ page, request }) => {
      const signupResponse = await request.post(`${API_URL}/api/auth/signup`, {
        data: {
          name: 'Test User',
          email: `test-loading-${Date.now()}@example.com`,
          password: 'oldpassword123',
          inviteCode: 'TESTCODE',
        },
      });

      const { user } = await signupResponse.json();
      const token = await getPasswordResetToken(user.id);

      await page.goto(`${APP_URL}/reset-password/${token}`);
      await page.waitForSelector('input[id="new-password"]', { timeout: 5000 });

      await page.fill('input[id="new-password"]', 'newpassword123');
      await page.fill('input[id="confirm-password"]', 'newpassword123');

      // Submit and check loading state
      await page.click('button:has-text("Reset Password")');

      // Button should be disabled during submission
      const submitButton = page.locator('button:has-text("Resetting")');
      await expect(submitButton).toBeVisible({ timeout: 1000 });
      await expect(submitButton).toBeDisabled();
    });

    test('should display user email in reset form', async ({ page, request }) => {
      const testEmail = `test-display-${Date.now()}@example.com`;
      const signupResponse = await request.post(`${API_URL}/api/auth/signup`, {
        data: {
          name: 'Test User',
          email: testEmail,
          password: 'oldpassword123',
          inviteCode: 'TESTCODE',
        },
      });

      const { user } = await signupResponse.json();
      const token = await getPasswordResetToken(user.id);

      await page.goto(`${APP_URL}/reset-password/${token}`);

      await expect(page.locator(`text=${testEmail}`)).toBeVisible({ timeout: 5000 });
    });
  });
});
