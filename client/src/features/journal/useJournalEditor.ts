import { useEffect, useMemo, useRef, useState } from 'react';
import { ulid } from 'ulid';
import useJournalSyncReceipt, { journalSyncStatus } from './useJournalSyncReceipt';
import { useJournalSync } from './JournalSyncContext';
import isUnwrittenJournalDraft from './journalDraftPersistence';
import useJournalClarification from './useJournalClarification';
import { rememberJournalVersion } from './useJournalVersion';
import { JsonRequestError } from '../../lib/apiClient';
import { getJournalEntry, saveJournalDraft, submitJournalEntry } from './journalApi';
import { draftFromEntry, JournalDraftStore, newJournalDraft } from './journalDrafts';
import type { JournalAnalysis, JournalDraft, JournalEntry } from './types';

interface EditorOptions {
  ownerId: string;
  entryId: string;
  onSaved: (entry: JournalEntry) => void;
  initialEntry?: JournalEntry;
  initialDraft?: JournalDraft;
}

function loadEntry(initial: JournalEntry | undefined, id: string, signal: AbortSignal) {
  return initial?.id === id ? Promise.resolve(initial) : getJournalEntry({ id, signal });
}

export default function useJournalEditor({
  ownerId,
  entryId,
  onSaved,
  initialEntry,
  initialDraft,
}: EditorOptions) {
  const { outbox, revision } = useJournalSync();
  const clarification = useJournalClarification(`${ownerId}:${entryId}`);
  const initialRef = useRef(initialEntry);
  const blankRef = useRef(initialDraft);
  const store = useMemo(() => new JournalDraftStore(ownerId), [ownerId]);
  const [draft, setDraft] = useState<JournalDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [requestingFeedback, setRequestingFeedback] = useState(false);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [locallySaved, setLocallySaved] = useState(false);
  const [submitted, setSubmitted] = useState(0);
  const [submission, setSubmission] = useState<{ data: JournalAnalysis; entry: JournalEntry }>();
  const scope = useRef(0);
  const acceptedVersion = useRef(0);
  const editedLocally = useRef(false);
  const unavailable = useRef(false);

  function reportLoadError(reason: unknown) {
    if (reason instanceof JsonRequestError && reason.status === 404) {
      unavailable.current = true;
      if (!editedLocally.current) setDraft(null);
      setNotFound(true);
      return;
    }
    setError('Could not load this entry. Please try again.');
  }

  useEffect(() => {
    scope.current += 1;
    const epoch = scope.current;
    acceptedVersion.current = 0;
    editedLocally.current = false;
    unavailable.current = false;
    const controller = new AbortController();
    setDraft(null);
    setError('');
    setNotFound(false);
    setConflict(false);
    setLocallySaved(false);
    setBusy(false);
    setSubmission(undefined);
    setRequestingFeedback(false);
    let local: JournalDraft | null = null;
    try {
      local = store.get(entryId);
      if (local) {
        editedLocally.current = true;
        setDraft(local);
        setLocallySaved(true);
      }
    } catch {
      setError('Device storage is unavailable. Keep this page open to preserve your writing.');
    }
    if (!local && blankRef.current?.id === entryId) {
      setDraft(blankRef.current);
    } else if (!local) {
      loadEntry(initialRef.current, entryId, controller.signal)
        .then((entry) => {
          if (scope.current !== epoch || editedLocally.current) return;
          if (entry.version <= acceptedVersion.current) return;
          acceptedVersion.current = entry.version;
          setDraft(draftFromEntry(entry));
        })
        .catch((reason) => {
          if (controller.signal.aborted) return;
          reportLoadError(reason);
        });
    }
    return () => {
      scope.current += 1;
      controller.abort();
    };
  }, [entryId, store]);

  function change(patch: Partial<Pick<JournalDraft, 'title' | 'body' | 'entryDate'>>) {
    if (!draft || busy) return;
    const entryDate = isUnwrittenJournalDraft(draft, locallySaved)
      ? newJournalDraft().entryDate
      : draft.entryDate;
    const acknowledged = outbox?.receipts.get(entryId)?.entry.version ?? 0;
    const next = {
      ...draft,
      entryDate,
      ...patch,
      expectedVersion: Math.max(draft.expectedVersion, acknowledged),
      editId: ulid().toLowerCase(),
    };
    editedLocally.current = true;
    setDraft(next);
    if (isUnwrittenJournalDraft(next, locallySaved)) return;
    try {
      store.put(next);
      outbox?.edited(next);
      setLocallySaved(true);
      setError('');
    } catch {
      setLocallySaved(false);
      setError(
        'Could not save on this device. Keep this page open and try again after freeing storage.'
      );
    }
  }

  function reportSaveError(reason: unknown) {
    const deleted = reason instanceof JsonRequestError && reason.status === 404;
    const recoverable = reason instanceof JsonRequestError && [404, 409].includes(reason.status);
    setConflict(recoverable || outbox?.blocked.get(entryId) === 503);
    if (deleted) {
      setError('This entry is unavailable online. Your writing is still here.');
      return;
    }
    setError(
      reason instanceof Error
        ? reason.message
        : 'Could not save. Your draft is still on this device.'
    );
  }

  async function submitSaved(entry: JournalEntry, epoch: number) {
    setRequestingFeedback(true);
    try {
      const clarificationId = await clarification.begin(entry);
      if (!clarificationId || scope.current !== epoch) return false;
      const data = await submitJournalEntry(entry, clarificationId);
      if (scope.current !== epoch) return false;
      rememberJournalVersion(ownerId, entryId, 'draft');
      setSubmission({ data, entry });
      setSubmitted((value) => value + 1);
      return true;
    } catch {
      if (scope.current === epoch)
        setError('Saved, but feedback could not be requested. Try Submit again.');
    } finally {
      if (scope.current === epoch) setRequestingFeedback(false);
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
    setError('');
    acceptedVersion.current = entry.version;
    editedLocally.current = false;
    unavailable.current = false;
    setNotFound(false);
    setDraft(draftFromEntry(entry));
    setLocallySaved(false);
    setConflict(false);
    onSaved(entry);
  }

  function saveRemote(sent: JournalDraft) {
    return outbox ? outbox.saveLatest(sent) : saveJournalDraft(sent);
  }

  function canCloseWithoutSaving(submit: boolean) {
    return !submit && !editedLocally.current && (draft?.expectedVersion ?? 0) > 0;
  }

  function preserveUnsavedWriting(sent: JournalDraft) {
    if (!editedLocally.current || locallySaved) return;
    store.put(sent);
    outbox?.edited(sent);
    setLocallySaved(true);
  }

  async function persistDraft(sent: JournalDraft, submit: boolean) {
    const epoch = scope.current;
    setBusy(true);
    setError('');
    try {
      preserveUnsavedWriting(sent);
      const entry = await saveRemote(sent);
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

  async function save(submit = false) {
    if (!draft || busy) return false;
    if (canCloseWithoutSaving(submit)) return true;
    return persistDraft(draft, submit);
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
    if (unavailable.current || editedLocally.current) return;
    if (entry.version <= acceptedVersion.current) return;
    try {
      if (store.get(entryId)) return;
    } catch {
      return;
    }
    acceptedVersion.current = entry.version;
    setDraft(draftFromEntry(entry));
    onSaved(entry);
  }

  useJournalSyncReceipt({
    outbox,
    revision,
    entryId,
    store,
    draft,
    accept: (entry) => {
      acceptSave(entry);
      setError('');
    },
    rebase: setDraft,
    reject: reportSaveError,
  });

  return {
    clarification,
    requestingFeedback,
    draft,
    busy,
    error,
    notFound,
    conflict,
    locallySaved,
    canLoadFeedback: Boolean(draft?.expectedVersion) && !editedLocally.current && !conflict,
    syncStatus: journalSyncStatus(
      locallySaved,
      Boolean(outbox?.isSyncing(entryId)),
      editedLocally.current
    ),
    pristine: isUnwrittenJournalDraft(draft, locallySaved),
    submitted,
    submission,
    change,
    save,
    copyAsNew,
    acceptGeneratedEntry,
  };
}
