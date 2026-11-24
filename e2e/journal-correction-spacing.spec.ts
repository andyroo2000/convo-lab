import { expect, test } from '@playwright/test';
import { entry, journalKeyboardFixture } from './fixtures/journalKeyboard';

test.use({ serviceWorkers: 'block' });

const segments = [
  {
    text: '日曜い',
    reading: '日曜[にちよう]い',
    kind: 'correction',
    replacement: '日曜日',
    explanation: 'Sunday spelling.',
  },
  {
    text: 'そのこと',
    reading: 'そのこと',
    kind: 'correction',
    replacement: 'その番組',
    explanation: 'Refer to the TV show.',
  },
  {
    text: 'を見ている。いつもテレビを見ながら笑う。',
    reading: 'を見ている。いつもテレビを見ながら笑[わら]う。',
    kind: 'plain',
  },
  {
    text: 'いる',
    reading: 'いる',
    kind: 'optional',
    replacement: '出ている',
    explanation: 'Appearing in a show.',
  },
].map((segment) => ({
  suggestion: null,
  suggestionReading: null,
  explanation: null,
  explanationReading: null,
  ...segment,
}));

test('adjacent corrections have a paper gap and independent explanations across widths', async ({
  page,
}, info) => {
  await journalKeyboardFixture(page);
  await page.route('**/api/journal/entries/*/analysis', (route) =>
    route.fulfill({
      json: {
        entry,
        data: {
          id: '01arz3ndektsv4rrffq69g5faw',
          sourceVersion: 1,
          status: 'ready',
          error: null,
          replyRevision: 0,
          updatedAt: entry.updatedAt,
          result: {
            title: entry.title,
            correctedText: entry.body,
            correctedReading: entry.body,
            question: 'どうでしたか。',
            questionReading: 'どうでしたか。',
            questionTranslation: 'How was it?',
            segments,
          },
        },
      },
    })
  );
  await page.goto(`/app/journal/${entry.id}`);
  await page.getByRole('button', { name: 'Draft', exact: true }).click();
  const first = page.getByRole('button', {
    name: 'Correction: Replace 日曜い with 日曜日',
    exact: true,
  });
  const second = page.getByRole('button', {
    name: 'Correction: Replace そのこと with その番組',
    exact: true,
  });
  for (const width of [1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(first).toBeVisible();
    const left = await first.boundingBox();
    const right = await second.boundingBox();
    expect(left).not.toBeNull();
    expect(right).not.toBeNull();
    expect(right!.x - left!.x - left!.width).toBeCloseTo(6, 0);
    await page.screenshot({ path: info.outputPath(`paper-gap-${width}.png`), fullPage: true });
    await first.click();
    await expect(page.getByRole('dialog')).toContainText('Sunday spelling.');
    await page.keyboard.press('Escape');
    await second.click();
    await expect(page.getByRole('dialog')).toContainText('Refer to the TV show.');
    await page.keyboard.press('Escape');
  }
  const separated = page.getByRole('button', {
    name: 'Optional change: Replace いる with 出ている',
    exact: true,
  });
  expect(await separated.evaluate((element) => getComputedStyle(element).marginLeft)).toBe('0px');
});
