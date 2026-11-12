import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { JsonRequestError, requestJson } from '../../lib/apiClient';
import type { JournalAnalysis } from './types';

type Change = { suggestionId: string; applied: boolean } | { text: string };
interface Options {
  ownerId: string;
  entryId: string;
  analysis: JournalAnalysis;
}
export default function useJournalDocument({ ownerId, entryId, analysis }: Options) {
  const client = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const refresh = () =>
    client.invalidateQueries({ queryKey: ['journal-analysis', ownerId, entryId] });
  async function change(input: Change, revision = analysis.replyRevision ?? 0) {
    if (pending.current || analysis.pendingReplyId) return false;
    pending.current = true;
    setSaving(true);
    setError('');
    try {
      await requestJson<{ data: JournalAnalysis }>(
        `/api/journal/entries/${encodeURIComponent(entryId)}/${'text' in input ? 'corrected' : 'suggestion'}`,
        {
          method: 'PUT',
          body: JSON.stringify({ analysisId: analysis.id, expectedRevision: revision, ...input }),
        }
      );
      await refresh();
      return true;
    } catch (failure) {
      await refresh().catch(() => undefined);
      let message = 'Could not save this change. Your writing is still here; please try again.';
      if (failure instanceof JsonRequestError && failure.status === 409) {
        message =
          'The entry changed and has been refreshed. Your edits are still here; copy them before closing the editor, then reopen it to review the latest version.';
      }
      setError(message);
      return false;
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }
  return {
    busy: saving || Boolean(analysis.pendingReplyId),
    error,
    reset: () => setError(''),
    change,
  };
}
export type JournalDocumentControls = ReturnType<typeof useJournalDocument>;
