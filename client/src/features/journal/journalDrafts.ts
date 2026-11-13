import { ulid } from 'ulid';
import { z } from 'zod';
import type { JournalDraft, JournalEntry } from './types';

const draftSchema = z.object({
  id: z.string().regex(/^[0-9a-hjkmnp-tv-z]{26}$/),
  title: z.string().nullable(),
  rootEntryId: z.string().nullable().optional(),
  body: z.string(),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expectedVersion: z.number().int().nonnegative(),
  editId: z.string().min(1),
});

function readDraft(storage: Storage, storageKey: string): JournalDraft | null {
  const raw = storage.getItem(storageKey);
  if (raw === null) return null;
  try {
    const result = draftSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export class JournalDraftStore {
  private readonly prefix: string;

  constructor(
    ownerId: string,
    private readonly storage?: Storage
  ) {
    if (!ownerId) throw new Error('Sign in to save a journal draft.');
    this.prefix = `convolab:journal:v1:${encodeURIComponent(ownerId)}:`;
  }

  list(): JournalDraft[] {
    const drafts: JournalDraft[] = [];
    for (let index = 0; index < this.deviceStorage.length; index += 1) {
      const storageKey = this.deviceStorage.key(index);
      if (storageKey?.startsWith(this.prefix)) {
        const draft = readDraft(this.deviceStorage, storageKey);
        if (draft && storageKey === this.key(draft.id)) drafts.push(draft);
      }
    }
    return drafts.sort(
      (a, b) => b.entryDate.localeCompare(a.entryDate) || b.id.localeCompare(a.id)
    );
  }

  get(id: JournalDraft['id']): JournalDraft | null {
    const draft = readDraft(this.deviceStorage, this.key(id));
    return draft?.id === id ? draft : null;
  }

  put(draft: JournalDraft): void {
    const validated = draftSchema.parse(draft);
    // Let storage failures reach the editor instead of claiming the draft is safe.
    this.deviceStorage.setItem(this.key(draft.id), JSON.stringify(validated));
  }

  discard(draft: JournalDraft): void {
    if (this.get(draft.id)?.editId === draft.editId)
      this.deviceStorage.removeItem(this.key(draft.id));
  }

  acknowledge(sent: JournalDraft, saved: JournalEntry): void {
    const current = this.get(sent.id);
    if (!current || saved.id !== sent.id) return;
    if (current.editId === sent.editId) {
      this.discard(sent);
    } else if (current.expectedVersion === sent.expectedVersion) {
      this.put({ ...current, expectedVersion: saved.version });
    }
  }

  private get deviceStorage(): Storage {
    return this.storage ?? localStorage;
  }

  private key(id: JournalDraft['id']): string {
    return `${this.prefix}${id}`;
  }
}

export function draftFromEntry(entry: JournalEntry): JournalDraft {
  return {
    id: entry.id,
    rootEntryId: entry.rootEntryId,
    title: entry.title,
    body: entry.body,
    entryDate: entry.entryDate,
    expectedVersion: entry.version,
    editId: ulid().toLowerCase(),
  };
}

export function newJournalDraft(date = new Date()): JournalDraft {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return {
    id: ulid().toLowerCase(),
    title: null,
    body: '',
    entryDate: localDate.toISOString().slice(0, 10),
    expectedVersion: 0,
    editId: ulid().toLowerCase(),
  };
}
