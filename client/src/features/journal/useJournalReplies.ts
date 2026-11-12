import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ulid } from 'ulid';
import {
  getJournalReply,
  sendJournalAnswer,
  undoJournalAnswer,
  type JournalAnswerRequest,
} from './journalReplies';
import type { JournalAnalysis } from './types';

interface ReplyOptions {
  ownerId: string;
  entryId: string;
  analysis: JournalAnalysis;
}
interface AnswerDraft {
  answer: string;
  replace: boolean;
  request?: JournalAnswerRequest;
}

function readDraft(key: string): AnswerDraft {
  const value = JSON.parse(localStorage.getItem(key) ?? 'null') as AnswerDraft | null;
  return value && typeof value.answer === 'string' ? value : { answer: '', replace: false };
}

export default function useJournalReplies({ ownerId, entryId, analysis }: ReplyOptions) {
  const key = `convolab:journal-answer:${ownerId}:${entryId}:${analysis.id}`;
  const [draft, setDraft] = useState<AnswerDraft>(() => {
    try {
      return readDraft(key);
    } catch {
      return { answer: '', replace: false };
    }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const client = useQueryClient();
  const pendingId = draft.request?.id ?? analysis.pendingReplyId;
  const query = useQuery({
    queryKey: ['journal-reply', ownerId, entryId, pendingId],
    queryFn: ({ signal }) => getJournalReply(entryId, pendingId!, signal),
    enabled: Boolean(pendingId) && !busy,
    retry: false,
    refetchInterval: (state) => {
      const status = state.state.data?.data.status;
      return status === 'queued' || status === 'processing' ? 2000 : false;
    },
  });
  const status = query.data?.data.status;
  const processing =
    Boolean(analysis.pendingReplyId) || status === 'queued' || status === 'processing';
  const refresh = () =>
    client.invalidateQueries({ queryKey: ['journal-analysis', ownerId, entryId] });

  function persist(next: AnswerDraft) {
    setDraft(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      setError('Could not save this answer on your device. Keep this page open.');
    }
  }
  useEffect(() => {
    if (status !== 'ready') return;
    // Keep the request until the refreshed analysis confirms it was applied.
    client
      .invalidateQueries({ queryKey: ['journal-analysis', ownerId, entryId] })
      .catch(() => undefined);
  }, [status, client, ownerId, entryId]);
  useEffect(() => {
    if (!draft.request || analysis.currentReply?.id !== draft.request.id) return;
    setDraft({ answer: '', replace: false });
    try {
      localStorage.removeItem(key);
    } catch {
      /* The confirmed request is safe to retry. */
    }
  }, [analysis.currentReply?.id, draft.request, key]);

  async function submit() {
    if (!draft.answer.trim()) return;
    if (busy || processing) return;
    const input = draft.request ?? {
      id: ulid().toLowerCase(),
      analysisId: analysis.id,
      answer: draft.answer,
      expectedRevision: analysis.replyRevision ?? 0,
      replace: draft.replace,
    };
    persist({ ...draft, request: input });
    setBusy(true);
    setError('');
    try {
      const response = await sendJournalAnswer(entryId, input);
      if (!live.current) return;
      client.setQueryData(['journal-reply', ownerId, entryId, input.id], response);
      await refresh();
    } catch {
      if (live.current)
        setError('Could not add this answer. Your writing is kept here; try again.');
    } finally {
      if (live.current) setBusy(false);
    }
  }

  async function undo() {
    if (busy || processing) return;
    setBusy(true);
    setError('');
    try {
      await undoJournalAnswer(entryId, analysis);
      if (live.current) await refresh();
    } catch {
      if (live.current) {
        await refresh();
        setError('Could not confirm undo. The entry has been refreshed.');
      }
    } finally {
      if (live.current) setBusy(false);
    }
  }
  function change(answer: string) {
    persist({ answer, replace: draft.replace });
  }
  function editLast() {
    persist({ answer: analysis.currentReply?.answer ?? '', replace: true });
  }
  function cancelEdit() {
    persist({ answer: '', replace: false });
  }
  return {
    waiting: Boolean(draft.request) && status !== 'failed',
    draft,
    busy,
    processing,
    error:
      error ||
      query.data?.data.error ||
      (query.error ? 'Could not check this answer. Retry when connected.' : ''),
    submit,
    undo,
    change,
    editLast,
    cancelEdit,
  };
}
