import { expect, test, type Page } from '@playwright/test';

const entry = {
  id: '01arz3ndektsv4rrffq69g5fav',
  title: '日本語のレッスン',
  body: '今朝は日本語のレッスンがあった。今日のレッスンは楽しかった。先生と一緒に笑った。',
  entryDate: '2026-11-17',
  version: 1,
  createdAt: '2026-11-17T10:00:00Z',
  updatedAt: '2026-11-17T10:00:00Z',
};
const tutors = [
  { id: 'hana', name: 'Hana', gender: 'F', avatar: 'hana-v1', avatarUrl: '/fixture-hana.webp' },
  { id: 'ren', name: 'Ren', gender: 'M', avatar: 'ren-v1', avatarUrl: '/fixture-ren.webp' },
];
const analysis = {
  id: '01arz3ndektsv4rrffq69g5faw',
  sourceVersion: 1,
  status: 'ready',
  error: null,
  updatedAt: entry.updatedAt,
  replyRevision: 0,
  result: {
    title: entry.title,
    correctedText: entry.body,
    correctedReading: entry.body,
    question: '今日は先生と何を話しましたか。',
    questionReading: '今日は先生と何を話しましたか。',
    questionTranslation: 'What did you talk about with your teacher today?',
    segments: [
      {
        text: entry.body,
        reading: entry.body,
        kind: 'plain',
        suggestion: null,
        suggestionReading: null,
        explanation: null,
        explanationReading: null,
      },
    ],
  },
};

async function fixture(page: Page, correction = false) {
  let selectedId = 'hana';
  await page.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }));
  await page.route('**/fixture-*.webp', async (route) => {
    const source = process.env.JOURNAL_AVATAR_DIRECTORY;
    if (source)
      await route.fulfill({
        path: `${source}/${route.request().url().includes('hana') ? 'professor-female' : 'male-02'}-preview.webp`,
      });
    else await route.fulfill({ status: 404 });
  });
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/journal/tutor' && route.request().method() === 'PUT')
      selectedId = route.request().postDataJSON().tutorId;
    const responses: Record<string, unknown> = {
      '/api/convolab/auth/me': {
        id: 'reader',
        name: 'Andrew',
        role: 'user',
        email: 'reader@example.test',
        onboardingCompleted: true,
      },
      '/api/feature-flags': {
        id: 'flags',
        flashcardsEnabled: false,
        readingsEnabled: false,
        studyTimeEnabled: false,
      },
      '/api/journal/entries': { data: [entry], nextCursor: null },
      [`/api/journal/entries/${entry.id}`]: { data: entry },
      [`/api/journal/entries/${entry.id}/analysis`]: {
        data: correction
          ? {
              ...analysis,
              result: {
                ...analysis.result,
                segments: [
                  {
                    text: 'レッソンが取り消した',
                    reading: 'レッソンが取[と]り消[け]した',
                    kind: 'correction',
                    replacement: 'レッスンが中止になった',
                    replacementReading: 'レッスンが中止[ちゅうし]になった',
                    explanation:
                      'Use レッスン for the spelling. 中止になった means **was canceled** and fits a scheduled lesson. With が取り消した, the lesson itself would be doing the canceling. 留学生体験授業 describes a student trial lesson.',
                    explanationReading:
                      'Use レッスン for the spelling. 中止になった means **was canceled** and fits a scheduled lesson. With が取り消した, the lesson itself would be doing the canceling. 留学生[りゅうがくせい]体験[たいけん]授業[じゅぎょう] describes a student trial lesson.',
                  },
                ],
              },
            }
          : analysis,
        entry,
      },
      [`/api/journal/entries/${entry.id}/conversation`]: { data: [] },
      [`/api/journal/entries/${entry.id}/question`]: {
        data: {
          id: 'question',
          text: analysis.result.question,
          reading: analysis.result.questionReading,
          translation: analysis.result.questionTranslation,
          tutor: tutors[0],
        },
      },
      [`/api/journal/entries/${entry.id}/audio`]: { data: { voiceId: 'ren', hasAudio: false } },
      '/api/journal/voices': { data: [{ id: 'ren', name: 'Ren', avatarUrl: '/fixture-ren.webp' }] },
      '/api/journal/tutor': { data: { selectedId, tutors } },
    };
    await route.fulfill({ json: responses[path] ?? { data: [] } });
  });
  await page.goto(`/app/journal/${entry.id}`);
  await expect(page.getByRole('button', { name: 'Contents', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Hana, your tutor' })).toBeVisible();
  await page.getByRole('button', { name: 'Final', exact: true }).click();
  await expect(page.locator('.journal-narrator-avatar')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

test('Contents, entry actions, and account preferences stay at their proper levels', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await fixture(page);
  await page.screenshot({ path: info.outputPath('desktop-contents.png'), fullPage: true });
  const nav = page.locator('.journal-topbar');
  await expect(nav.getByRole('button', { name: 'Contents', exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: /New entry/ })).toHaveCount(0);
  await expect(nav.getByRole('button', { name: 'Final', exact: true })).toHaveCount(0);
  const logo = await nav.getByRole('link', { name: 'ConvoLab Journal home' }).boundingBox();
  const account = await nav.getByRole('button', { name: 'Account menu' }).boundingBox();
  expect(logo!.x).toBeLessThan(40);
  expect(1440 - account!.x - account!.width).toBeLessThan(40);
  await nav.getByRole('button', { name: 'Contents', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Contents' })).toBeVisible();
  await page.keyboard.press('Escape');
  await nav.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  await page.getByRole('button', { name: 'Sans-serif', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Journal appearance' })).toBeVisible();
  await page.getByRole('button', { name: 'Close appearance' }).click();
  await expect(page.getByRole('button', { name: 'Appearance', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Choose your tutor', exact: true }).click();
  await page.getByRole('button', { name: 'Ren (M)' }).click();
  await expect(page.getByRole('dialog', { name: 'Choose your tutor' })).not.toBeVisible();
  await expect(page.getByRole('img', { name: 'Hana, your tutor' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choose your tutor', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(nav.getByRole('button', { name: 'Account menu' })).toBeFocused();
  await page.getByLabel('More journal options').first().click();
  await page.getByRole('button', { name: 'Edit final text' }).click();
  await expect(nav.getByRole('button', { name: 'Contents', exact: true })).toBeDisabled();
});

test('a tutor reply uses notebook paper and restores multiline writing on a phone', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await fixture(page);
  const reply = page
    .getByRole('article', { name: 'Notebook sheet' })
    .getByRole('textbox', { name: 'Your answer' });
  await expect(reply).toHaveAttribute('placeholder', '返事を書く…');
  const answer = '先生、ありがとうございます。\n次は友達と京都へ行きたいです。'.repeat(5);
  await reply.fill(answer);
  expect(await reply.evaluate((field) => field.scrollHeight <= field.clientHeight + 1)).toBe(true);
  await page.reload();
  await expect(reply).toHaveValue(answer);
});

test('phone header fits and the larger illustrated Listen bars stay attached to entries', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page);
  await page.screenshot({ path: info.outputPath('phone-contents.png'), fullPage: true });
  for (const width of [390, 375, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    for (const name of ['Contents', 'Account menu']) {
      const box = await page.getByRole('button', { name, exact: true }).boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
  }
});

test('Journal serif settings keep account actions usable on desktop and phones', async ({
  page,
}, info) => {
  await fixture(page);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const account = page.getByRole('button', { name: 'Account menu', exact: true });
    await expect(account.locator('.journal-account-avatar')).toHaveCSS('font-family', /Anton/);
    await account.click();
    await expect(page.getByTestId('user-menu-item-credits')).toHaveCount(0);
    await page.getByTestId('user-menu-item-settings').click();
    const dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Account', exact: true })).toHaveCSS(
      'font-family',
      /Crimson Pro/
    );
    await expect(dialog.getByRole('heading', { name: 'Settings', exact: true })).toHaveCSS(
      'font-family',
      /Crimson Pro/
    );
    for (const name of ['Edit profile', 'Change password', 'Sign out', 'Delete account']) {
      const box = await dialog.getByRole('button', { name, exact: true }).boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({ path: info.outputPath(`settings-${width}.png`) });
    await dialog.getByRole('button', { name: 'Edit profile' }).click();
    await expect(page.getByLabel('Email', { exact: true })).toHaveValue('reader@example.test');
    await page.getByRole('button', { name: 'Back to settings' }).click();
    await expect(dialog.getByRole('button', { name: 'Edit profile' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(account).toBeFocused();
  }
});

test('copy confirmation sits above the menu on Draft and Final', async ({
  page,
  context,
}, info) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page);
  for (const version of ['Draft', 'Final']) {
    await page.getByRole('button', { name: version, exact: true }).click();
    const options = page.getByLabel('More journal options').first();
    await options.click();
    await page
      .getByRole('button', { name: `Copy text (Copy ${version.toLowerCase()} text)` })
      .click();
    const toast = page.getByText('Text copied', { exact: true });
    await expect(toast).toBeVisible();
    await expect(options).toBeFocused();
    const confirmation = (await toast.boundingBox())!;
    const trigger = (await options.boundingBox())!;
    expect(confirmation.y + confirmation.height).toBeLessThanOrEqual(trigger.y);
    expect(confirmation.x).toBeGreaterThanOrEqual(0);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(entry.body);
    await page.screenshot({ path: info.outputPath(`copy-${version.toLowerCase()}.png`) });
    await expect(toast).not.toBeVisible({ timeout: 3500 });
  }
});

test('mixed-language correction stays readable inside rounded paper', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page, true);
  await page.getByRole('button', { name: 'Draft', exact: true }).click();
  await page.getByRole('button', { name: /^Correction: Replace/ }).click();
  const popup = page.getByRole('dialog', { name: 'Correction', exact: true });
  await expect(popup).toBeVisible();
  await expect(popup).toContainText('canceling');
  const box = (await popup.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: info.outputPath('correction.png') });
});

test('adjacent long readings keep their own space inside the correction', async ({
  page,
}, info) => {
  await fixture(page, true);
  await page.getByRole('button', { name: 'Draft', exact: true }).click();
  const anchor = page.getByRole('button', { name: /^Correction: Replace/ });
  const popup = page.getByRole('dialog', { name: 'Correction', exact: true });
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    await anchor.blur();
    await anchor.focus();
    await expect(popup).toBeVisible();
    const readings = await popup.locator('.journal-explanation rt').evaluateAll((elements) =>
      elements.map((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const { left, right, top, bottom } = range.getBoundingClientRect();
        const base = element.previousElementSibling!.getBoundingClientRect();
        return { left, right, top, bottom, baseTop: base.top };
      })
    );
    expect(readings).toHaveLength(3);
    expect(readings.every((reading) => (reading.top + reading.bottom) / 2 < reading.baseTop)).toBe(
      true
    );
    for (let i = 1; i < readings.length; i += 1) {
      const previous = readings[i - 1];
      const current = readings[i];
      expect(current.left >= previous.right - 0.5 || current.top >= previous.bottom).toBe(true);
    }
    await page.screenshot({ path: info.outputPath(`adjacent-readings-${width}.png`) });
  }
});
