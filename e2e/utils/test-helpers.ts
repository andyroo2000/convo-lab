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
export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.fill('input[type="email"]', process.env.ADMIN_EMAIL || 'admin@convolab.test');
  await page.fill('input[type="password"]', process.env.ADMIN_PASSWORD || 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForURL('/app/library', { timeout: 10000 });
}

/**
 * Login as regular user
 */
export async function loginAsUser(page: Page, email?: string, password?: string): Promise<void> {
  await page.goto('/login');
  await page.fill(
    'input[type="email"]',
    email || process.env.TEST_USER_EMAIL || 'test@convolab.test'
  );
  await page.fill(
    'input[type="password"]',
    password || process.env.TEST_USER_PASSWORD || 'test123'
  );
  await page.click('button[type="submit"]');
  await page.waitForURL('/app/library', { timeout: 10000 });
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
 * Wait for quota badge to appear and return its text
 */
export async function waitForQuotaBadge(page: Page): Promise<string | null> {
  try {
    const badge = page.locator('[data-testid="quota-badge"]').first();
    await badge.waitFor({ state: 'visible', timeout: 5000 });
    return await badge.textContent();
  } catch {
    return null;
  }
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
 * Get the count of items in the library
 */
export async function getLibraryItemCount(page: Page): Promise<number> {
  const items = await page.locator('[data-testid="library-item"]').count();
  return items;
}

/**
 * Navigate to a specific tab in the library
 */
export async function navigateToTab(
  page: Page,
  tabName: 'Dialogues' | 'Courses' | 'Narrow Listening'
): Promise<void> {
  await page.click(`button:has-text("${tabName}")`);
  await waitForLoadingComplete(page);
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
 * Check if impersonation banner is visible
 */
export async function isImpersonationBannerVisible(page: Page): Promise<boolean> {
  try {
    const banner = page.locator('[data-testid="impersonation-banner"]').first();
    await banner.waitFor({ state: 'visible', timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get impersonated user info from banner
 */
export async function getImpersonatedUserInfo(
  page: Page
): Promise<{ name: string; email: string } | null> {
  try {
    const banner = page.locator('[data-testid="impersonation-banner"]').first();
    const text = await banner.textContent();
    const nameMatch = text?.match(/Viewing as (.+?) \(/);
    const emailMatch = text?.match(/\((.+?)\)/);

    if (nameMatch && emailMatch) {
      return {
        name: nameMatch[1],
        email: emailMatch[1],
      };
    }
  } catch {
    // Banner not found
  }
  return null;
}

/**
 * Exit impersonation mode
 */
export async function exitImpersonation(page: Page): Promise<void> {
  await page.click('button:has-text("Exit View")');
  await page.waitForTimeout(500);
}

/**
 * Generate a dialogue (for testing quota)
 */
export async function generateDialogue(page: Page): Promise<void> {
  await page.goto('/app/dialogues/new');
  await page.fill('textarea[name="topic"]', 'Test conversation about weather');
  await page.click('button:has-text("Generate")');
  // Wait for generation to complete
  await page.waitForSelector('[data-testid="dialogue-result"]', { timeout: 60000 });
}

/**
 * Wait for specific amount of time (use sparingly)
 */
export async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Clear all generation logs for a user (via API)
 */
export async function clearUserQuota(page: Page, userId: string): Promise<void> {
  await page.request.delete(`http://localhost:3000/api/test/quota/${userId}`);
}

/**
 * Clear Redis cooldown keys (via API)
 */
export async function clearCooldowns(page: Page): Promise<void> {
  await page.request.delete('http://localhost:3000/api/test/cooldowns');
}

/**
 * Set user quota usage (via API)
 */
export async function setUserQuota(page: Page, userId: string, used: number): Promise<void> {
  await page.request.post(`http://localhost:3000/api/test/quota/${userId}`, {
    data: { used },
  });
}
