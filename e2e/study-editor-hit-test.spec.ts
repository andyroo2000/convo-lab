import { Locator, Page, expect, test } from '@playwright/test';

import { loginAsUser } from './utils/test-helpers';

/**
 * Regression guard for the study editor hit-testing bug fixed in PR #150.
 *
 * PR #147 switched structural containers in StudyPage.tsx from overflow-x-hidden
 * to overflow-x-clip. In Chromium, clip caused content overflowing the editor
 * wrapper's md:min-h-[60vh] box vertically to be painted but NOT hit-testable:
 * the Save / Regenerate audio / Cancel / Delete buttons were visible but received
 * no pointer events at desktop widths on tall cards. Unit tests can only assert
 * class names; this test drives a real Chromium browser so the actual hit-test
 * behavior is exercised.
 */

// Long enough that the cloze edit form overflows the md:min-h-[60vh] wrapper and
// the 800px viewport, pushing the button row below the fold — the exact scenario
// where overflow-x-clip broke pointer events.
const LONG_CLAUSE =
  'このカードはとても長い文章を含んでいて、編集フォームがデスクトップ表示の最小高さを大きく超えることを保証します。'.repeat(
    6
  );
const LONG_NOTES =
  'These notes are intentionally verbose so the editor form grows well past the viewport. '.repeat(
    20
  );

const buildTallCard = () => {
  const now = new Date().toISOString();

  return {
    id: 'e2e-tall-editor-card',
    noteId: 'e2e-tall-editor-note',
    cardType: 'cloze',
    prompt: {
      cueText: null,
      cueReading: null,
      cueMeaning: null,
      cueAudio: null,
      cueImage: null,
      clozeText: `${LONG_CLAUSE}富士山は日本で一番[...]山です。${LONG_CLAUSE}`,
      clozeDisplayText: null,
      clozeAnswerText: '高い',
      clozeHint: 'tall',
      clozeResolvedHint: null,
    },
    answer: {
      expression: null,
      expressionReading: null,
      meaning: 'A deliberately long cloze card used to overflow the study editor.',
      notes: LONG_NOTES,
      sentenceJp: LONG_CLAUSE,
      sentenceJpKana: null,
      sentenceEn: LONG_NOTES,
      restoredText: `${LONG_CLAUSE}富士山は日本で一番高い山です。${LONG_CLAUSE}`,
      restoredTextReading: null,
      answerAudioVoiceId: null,
      answerAudioTextOverride: null,
      answerAudio: null,
      answerImage: null,
      pitchAccent: null,
    },
    state: {
      dueAt: null,
      introducedAt: null,
      failedAt: null,
      queueState: 'new',
      scheduler: {
        due: now,
        stability: 0,
        difficulty: 0,
        elapsed_days: 0,
        scheduled_days: 0,
        learning_steps: 0,
        reps: 0,
        lapses: 0,
        state: 0,
        last_review: null,
      },
      source: {},
      rawFsrs: null,
    },
    answerAudioSource: 'missing',
    createdAt: now,
    updatedAt: now,
  };
};

const buildOverview = () => ({
  dueCount: 0,
  failedCount: 0,
  newCount: 1,
  newCardsPerDay: 20,
  newCardsIntroducedToday: 0,
  newCardsAvailableToday: 1,
  learningCount: 0,
  reviewCount: 0,
  suspendedCount: 0,
  totalCards: 1,
  latestImport: null,
  nextDueAt: null,
});

/**
 * Assert that the browser's hit-testing actually resolves to the given element
 * at its visual center. With the overflow-x-clip regression the button is
 * painted but document.elementFromPoint resolves to an ancestor container, so
 * this is the direct probe for the bug.
 */
async function expectHitTestTarget(locator: Locator): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();

  const isHitTarget = await locator.evaluate(
    (element, point) => {
      const target = document.elementFromPoint(point.x, point.y);
      return target !== null && (target === element || element.contains(target));
    },
    { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 }
  );
  expect(isHitTarget).toBe(true);
}

async function mockTallCardSession(page: Page): Promise<void> {
  const card = buildTallCard();
  const overview = buildOverview();

  await page.route('**/api/study/overview*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(overview),
    });
  });

  await page.route('**/api/study/session/start', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ overview, cards: [card] }),
    });
  });

  // The session prewarms answer audio for cards without it; answer with the
  // same audio-less card so the bounded retries stay quiet.
  await page.route('**/api/study/cards/*/prepare-answer-audio', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(card),
    });
  });
}

test.describe('Study editor hit-testing on tall cards (desktop)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('editor buttons below the fold receive pointer events and Cancel closes the editor', async ({
    page,
  }) => {
    await loginAsUser(page);
    await mockTallCardSession(page);

    await page.goto('/app/study');
    await page.getByRole('button', { name: 'Begin Study' }).click();
    await expect(page.getByTestId('study-focus-shell')).toBeVisible();

    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await expect(page.getByTestId('study-review-actions')).toBeVisible();

    await page.getByRole('button', { name: 'Edit card' }).click();
    const editor = page.getByTestId('study-card-editor');
    await expect(editor).toBeVisible();

    // Precondition for the regression: the edit form must be taller than the
    // md:min-h-[60vh] wrapper around it, so the button row starts below the
    // fold. (The wrapper's overflow-x-hidden makes it the scroll container —
    // a hidden x-axis forces the y-axis to compute to auto — which is exactly
    // why switching it to overflow-x-clip broke hit-testing on the overflow.)
    const overflowsVertically = await editor.evaluate((form) => {
      const wrapper = form.parentElement;
      return wrapper !== null && form.scrollHeight > wrapper.clientHeight + 100;
    });
    expect(overflowsVertically).toBe(true);

    const saveButton = editor.getByRole('button', { name: 'Save card' });
    const regenerateButton = editor.getByRole('button', { name: 'Regenerate audio' });
    const cancelButton = editor.getByRole('button', { name: 'Cancel' });
    const deleteButton = editor.getByRole('button', { name: 'Delete card' });

    // With overflow-x-clip these were painted but not hit-testable: hovering or
    // clicking hit an ancestor instead of the button.
    await expectHitTestTarget(saveButton);
    await expectHitTestTarget(regenerateButton);
    await expectHitTestTarget(deleteButton);
    await expectHitTestTarget(cancelButton);

    // The real user-facing check: Cancel must actually receive the click and
    // close the editor. Playwright's click performs its own hit-target check,
    // so the regression would surface as an "intercepts pointer events" timeout.
    await cancelButton.click();
    await expect(editor).not.toBeVisible();
    await expect(page.getByTestId('study-review-actions')).toBeVisible();
    await expect(page.getByTestId('study-grade-tray')).toBeVisible();
  });
});
