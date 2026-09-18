import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudyCardSummary } from '@languageflow/shared/src/types';

import { updateStudyCard } from '../useStudy';
import { CSRF_TOKEN_COOKIE_NAME, getCsrfToken } from '../../lib/csrf';
import { decodeStudyCardSummary } from '../../lib/learningOsContractDecoders';
import { studyCardCompatibilityFixture } from '../../test/fixtures/learningOsCompatibility';

const baseCard: StudyCardSummary = {
  ...decodeStudyCardSummary(studyCardCompatibilityFixture.cases[0]!.payload),
  revision: 4,
  cardType: 'cloze',
  prompt: { clozeText: '先生は学生に宿題を{{c1::させました}}。' },
  answer: {
    restoredText: '先生は学生に宿題をさせました。',
    restoredTextReading: '先生[せんせい]は学生[がくせい]に宿題[しゅくだい]をさせました。',
    meaning: 'The teacher made the students do homework.',
  },
};
const currentCard: StudyCardSummary = {
  ...baseCard,
  revision: 5,
  answer: {
    ...baseCard.answer,
    pitchAccent: {
      status: 'unresolved',
      expression: baseCard.answer.restoredText!,
      reason: 'not-found',
      source: 'kanjium',
      resolvedBy: 'none',
    },
  },
};
const edit = {
  cardId: baseCard.id,
  expectedRevision: 4,
  baseCard,
  prompt: baseCard.prompt,
  answer: { ...baseCard.answer, notes: 'する causative: to make or let someone do something.' },
};

const response = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const conflict = (card: unknown = currentCard) =>
  response(
    {
      code: 'card_revision_conflict',
      message: 'Study card content changed since it was loaded.',
      card,
    },
    409
  );

const requestBodies = () =>
  vi.mocked(fetch).mock.calls.map(([, init]) => JSON.parse(String(init?.body)));

describe('saving cards after background pronunciation resolution', () => {
  beforeEach(async () => {
    document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=test-card-save`;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({})));
    await getCsrfToken();
    vi.mocked(fetch).mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.cookie = `${CSRF_TOKEN_COOKIE_NAME}=; Max-Age=0`;
  });

  it('retries the reported cloze edit with the new revision and preserves the draft', async () => {
    const saved = { ...currentCard, revision: 6, answer: edit.answer };
    vi.mocked(fetch).mockResolvedValueOnce(conflict()).mockResolvedValueOnce(response(saved));

    expect(await updateStudyCard(edit)).toEqual(saved);
    expect(requestBodies()).toEqual([
      { prompt: edit.prompt, answer: edit.answer, expectedRevision: 4 },
      { prompt: edit.prompt, answer: edit.answer, expectedRevision: 5 },
    ]);
  });

  it('ignores JSON object key order when comparing the original content', async () => {
    const reordered = {
      ...currentCard,
      answer: {
        meaning: baseCard.answer.meaning,
        restoredTextReading: baseCard.answer.restoredTextReading,
        restoredText: baseCard.answer.restoredText,
        pitchAccent: currentCard.answer.pitchAccent,
      },
    };
    vi.mocked(fetch)
      .mockResolvedValueOnce(conflict(reordered))
      .mockResolvedValueOnce(response(currentCard));

    await updateStudyCard(edit);

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['prompt', { ...currentCard, prompt: { clozeText: '別の{{c1::文}}。' } }],
    [
      'meaning',
      { ...currentCard, answer: { ...currentCard.answer, meaning: 'A different meaning.' } },
    ],
    [
      'reading',
      { ...currentCard, answer: { ...currentCard.answer, restoredTextReading: '変更[へんこう]' } },
    ],
    [
      'media',
      { ...currentCard, answer: { ...currentCard.answer, answerAudio: { url: '/new.mp3' } } },
    ],
    ['card type', { ...currentCard, cardType: 'recognition' }],
    ['card identity', { ...currentCard, id: 'another-card' }],
    ['same revision', { ...currentCard, revision: 4 }],
    ['invalid card', { id: baseCard.id, revision: 5 }],
  ])('does not retry when the conflict changes %s', async (_label, card) => {
    vi.mocked(fetch).mockResolvedValueOnce(conflict(card));

    await expect(updateStudyCard(edit)).rejects.toMatchObject({ status: 409 });

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, { ...baseCard, revision: 3 }, { ...baseCard, id: 'another-card' }])(
    'does not retry without a matching original snapshot (%#)',
    async (snapshot) => {
      vi.mocked(fetch).mockResolvedValueOnce(conflict());

      await expect(updateStudyCard({ ...edit, baseCard: snapshot })).rejects.toMatchObject({
        status: 409,
      });

      expect(fetch).toHaveBeenCalledTimes(1);
    }
  );

  it('keeps the version guard on the retry and stops if another change races it', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(conflict())
      .mockResolvedValueOnce(conflict({ ...currentCard, revision: 6 }));

    await expect(updateStudyCard(edit)).rejects.toMatchObject({ status: 409 });

    expect(requestBodies().map((body) => body.expectedRevision)).toEqual([4, 5]);
  });

  it('passes through ordinary failures without retrying', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ message: 'Unavailable' }, 503));

    await expect(updateStudyCard(edit)).rejects.toMatchObject({ status: 503 });

    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
