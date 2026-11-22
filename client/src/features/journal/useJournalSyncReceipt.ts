import { useEffect, useRef } from 'react';
import { JsonRequestError } from '../../lib/apiClient';
import type JournalDraftOutbox from './journalDraftOutbox';
import type { JournalDraftStore } from './journalDrafts';
import type { JournalDraft, JournalEntry } from './types';

interface ReceiptOptions {
  outbox: JournalDraftOutbox | null;
  revision: number;
  entryId: string;
  store: JournalDraftStore;
  draft: JournalDraft | null;
  accept: (entry: JournalEntry) => void;
  rebase: (draft: JournalDraft) => void;
  reject: (error: unknown) => void;
}

function rebaseStoredDraft(store: JournalDraftStore, draft: JournalDraft, rebase: ReceiptOptions['rebase']) {
  const local = store.get(draft.id);
  if (local?.editId === draft.editId && local.expectedVersion !== draft.expectedVersion)
    rebase(local);
}

function reconcile({ outbox, entryId, draft, store, accept, rebase, reject }: ReceiptOptions) {
  const rejected = outbox?.blocked.get(entryId);
  if (rejected) {
    reject(new JsonRequestError('This draft needs attention before it can sync.', rejected, {}));
    return;
  }
  const receipt = outbox?.receipts.get(entryId);
  if (!receipt || !draft) return;
  if (draft.editId === receipt.sent.editId) {
    accept(receipt.entry);
    return;
  }
  rebaseStoredDraft(store, draft, rebase);
}

export default function useJournalSyncReceipt(options: ReceiptOptions) {
  const latest = useRef(options);
  latest.current = options;
  const { outbox, revision, entryId } = options;
  const editId = options.draft?.editId;
  useEffect(() => {
    reconcile(latest.current);
  }, [revision, outbox, entryId, editId]);
}

export function journalSyncStatus(
  draft: JournalDraft | null,
  saved: boolean,
  syncing: boolean,
  dirty: boolean
) {
  if (syncing) return 'Syncing…';
  if (saved) return 'Saved on this device';
  if (dirty) return 'Not saved on this device';
  return draft?.expectedVersion ? 'Synced' : null;
}
