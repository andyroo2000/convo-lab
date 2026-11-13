import { useEffect, useRef, useState } from 'react';
import { ulid } from 'ulid';
import { z } from 'zod';
import { JsonRequestError } from '../../lib/apiClient';
import { createConversationAnswer } from './journalConversationApi';
import { submitJournalEntry } from './journalApi';

const draftSchema = z.object({
  body: z.string(),
  request: z.object({ id: z.string(), questionId: z.string(), body: z.string() }).optional(),
});
type Draft = z.infer<typeof draftSchema>;
function restore(key: string): Draft {
  try {
    return draftSchema.parse(JSON.parse(localStorage.getItem(key) ?? '{}'));
  } catch {
    return { body: '' };
  }
}
function permanentRejection(reason: unknown) {
  if (!(reason instanceof JsonRequestError)) return false;
  if ([408, 429].includes(reason.status)) return false;
  return reason.status >= 400 && reason.status < 500;
}
export default function useConversationAnswer(
  key: string,
  entryId: string,
  questionId: string,
  onSaved: () => Promise<unknown>
) {
  const [draft, setDraft] = useState(() => restore(key));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  function persist(next: Draft) {
    setDraft(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      setError('Device storage is unavailable. Keep this page open to preserve your answer.');
    }
  }
  function reportFailure(reason: unknown) {
    if (permanentRejection(reason)) persist({ body: draft.body });
    if (live.current)
      setError(
        reason instanceof Error
          ? reason.message
          : 'Could not send your answer. Retry to send the same answer safely.'
      );
  }
  async function submit() {
    if (busy || !draft.body.trim()) return;
    const request = draft.request ?? { id: ulid().toLowerCase(), questionId, body: draft.body };
    persist({ ...draft, request });
    setBusy(true);
    setError('');
    try {
      const { data: entry } = await createConversationAnswer(entryId, request);
      try {
        await submitJournalEntry(entry);
      } catch {
        /* The saved answer remains editable and can be submitted again. */
      }
      try {
        if (live.current) await onSaved();
      } catch {
        if (live.current) setError('Your answer is saved. Reload the conversation to see it.');
        return;
      }
      localStorage.removeItem(key);
    } catch (reason) {
      reportFailure(reason);
    } finally {
      if (live.current) setBusy(false);
    }
  }
  return { draft, busy, error, change: (body: string) => persist({ body }), submit };
}
