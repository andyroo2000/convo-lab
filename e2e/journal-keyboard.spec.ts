import { expect, test, type Locator, type Page } from '@playwright/test';
import { entry, journalKeyboardFixture } from './fixtures/journalKeyboard';

// API fixtures must also apply after a full document navigation.
test.use({ serviceWorkers: 'block' });
test.setTimeout(180000);
async function chooseInput(page: Page) {
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('button', { name: 'Keyboard', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'How would you like to type?' });
  await expect(dialog.getByText(/Remembers|Reset learned/)).toHaveCount(0);
  await dialog.getByRole('button', { name: /Built-in Japanese input/ }).click();
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await page.keyboard.press('Escape');
}
async function convert(page: Page, field: Locator) {
  await expect(field).toBeEditable({ timeout: 120000 });
  await field.fill('');
  await field.pressSequentially('amegafuru', { delay: 60 });
  await expect(field).toHaveValue('あめがふる');
  const choices = page.locator('.journal-kanji-candidates:visible');
  await expect(choices).toBeVisible({ timeout: 20000 });
  await choices.getByRole('button', { name: '雨が降る', exact: true }).click();
  await expect(field).toHaveValue('雨が降る');
  await field.press('Backspace');
  await expect(field).toHaveValue('雨が降');
  await field.press('ControlOrMeta+z');
  await expect(field).toHaveValue('雨が降る');
}

test('native picker works in draft, final and reply, with browser-local settings', async ({
  page,
}, info) => {
  const writes = await journalKeyboardFixture(page);
  await page.goto('/app/journal');
  await chooseInput(page);
  const draft = page.getByRole('textbox', { name: 'Journal entry in Japanese' });
  await convert(page, draft);
  await draft.pressSequentially('.');
  await expect(draft).toHaveValue('雨が降る。');
  await page.screenshot({ path: info.outputPath('draft.png'), fullPage: true });
  expect(
    await page.evaluate(() =>
      Object.values(localStorage).some((value) => value.includes('雨が降る。'))
    )
  ).toBe(true);
  await page.goto(`/app/journal/${entry.id}`);
  await page.getByRole('button', { name: 'Final', exact: true }).click();
  await page.getByLabel('More journal options').first().click();
  await page.getByRole('button', { name: 'Edit final text', exact: true }).click();
  const final = page.getByRole('textbox', { name: 'Final text' });
  await convert(page, final);
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect
    .poll(() => writes.some((w) => w.path.endsWith('/corrected') && w.body.text === '雨が降る'))
    .toBe(true);
  const reply = page.getByRole('textbox', { name: 'Your answer', exact: true });
  await convert(page, reply);
  await reply.pressSequentially('ame');
  await expect(page.locator('.journal-kanji-candidates:visible')).toBeVisible({ timeout: 20000 });
  await page.screenshot({ path: info.outputPath('reply-picker.png'), fullPage: true });
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('button', { name: 'Keyboard', exact: true }).click();
  await page.screenshot({ path: info.outputPath('keyboard-settings.png'), fullPage: true });
  await page.getByRole('button', { name: /Use my keyboard/ }).click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.keyboard.press('Escape');
  await reply.fill('');
  await reply.pressSequentially('ame');
  await expect(reply).toHaveValue('ame');
  await page.reload();
  expect(await page.evaluate(() => localStorage.getItem('convolab:journal-keyboard:v1'))).toBe(
    'device'
  );
});

test('onboarding, punctuation, full candidates, section adjustments and length limits', async ({
  page,
}, info) => {
  await journalKeyboardFixture(page);
  await page.goto('/app/journal');
  const field = page.getByRole('textbox', { name: 'Journal entry in Japanese' });
  await field.click();
  await expect(page.getByRole('dialog', { name: 'How would you like to type?' })).toBeVisible();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(field).toBeEditable({ timeout: 120000 });
  await field.pressSequentially('amegafuru.', { delay: 40 });
  await expect(field).toHaveValue('あめがふる。');
  await expect(field).toHaveClass(/composing/);
  const choices = page.locator('.journal-kanji-candidates:visible');
  await expect(choices.getByRole('button', { name: '雨が降る。', exact: true })).toBeVisible({
    timeout: 20000,
  });
  await page.screenshot({ path: info.outputPath('draft-picker.png'), fullPage: true });
  await choices.getByRole('button', { name: '雨が降る。', exact: true }).click();
  await expect(field).not.toHaveClass(/composing/);
  await field.fill('');
  await field.pressSequentially('ame', { delay: 40 });
  await expect(choices.getByRole('button', { name: '飴', exact: true })).toBeVisible({
    timeout: 20000,
  });
  await expect(choices.getByRole('button', { name: 'ame', exact: true })).toHaveCount(1);
  await choices.getByRole('button', { name: 'ame', exact: true }).click();
  await expect(field).toHaveValue('ame');
  await field.fill('');
  await field.pressSequentially('kyouhaiitenkidesu', { delay: 40 });
  await field.press('Space');
  await expect(page.locator('.composition-section.current')).toBeVisible({ timeout: 20000 });
  const original = await page.locator('.composition-section.current').innerText();
  await field.press('Shift+ArrowRight');
  await expect(page.locator('.composition-section.current')).not.toHaveText(original, {
    timeout: 20000,
  });
  await expect(choices.getByRole('button')).not.toHaveCount(0);
  await field.press('Enter');
  await expect(field).not.toHaveClass(/composing/);
  await field.fill('');
  await field.evaluate((element: HTMLTextAreaElement) => {
    element.maxLength = 3;
  });
  await field.pressSequentially('aaaaaa', { delay: 10 });
  await expect(field).toHaveValue('あああ');
  await field.press('Backspace');
  await expect(field).toHaveValue('ああ');
});

test('entering Journal refreshes document policy while settings remains a modal', async ({
  page,
}) => {
  await journalKeyboardFixture(page);
  const documents: string[] = [];
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.resourceType() === 'document')
      documents.push(new URL(request.url()).pathname);
  });
  await page.goto('/app');
  await expect(page).toHaveURL(/\/app\/journal$/);
  await expect(page.getByRole('textbox', { name: 'Journal entry in Japanese' })).toBeVisible();
  expect(documents).toContain('/app/journal');
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
  const count = documents.length;
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByTestId('user-menu-item-settings').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(documents).toHaveLength(count);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/app\/journal$/);
});
