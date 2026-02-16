import { expect, test, type Page } from '@playwright/test';

const DATE_YEAR_URL = '/tools-audio/japanese-date/google-kento-professional/date/year/2026.mp3';
const DATE_MONTH_URL = '/tools-audio/japanese-date/google-kento-professional/date/month/02.mp3';
const DATE_DAY_URL = '/tools-audio/japanese-date/google-kento-professional/date/day/13.mp3';

const TIME_24H_HOUR_URL =
  '/tools-audio/japanese-time/google-kento-professional/time/24h/part1/21.mp3';
const TIME_12H_HOUR_URL =
  '/tools-audio/japanese-time/google-kento-professional/time/12h/part1/gogo-09.mp3';
const TIME_MINUTE_URL = '/tools-audio/japanese-time/google-kento-professional/time/minute/44.mp3';

async function installAudioMock(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const playedClips: string[] = [];

    class MockAudio extends EventTarget {
      src = '';
      preload = 'auto';
      currentTime = 0;

      constructor(src?: string) {
        super();
        this.src = src ?? '';
      }

      play(): Promise<void> {
        playedClips.push(this.src);
        queueMicrotask(() => {
          this.dispatchEvent(new Event('ended'));
        });
        return Promise.resolve();
      }

      pause(): void {
        // no-op
      }
    }

    Object.defineProperty(window, 'Audio', {
      configurable: true,
      writable: true,
      value: MockAudio,
    });

    Object.defineProperty(window, '__playedClips', {
      configurable: true,
      writable: true,
      value: playedClips,
    });
  });
}

async function getPlayedClips(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const value = (window as Window & { __playedClips?: string[] }).__playedClips;
    return value ? [...value] : [];
  });
}

test.describe('Japanese tools routes and playback', () => {
  test('supports public tools directory routes', async ({ page }) => {
    await page.goto('/tools');

    await expect(page.getByRole('heading', { name: 'ConvoLab Tools' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Japanese Date' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Japanese Time' })).toBeVisible();

    await page.getByRole('link', { name: /Open/i }).first().click();
    await expect(page).toHaveURL(/\/tools\/japanese-date$/);

    await page.goto('/tools');
    await page.getByRole('link', { name: /Open/i }).nth(1).click();
    await expect(page).toHaveURL(/\/tools\/japanese-time$/);
  });

  test('preserves app-route continuity by redirecting unauthenticated users with return URL', async ({
    page,
  }) => {
    await page.goto('/app/tools/japanese-date');

    await expect(page).toHaveURL(/\/login\?returnUrl=%2Fapp%2Ftools%2Fjapanese-date$/);
  });

  test('applies furigana toggle effects on time tool', async ({ page }) => {
    await page.goto('/tools/japanese-time');

    const toggle = page.getByRole('button', { name: 'Hide Furigana' });
    await expect(toggle).toBeVisible();
    await expect(page.locator('rt.invisible')).toHaveCount(0);

    await toggle.click();
    await expect(page.getByRole('button', { name: 'Show Furigana' })).toBeVisible();
    await expect
      .poll(async () => page.locator('rt.invisible').count(), { timeout: 5000 })
      .toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Show Furigana' }).click();
    await expect(page.getByRole('button', { name: 'Hide Furigana' })).toBeVisible();
    await expect(page.locator('rt.invisible')).toHaveCount(0);
  });

  test('plays date clips in deterministic year-month-day order', async ({ page }) => {
    await installAudioMock(page);
    await page.goto('/tools/japanese-date');

    await page.locator('#jp-date-input').fill('2026-02-13');
    await page.getByRole('button', { name: 'Play' }).click();

    await expect.poll(async () => (await getPlayedClips(page)).length, { timeout: 5000 }).toBe(3);

    const played = await getPlayedClips(page);
    expect(played).toEqual([DATE_YEAR_URL, DATE_MONTH_URL, DATE_DAY_URL]);
  });

  test('plays time clips in deterministic 24h order', async ({ page }) => {
    await installAudioMock(page);
    await page.goto('/tools/japanese-time');

    await page.getByRole('button', { name: '24h' }).click();
    await page.locator('.retro-time-picker-trigger').click();

    const inputs = page.locator('div[role="dialog"] input[type="number"]');
    await inputs.nth(0).fill('21');
    await inputs.nth(1).fill('44');
    await page.getByRole('heading', { name: 'Japanese Time' }).click();

    await page.getByRole('button', { name: 'Play' }).click();

    await expect.poll(async () => (await getPlayedClips(page)).length, { timeout: 5000 }).toBe(2);

    const played = await getPlayedClips(page);
    expect(played).toEqual([TIME_24H_HOUR_URL, TIME_MINUTE_URL]);
  });

  test('maps PM 12h playback to gogo hour clip', async ({ page }) => {
    await installAudioMock(page);
    await page.goto('/tools/japanese-time');

    await page.getByRole('button', { name: '12h' }).click();
    await page.locator('.retro-time-picker-trigger').click();

    const inputs = page.locator('div[role="dialog"] input[type="number"]');
    await inputs.nth(0).fill('9');
    await inputs.nth(1).fill('44');
    await page.getByRole('button', { name: 'PM', exact: true }).click();
    await page.getByRole('heading', { name: 'Japanese Time' }).click();

    await page.getByRole('button', { name: 'Play' }).click();

    await expect.poll(async () => (await getPlayedClips(page)).length, { timeout: 5000 }).toBe(2);

    const played = await getPlayedClips(page);
    expect(played).toEqual([TIME_12H_HOUR_URL, TIME_MINUTE_URL]);
  });
});
