import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  acknowledgeStudyDraftIntent,
  clearStudyDraftIntent,
  isStudyDraftIntentApplied,
  readStudyDraftIntent,
  writeStudyDraftIntent,
} from '../studyDraftIntentStore';

describe('studyDraftIntentStore', () => {
  beforeEach(() => window.localStorage.clear());

  afterEach(() => vi.restoreAllMocks());

  it('durably replaces a draft intent with the newest edit', () => {
    const first = writeStudyDraftIntent({
      ownerId: 'user-1',
      draftId: 'draft-1',
      baseRevision: 4,
      values: { answer: { meaning: 'business' } },
    });
    const newest = writeStudyDraftIntent({
      ownerId: 'user-1',
      draftId: 'draft-1',
      baseRevision: 4,
      values: { answer: { meaning: 'enterprise' } },
    });

    expect(newest.intentId).not.toBe(first.intentId);
    expect(readStudyDraftIntent('user-1', 'draft-1')).toEqual(newest);
  });

  it('only clears the exact intent acknowledged by the server', () => {
    const older = writeStudyDraftIntent({
      ownerId: 'user-1',
      draftId: 'draft-1',
      baseRevision: 4,
      values: { answer: { meaning: 'business' } },
    });
    const newest = writeStudyDraftIntent({
      ownerId: 'user-1',
      draftId: 'draft-1',
      baseRevision: 4,
      values: { answer: { meaning: 'enterprise' } },
    });

    acknowledgeStudyDraftIntent(older);

    expect(readStudyDraftIntent('user-1', 'draft-1')).toEqual(newest);

    acknowledgeStudyDraftIntent(newest);
    expect(readStudyDraftIntent('user-1', 'draft-1')).toBeNull();
  });

  it('does not clear a newer intent when dismissing a stale recovery prompt', () => {
    const stale = writeStudyDraftIntent({
      ownerId: 'user-1',
      draftId: 'draft-1',
      baseRevision: 4,
      values: { answer: { meaning: 'business' } },
    });
    const newest = writeStudyDraftIntent({
      ownerId: 'user-1',
      draftId: 'draft-1',
      baseRevision: 5,
      values: { answer: { meaning: 'enterprise' } },
    });

    clearStudyDraftIntent(stale);

    expect(readStudyDraftIntent('user-1', 'draft-1')).toEqual(newest);
  });

  it('isolates intents by effective owner identity', () => {
    writeStudyDraftIntent({
      ownerId: 'user-1',
      draftId: 'draft-1',
      baseRevision: 4,
      values: { answer: { meaning: 'business' } },
    });

    expect(readStudyDraftIntent('user-2', 'draft-1')).toBeNull();
  });

  it('removes corrupt data and reports that recovery was unavailable', () => {
    window.localStorage.setItem('convolab.studyDraftIntent.v2.user-1.draft-1', '{bad json');
    expect(() => readStudyDraftIntent('user-1', 'draft-1')).toThrow('corrupt');
    expect(window.localStorage.getItem('convolab.studyDraftIntent.v2.user-1.draft-1')).toBeNull();

    window.localStorage.setItem(
      'convolab.studyDraftIntent.v2.user-1.draft-1',
      JSON.stringify({ version: 2, draftId: 'draft-1' })
    );
    expect(() => readStudyDraftIntent('user-1', 'draft-1')).toThrow('unsupported format');
  });

  it('reports quota failures instead of claiming the edit is durable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    expect(() =>
      writeStudyDraftIntent({
        ownerId: 'user-1',
        draftId: 'draft-1',
        baseRevision: 4,
        values: { answer: { meaning: 'business' } },
      })
    ).toThrow('Could not store');
  });

  it('recognizes an intent that committed before its response was lost', () => {
    const intent = writeStudyDraftIntent({
      ownerId: 'user-1',
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
