import { useEffect, useRef, useState } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { JsonRequestError } from '../../lib/apiClient';
import { deleteJournalEntry } from './journalApi';
import { removeJournalDeviceData } from './journalDeviceCleanup';
import type useJournalEditor from './useJournalEditor';

type Editor = ReturnType<typeof useJournalEditor>;

async function deleteDraft(ownerId: string, draft: NonNullable<Editor['draft']>) {
  if (draft.expectedVersion > 0) {
    try {
      await deleteJournalEntry({ id: draft.id, version: draft.expectedVersion });
    } catch (error) {
      // A retry may follow a successful server deletion but failed device cleanup.
      if (!(error instanceof JsonRequestError && error.status === 404)) throw error;
    }
  }
  removeJournalDeviceData(ownerId, draft.id);
}

async function closeDraft(
  ownerId: string,
  editor: Editor,
  kind: 'keep' | 'delete',
  client: QueryClient
) {
  if (kind === 'keep') return editor.save();
  if (!editor.draft) return false;
  await deleteDraft(ownerId, editor.draft);
  client.invalidateQueries({ queryKey: ['journal-archive', ownerId] }).catch(() => undefined);
  client.invalidateQueries({ queryKey: ['journal-conversation', ownerId] }).catch(() => undefined);
  return true;
}

function closeError(reason: unknown) {
  return reason instanceof Error ? reason.message : 'Could not close this draft. Please try again.';
}

export default function useJournalDraftClose(ownerId: string, editor: Editor, onClose: () => void) {
  const client = useQueryClient();
  const active = useRef(true);
  const pending = useRef(false);
  const [action, setAction] = useState<'keep' | 'delete' | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  async function finish(kind: 'keep' | 'delete') {
    if (pending.current) return;
    pending.current = true;
    setAction(kind);
    setError('');
    try {
      const success = await closeDraft(ownerId, editor, kind, client);
      if (!success)
        throw new Error('Could not save online. Your draft is still open. Please try again.');
      if (active.current) onClose();
    } catch (reason) {
      if (active.current) setError(closeError(reason));
    } finally {
      pending.current = false;
      if (active.current) setAction(null);
    }
  }

  return { action, error, pending, finish };
}
