import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JournalDraftStore, newJournalDraft } from '../journalDrafts';
import type { JournalDraft, JournalEntry } from '../types';

function savedEntry(draft: JournalDraft): JournalEntry {
  return { ...draft, version: 1, createdAt: '2026-11-12', updatedAt: '2026-11-12' };
}

describe('offline journal drafts', () => {
  beforeEach(() => localStorage.clear());

  it('keeps writing exact and isolates drafts by account', () => {
    const draft = { ...newJournalDraft(), body: ' 昨日\n映画を見ました。 ' };
    new JournalDraftStore('andrew').put(draft);
    expect(new JournalDraftStore('partner').list()).toEqual([]);
    expect(new JournalDraftStore('andrew').get(draft.id)).toEqual(draft);
    expect(() => new JournalDraftStore('').put(draft)).toThrow('Sign in');
  });

  it('removes only the acknowledged edit', () => {
    const sent = newJournalDraft();
    new JournalDraftStore('a').put(sent);
    new JournalDraftStore('a').acknowledge(sent, savedEntry(sent));
    expect(new JournalDraftStore('a').list()).toEqual([]);
  });

  it('preserves newer typing while updating its server version', () => {
    const sent = newJournalDraft();
    const newer = { ...sent, body: 'More writing', editId: 'later' };
    new JournalDraftStore('a').put(newer);
    new JournalDraftStore('a').acknowledge(sent, savedEntry(sent));
    expect(new JournalDraftStore('a').get(sent.id)).toEqual({ ...newer, expectedVersion: 1 });
    new JournalDraftStore('a').discard(sent);
    expect(new JournalDraftStore('a').list()).toHaveLength(1);
  });

  it('does not regress a draft already based on a newer server version', () => {
    const sent = newJournalDraft();
    const newer = { ...sent, expectedVersion: 5, editId: 'later' };
    new JournalDraftStore('a').put(newer);
    new JournalDraftStore('a').acknowledge(sent, savedEntry(sent));
    expect(new JournalDraftStore('a').get(sent.id)).toEqual(newer);
  });

  it('ignores malformed records without deleting them', () => {
    localStorage.setItem('convolab:journal:v1:a:broken', '{bad');
    localStorage.setItem('convolab:journal:v1:a:invalid', JSON.stringify({ body: 'text' }));
    expect(new JournalDraftStore('a').list()).toEqual([]);
    expect(localStorage.length).toBe(2);
  });

  it('does not silently swallow full or unavailable storage', () => {
    const storage = {
      setItem: vi.fn(() => {
        throw new Error('Quota exceeded');
      }),
    } as unknown as Storage;
    expect(() => new JournalDraftStore('a', storage).put(newJournalDraft())).toThrow(
      'Quota exceeded'
    );
  });

  it('lists newest diary dates first with stable IDs as the tie breaker', () => {
    const earlier = { ...newJournalDraft(), entryDate: '2026-11-01' };
    const later = { ...newJournalDraft(), entryDate: '2026-11-12' };
    new JournalDraftStore('a').put(earlier);
    new JournalDraftStore('a').put(later);
    expect(new JournalDraftStore('a').list().map((draft) => draft.id)).toEqual([
      later.id,
      earlier.id,
    ]);
  });
});
