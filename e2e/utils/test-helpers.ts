import { Page, expect } from '@playwright/test';

/**
 * E2E Test Helper Functions
 * Utilities for authentication, data seeding, and common test operations
 */

export interface TestUser {
  email: string;
  password: string;
  role?: 'admin' | 'user';
}

/**
 * Login as admin user
 */
async function loginWithCredentials(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/app/study', { timeout: 10000 });
}

export async function loginAsAdmin(page: Page): Promise<void> {
  await loginWithCredentials(
    page,
    process.env.ADMIN_EMAIL || 'admin@convolab.test',
    process.env.ADMIN_PASSWORD || 'admin123'
  );
}

export async function loginAsUser(page: Page, email?: string, password?: string): Promise<void> {
  await loginWithCredentials(
    page,
    email || process.env.TEST_USER_EMAIL || 'test@convolab.test',
    password || process.env.TEST_USER_PASSWORD || 'test123'
  );
}

/**
 * Logout current user
 */
export async function logout(page: Page): Promise<void> {
  await page.click('[data-testid="user-menu"]', { timeout: 5000 }).catch(() => {
    // If user menu button not found, try alternative selector
    return page.click('button:has-text("Logout")');
  });
  await page.click('button:has-text("Logout")');
  await page.waitForURL('/login', { timeout: 5000 });
}

/**
 * Scroll to bottom of page to trigger infinite scroll
 */
export async function scrollToBottom(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForTimeout(500); // Wait for intersection observer
}

/**
 * Wait for loading spinner to disappear
 */
export async function waitForLoadingComplete(page: Page): Promise<void> {
  await page
    .waitForSelector('[data-testid="loading-spinner"]', { state: 'hidden', timeout: 10000 })
    .catch(() => {
      // Spinner might not be present at all, which is fine
    });
}

/**
 * Get error message displayed on page
 */
export async function getErrorMessage(page: Page): Promise<string | null> {
  try {
    const errorElement = page.locator('[data-testid="error-display"]').first();
    await errorElement.waitFor({ state: 'visible', timeout: 3000 });
    return await errorElement.textContent();
  } catch {
    return null;
  }
}

/**
 * Wait for specific amount of time (use sparingly)
 */
export async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Assert that the current page has no horizontal overflow.
 */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    bodyWidth: document.body.scrollWidth,
    docWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));

  const widestWidth = Math.max(widths.bodyWidth, widths.docWidth);
  expect(widestWidth).toBeLessThanOrEqual(widths.viewportWidth + 1);
}
