import { beforeEach, describe, expect, it } from 'vitest';

import {
  acknowledgeStudyDraftIntent,
  clearStudyDraftIntent,
  isStudyDraftIntentApplied,
  readStudyDraftIntent,
  writeStudyDraftIntent,
} from '../studyDraftIntentStore';

describe('studyDraftIntentStore', () => {
  beforeEach(() => window.localStorage.clear());

  it('durably replaces a draft intent with the newest edit', () => {
    const first = writeStudyDraftIntent({
      draftId: 'draft-1',
      baseRevision: 4,
      values: { answer: { meaning: 'business' } },
    });
    const newest = writeStudyDraftIntent({
      draftId: 'draft-1',
      baseRevision: 4,
      values: { answer: { meaning: 'enterprise' } },
    });

    expect(newest.intentId).not.toBe(first.intentId);
    expect(readStudyDraftIntent('draft-1')).toEqual(newest);
  });

  it('only clears the exact intent acknowledged by the server', () => {
    const older = writeStudyDraftIntent({
      draftId: 'draft-1',
      baseRevision: 4,
      values: { answer: { meaning: 'business' } },
    });
    const newest = writeStudyDraftIntent({
      draftId: 'draft-1',
      baseRevision: 4,
      values: { answer: { meaning: 'enterprise' } },
    });

    acknowledgeStudyDraftIntent(older, 5);

    expect(readStudyDraftIntent('draft-1')).toEqual({ ...newest, baseRevision: 5 });

    acknowledgeStudyDraftIntent({ ...newest, baseRevision: 5 }, 6);
    expect(readStudyDraftIntent('draft-1')).toBeNull();
  });

  it('does not clear a newer intent when dismissing a stale recovery prompt', () => {
    const stale = writeStudyDraftIntent({
      draftId: 'draft-1',
      baseRevision: 4,
      values: { answer: { meaning: 'business' } },
    });
    const newest = writeStudyDraftIntent({
      draftId: 'draft-1',
      baseRevision: 5,
      values: { answer: { meaning: 'enterprise' } },
    });

    clearStudyDraftIntent(stale);

    expect(readStudyDraftIntent('draft-1')).toEqual(newest);
  });

  it('drops corrupt or unsupported persisted data', () => {
    window.localStorage.setItem('convolab.studyDraftIntent.v1.draft-1', '{bad json');
    expect(readStudyDraftIntent('draft-1')).toBeNull();

    window.localStorage.setItem(
      'convolab.studyDraftIntent.v1.draft-1',
      JSON.stringify({ version: 2, draftId: 'draft-1' })
    );
    expect(readStudyDraftIntent('draft-1')).toBeNull();
  });

  it('recognizes an intent that committed before its response was lost', () => {
    const intent = writeStudyDraftIntent({
      draftId: 'draft-1',
      baseRevision: 4,
      values: { answer: { meaning: 'enterprise' }, imagePrompt: null },
    });

    expect(
      isStudyDraftIntentApplied(intent, {
        id: 'draft-1',
        revision: 5,
        answer: { meaning: 'enterprise' },
        imagePrompt: null,
      } as never)
    ).toBe(true);
  });
});
