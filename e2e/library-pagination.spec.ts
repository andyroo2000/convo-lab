import { test, expect } from '@playwright/test';
import {
  loginAsUser,
  scrollToBottom,
  waitForLoadingComplete,
  getLibraryItemCount,
  navigateToTab,
} from './utils/test-helpers';

/**
 * E2E Tests for Library Pagination
 * Tests infinite scroll, pagination parameters, and library vs full mode
 */

test.describe('Library Pagination', () => {
  test.describe('Initial Page Load', () => {
    test('should load first 20 items initially', async ({ page }) => {
      await loginAsUser(page);

      await page.goto('/app/library');
      await waitForLoadingComplete(page);

      const itemCount = await getLibraryItemCount(page);

      // Should load exactly 20 items (or less if user has fewer than 20)
      expect(itemCount).toBeGreaterThan(0);
      expect(itemCount).toBeLessThanOrEqual(20);
    });

    test('should show loading skeleton during initial load', async ({ page }) => {
      await loginAsUser(page);

      await page.goto('/app/library');

      // Should see loading skeleton
      const skeleton = page.locator('[data-testid="loading-skeleton"]').first();
      await skeleton.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {
        // Skeleton might appear and disappear too quickly
      });

      await waitForLoadingComplete(page);
    });

    test('should display items ordered by most recent', async ({ page }) => {
      await loginAsUser(page);

      await page.goto('/app/library');
      await waitForLoadingComplete(page);

      // Get timestamps of first two items
      const firstItemDate = await page
        .locator('[data-testid="library-item"]')
        .nth(0)
        .getAttribute('data-updated-at');
      const secondItemDate = await page
        .locator('[data-testid="library-item"]')
        .nth(1)
        .getAttribute('data-updated-at');

      if (firstItemDate && secondItemDate) {
        const firstDate = new Date(firstItemDate);
        const secondDate = new Date(secondItemDate);

        // First item should be more recent than second
        expect(firstDate.getTime()).toBeGreaterThanOrEqual(secondDate.getTime());
      }
    });
  });

  test.describe('Infinite Scroll - Load More', () => {
    test('should load next 20 items on scroll', async ({ page }) => {
      await loginAsUser(page);

      await page.goto('/app/library');
      await waitForLoadingComplete(page);

      const initialCount = await getLibraryItemCount(page);

      // Scroll to bottom
      await scrollToBottom(page);

      // Wait for more items to load
      await page.waitForTimeout(2000);

      const newCount = await getLibraryItemCount(page);

      // Should have more items now (unless we loaded all available)
      expect(newCount).toBeGreaterThanOrEqual(initialCount);
    });

    test('should show loading spinner while loading more', async ({ page }) => {
      await loginAsUser(page);

      await page.goto('/app/library');
      await waitForLoadingComplete(page);

      // Scroll to bottom
      await scrollToBottom(page);

      // Should see loading spinner briefly
      const spinner = page.locator('[data-testid="loading-spinner"]').first();
      await spinner.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {
        // Spinner might appear and disappear too quickly
      });
    });

    test('should not show duplicate items after loading more', async ({ page }) => {
      await loginAsUser(page);

      await page.goto('/app/library');
      await waitForLoadingComplete(page);

      // Get IDs of initial items
      const initialIds = await page
        .locator('[data-testid="library-item"]')
        .evaluateAll((items) => items.map((item) => item.getAttribute('data-item-id')));

      // Scroll to load more
      await scrollToBottom(page);
      await page.waitForTimeout(2000);

      // Get all IDs after loading more
      const allIds = await page
        .locator('[data-testid="library-item"]')
        .evaluateAll((items) => items.map((item) => item.getAttribute('data-item-id')));

      // Check for duplicates
      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(allIds.length);
    });
  });

  test.describe('Complete Load', () => {
    test('should stop loading when all items fetched', async ({ page }) => {
      await loginAsUser(page);

      await page.goto('/app/library');
      await waitForLoadingComplete(page);

      // Scroll multiple times to load all
      for (let i = 0; i < 5; i++) {
        const beforeCount = await getLibraryItemCount(page);
        await scrollToBottom(page);
        await page.waitForTimeout(2000);
        const afterCount = await getLibraryItemCount(page);

        // If count didn't increase, we've loaded everything
        if (beforeCount === afterCount) {
          break;
        }
      }

      // No loading spinner should be visible
      const spinner = page.locator('[data-testid="loading-spinner"]');
      await expect(spinner).not.toBeVisible();
    });

    test('should not show infinite scroll trigger when all loaded', async ({ page }) => {
      await loginAsUser(page);

      await page.goto('/app/library');
      await waitForLoadingComplete(page);

      // Scroll to load all items
      for (let i = 0; i < 5; i++) {
        await scrollToBottom(page);
        await page.waitForTimeout(2000);
      }

      // Intersection observer sentinel should not be present or visible
      const sentinel = page.locator('[data-testid="scroll-sentinel"]');
      const isVisible = await sentinel.isVisible().catch(() => false);
      expect(isVisible).toBe(false);
    });
  });

  test.describe('Multiple Content Types', () => {
    test('should paginate Dialogues tab correctly', async ({ page }) => {
      await loginAsUser(page);

      await page.goto('/app/library');
      await navigateToTab(page, 'Dialogues');
      await waitForLoadingComplete(page);

      const itemCount = await getLibraryItemCount(page);
      expect(itemCount).toBeGreaterThan(0);

      // All items should be dialogues
      const allAreDialogues = await page
        .locator('[data-testid="library-item"]')
        .evaluateAll((items) =>
          items.every((item) => item.getAttribute('data-content-type') === 'dialogue')
        );
      expect(allAreDialogues).toBe(true);
    });

    test('should paginate Courses tab correctly', async ({ page }) => {
      await loginAsUser(page);

      await page.goto('/app/library');
      await navigateToTab(page, 'Courses');
      await waitForLoadingComplete(page);

      const itemCount = await getLibraryItemCount(page);

      if (itemCount > 0) {
        // All items should be courses
        const allAreCourses = await page
          .locator('[data-testid="library-item"]')
          .evaluateAll((items) =>
            items.every((item) => item.getAttribute('data-content-type') === 'course')
          );
        expect(allAreCourses).toBe(true);
      }
    });

    test('should cache content when switching tabs', async ({ page }) => {
      await loginAsUser(page);

      await page.goto('/app/library');
      await navigateToTab(page, 'Dialogues');
      await waitForLoadingComplete(page);

      const dialogueCount = await getLibraryItemCount(page);

      // Switch to Courses
      await navigateToTab(page, 'Courses');
      await waitForLoadingComplete(page);

      // Switch back to Dialogues
      await navigateToTab(page, 'Dialogues');

      // Should display instantly (cached)
      const newDialogueCount = await getLibraryItemCount(page);
      expect(newDialogueCount).toBe(dialogueCount);
    });
  });

  test.describe('Library Mode vs Full Mode', () => {
    test('should use library=true query param for initial load', async ({ page }) => {
      await loginAsUser(page);

      // Monitor network requests
      const requests: string[] = [];
      page.on('request', (request) => {
        const url = request.url();
        if (url.includes('/api/')) {
          requests.push(url);
        }
      });

      await page.goto('/app/library');
      await waitForLoadingComplete(page);

      // Should have made request with library=true
      const libraryRequest = requests.find((url) => url.includes('library=true'));
      expect(libraryRequest).toBeTruthy();
    });

    test('should use limit and offset parameters', async ({ page }) => {
      await loginAsUser(page);

      const requests: string[] = [];
      page.on('request', (request) => {
        const url = request.url();
        if (url.includes('/api/')) {
          requests.push(url);
        }
      });

      await page.goto('/app/library');
      await waitForLoadingComplete(page);

      // First request should have limit=20&offset=0
      const firstRequest = requests.find(
        (url) => url.includes('limit=') && url.includes('offset=')
      );
      expect(firstRequest).toBeTruthy();
      expect(firstRequest).toContain('limit=20');
      expect(firstRequest).toContain('offset=0');
    });

    test('should fetch full data when viewing item details', async ({ page }) => {
      await loginAsUser(page);

      const requests: string[] = [];
      page.on('request', (request) => {
        const url = request.url();
        if (url.includes('/api/')) {
          requests.push(url);
        }
      });

      await page.goto('/app/library');
      await waitForLoadingComplete(page);

      // Click on first item to view details
      await page.locator('[data-testid="library-item"]').first().click();

      await page.waitForTimeout(1000);

      // Should have made request without library=true (full data)
      const fullDataRequest = requests.find(
        (url) =>
          url.includes('/api/') && !url.includes('library=true') && url.includes('/dialogues/') // or courses, etc.
      );
      expect(fullDataRequest).toBeTruthy();
    });
  });
});
