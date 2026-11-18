import { expect, test, type Page } from '@playwright/test';
const counts = {
  originals: 3,
  followups: 5,
  activeUsers: 2,
  averageEntryCharacters: 180,
  averageFollowupCharacters: 45,
};
const buckets = Array.from({ length: 18 }, (_, i) => ({
  ...counts,
  date: `2026-11-${String(i + 1).padStart(2, '0')}`,
  originals: (i * 3) % 11,
  followups: (i * 2) % 8,
}));
const analyticsFixture = {
  activity: {
    period: 'daily',
    start: '2026-10-22',
    end: '2026-11-18',
    buckets,
    summary: { ...counts, originals: 86, followups: 53, averageFollowupsPerEntry: 1.7 },
  },
  month: {
    start: '2026-11-01',
    asOf: '2026-11-18',
    elapsedDays: 17.5,
    daysInMonth: 30,
    activeUsers: 10,
    averageCostPerActiveUserUsd: 1.5,
    projectedMonthlyCostPerActiveUserUsd: 2.57,
    inferenceUsd: 5,
    ttsUsd: 10,
    unknownRequests: 0,
    calendar: buckets,
    trackingSince: '2026-11-01',
  },
  writers: {
    data: ['Mika', 'Sam', 'Jordan'].map((name, i) => ({
      id: name,
      name,
      avatarUrl: null,
      entries: 18 - i,
      followups: 24 - i,
      inferenceUsd: 1,
      ttsUsd: 2,
      estimatedCostUsd: 3,
      unknownRequests: 0,
      dailyAverageUsd: 0.17,
      projectedMonthlyUsd: 5.14,
      breakdown: [
        {
          category: 'tts',
          operation: 'journal.audio',
          provider: 'fish',
          model: 's2-pro',
          estimatedUsd: 2,
          requests: 18,
          unknownRequests: 0,
        },
      ],
    })),
    page: 1,
    perPage: 25,
    total: 3,
  },
};
async function fixture(page: Page, admin = true) {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const responses: Record<string, unknown> = {
      '/api/convolab/auth/me': {
        id: 'admin',
        name: 'Admin',
        role: admin ? 'admin' : 'user',
        email: 'admin@example.test',
        onboardingCompleted: true,
      },
      '/api/feature-flags': {
        id: 'flags',
        flashcardsEnabled: false,
        readingsEnabled: false,
        studyTimeEnabled: false,
      },
      '/api/convolab/admin/users': { users: [] },
      '/api/readings': { data: [] },
      '/api/journal/entries': { data: [], nextCursor: null },
      '/api/convolab/admin/journal-analytics': analyticsFixture,
    };
    await route.fulfill({ json: responses[path] ?? { data: [] } });
  });
}
test('tabbed analytics works on desktop and a narrow screen', async ({ page }, info) => {
  await fixture(page);
  await page.goto('/app/admin/analytics');
  await expect(page.getByRole('heading', { name: 'Writing calendar' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Avatars', exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('analytics-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Writers', exact: true }).click();
  await expect(page.getByText('Mika', { exact: true })).toBeVisible();
  await page.getByText('$3.00', { exact: true }).first().click();
  await expect(page.getByText('s2-pro', { exact: false }).first()).toBeVisible();
  await page.screenshot({ path: info.outputPath('writer-costs.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Activity', exact: true }).click();
  await page.screenshot({ path: info.outputPath('analytics-mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
});
test('disabled sections are absent and direct links return to Journal', async ({ page }) => {
  await fixture(page, false);
  await page.goto('/app/readings');
  await expect(page).toHaveURL(/\/app\/journal$/);
  await expect(page.getByRole('link', { name: 'Study Time', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Readings', exact: true })).toHaveCount(0);
  await page.goto('/app/study/time');
  await expect(page).toHaveURL(/\/app\/journal$/);
});
