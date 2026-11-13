import { useEffect, useMemo, useRef, useState } from 'react';
import { ulid } from 'ulid';
import { JsonRequestError } from '../../lib/apiClient';
import { getJournalEntry, saveJournalDraft, submitJournalEntry } from './journalApi';
import { draftFromEntry, JournalDraftStore, newJournalDraft } from './journalDrafts';
import type { JournalAnalysis, JournalDraft, JournalEntry } from './types';

interface EditorOptions {
  ownerId: string;
  entryId: string;
  onSaved: (entry: JournalEntry) => void;
  initialEntry?: JournalEntry;
}

function loadEntry(initial: JournalEntry | undefined, id: string, signal: AbortSignal) {
  return initial?.id === id ? Promise.resolve(initial) : getJournalEntry({ id, signal });
}

export default function useJournalEditor({
  ownerId,
  entryId,
  onSaved,
  initialEntry,
}: EditorOptions) {
  const initialRef = useRef(initialEntry);
  const store = useMemo(() => new JournalDraftStore(ownerId), [ownerId]);
  const [draft, setDraft] = useState<JournalDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [locallySaved, setLocallySaved] = useState(false);
  const [submitted, setSubmitted] = useState(0);
  const [submission, setSubmission] = useState<{ data: JournalAnalysis; entry: JournalEntry }>();
  const scope = useRef(0);
  const acceptedVersion = useRef(0);

  useEffect(() => {
    scope.current += 1;
    const epoch = scope.current;
    acceptedVersion.current = 0;
    const controller = new AbortController();
    setDraft(null);
    setError('');
    setConflict(false);
    setLocallySaved(false);
    setBusy(false);
    setSubmission(undefined);
    let local: JournalDraft | null = null;
    try {
      local = store.get(entryId);
      if (local) {
        setDraft(local);
        setLocallySaved(true);
      }
    } catch {
      setError('Device storage is unavailable. Keep this page open to preserve your writing.');
    }
    if (!local) {
      loadEntry(initialRef.current, entryId, controller.signal)
        .then((entry) => {
          if (scope.current !== epoch || entry.version <= acceptedVersion.current) return;
          acceptedVersion.current = entry.version;
          setDraft(draftFromEntry(entry));
        })
        .catch((reason) => {
          if (!controller.signal.aborted)
            setError(reason instanceof Error ? reason.message : 'Could not load this entry.');
        });
    }
    return () => {
      scope.current += 1;
      controller.abort();
    };
  }, [entryId, store]);

  function change(patch: Partial<Pick<JournalDraft, 'title' | 'body' | 'entryDate'>>) {
    if (!draft || busy) return;
    const next = { ...draft, ...patch, editId: ulid().toLowerCase() };
    setDraft(next);
    try {
      store.put(next);
      setLocallySaved(true);
      setError('');
    } catch {
      setLocallySaved(false);
      setError('Could not save on this device. Keep this page open and try Save draft.');
    }
  }

  function reportSaveError(reason: unknown) {
    setConflict(reason instanceof JsonRequestError && reason.status === 409);
    setError(
      reason instanceof Error
        ? reason.message
        : 'Could not save. Your draft is still on this device.'
    );
  }

  async function submitSaved(entry: JournalEntry, epoch: number) {
    try {
      const data = await submitJournalEntry(entry);
      if (scope.current !== epoch) return false;
      setSubmission({ data, entry });
      setSubmitted((value) => value + 1);
      return true;
    } catch {
      if (scope.current === epoch)
        setError('Saved, but feedback could not be requested. Try Submit again.');
    }
    return false;
  }

  function acknowledgeStorage(sent: JournalDraft, entry: JournalEntry) {
    try {
      store.acknowledge(sent, entry);
    } catch {
      return 'Saved online, but device storage could not be updated.';
    }
    return '';
  }

  function acceptSave(entry: JournalEntry) {
    acceptedVersion.current = entry.version;
    setDraft(draftFromEntry(entry));
    setLocallySaved(false);
    setConflict(false);
    onSaved(entry);
  }

  async function save(submit = false) {
    if (!draft || busy) return false;
    const epoch = scope.current;
    const sent = draft;
    setBusy(true);
    setError('');
    try {
      const entry = await saveJournalDraft(sent);
      const storageError = acknowledgeStorage(sent, entry);
      if (scope.current !== epoch) return false;
      acceptSave(entry);
      setError(storageError);
      return submit ? await submitSaved(entry, epoch) : true;
    } catch (reason) {
      if (scope.current !== epoch) return false;
      reportSaveError(reason);
    } finally {
      if (scope.current === epoch) setBusy(false);
    }
    return false;
  }

  function copyAsNew(): JournalDraft | null {
    if (!draft) return null;
    const copy = {
      ...newJournalDraft(),
      title: draft.title,
      body: draft.body,
      entryDate: draft.entryDate,
    };
    try {
      store.put(copy);
      return copy;
    } catch {
      setError('Could not save a new draft on this device.');
      return null;
    }
  }

  function acceptGeneratedEntry(entry: JournalEntry) {
    if (entry.version <= acceptedVersion.current) return;
    acceptedVersion.current = entry.version;
    setDraft((current) => {
      if (current && current.body !== entry.body) return current;
      try {
        if (store.get(entryId)) return current;
      } catch {
        return current;
      }
      return draftFromEntry(entry);
    });
    onSaved(entry);
  }

  return {
    draft,
    busy,
    error,
    conflict,
    locallySaved,
    submitted,
    submission,
    change,
    save,
    copyAsNew,
    acceptGeneratedEntry,
  };
}
