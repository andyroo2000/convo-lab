import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useStudyActivityActions, useStudyActivityStatus } from '../contexts/StudyActivityContext';
import {
  useDeleteStudyActivitySession,
  useEditableStudyActivitySessions,
  useSaveStudyActivitySession,
} from './useStudyActivity';
import type {
  StudyActivityCategory,
  StudyActivityKind,
  StudyActivitySession,
} from '../types/studyActivity';

export const STUDY_ACTIVITY_OPTIONS: Array<{
  activity: StudyActivityKind;
  category: StudyActivityCategory;
  labelKey: string;
}> = [
  { activity: 'card_creation', category: 'create', labelKey: 'time.activities.cardCreation' },
  { activity: 'tv', category: 'immerse', labelKey: 'time.activities.tv' },
  { activity: 'podcast', category: 'immerse', labelKey: 'time.activities.podcast' },
  { activity: 'reading', category: 'immerse', labelKey: 'time.activities.reading' },
  {
    activity: 'conversation',
    category: 'conversation',
    labelKey: 'time.activities.conversation',
  },
  {
    activity: 'wanikani_review',
    category: 'wanikani',
    labelKey: 'time.activities.wanikaniReview',
  },
  { activity: 'other', category: 'immerse', labelKey: 'time.activities.other' },
];

export function localStudyTimeInputValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function studyActivityTranslationKey(activity: StudyActivityKind) {
  if (activity === 'card_review') return 'cardReview';
  if (activity === 'daily_audio') return 'dailyAudio';
  if (activity === 'card_creation') return 'cardCreation';
  if (activity === 'wanikani_review') return 'wanikaniReview';
  return activity;
}

export function useStudyTimeSessionManager() {
  const { t } = useTranslation(['study']);
  const sessionsQuery = useEditableStudyActivitySessions();
  const saveSession = useSaveStudyActivitySession();
  const deleteSession = useDeleteStudyActivitySession();
  const { active } = useStudyActivityStatus();
  const { start, stopAndWait, logCompletedAndWait } = useStudyActivityActions();

  const [activity, setActivity] = useState<StudyActivityKind>('card_creation');
  const [name, setName] = useState('');
  const [entryDate, setEntryDate] = useState(() => localStudyTimeInputValue(new Date()));
  const [minutes, setMinutes] = useState(30);
  const [editing, setEditing] = useState<StudyActivitySession | null>(null);
  const [editActivity, setEditActivity] = useState<StudyActivityKind>('tv');
  const [editName, setEditName] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editMinutes, setEditMinutes] = useState(30);
  const [deletingSession, setDeletingSession] = useState<StudyActivitySession | null>(null);

  const selectedOption =
    STUDY_ACTIVITY_OPTIONS.find((item) => item.activity === activity) ?? STUDY_ACTIVITY_OPTIONS[0];
  const validEntry =
    Number.isFinite(minutes) &&
    minutes >= 1 &&
    minutes <= 1440 &&
    Number.isFinite(new Date(entryDate).getTime());
  const validEdit =
    Number.isFinite(editMinutes) &&
    editMinutes >= 1 &&
    editMinutes <= 1440 &&
    Number.isFinite(new Date(editDate).getTime());
  const manualSessions = useMemo(
    () =>
      [...(sessionsQuery.data?.pages.flatMap((page) => page.items) ?? [])]
        .filter((session) => session.editable)
        .sort((left, right) => right.startedAt.localeCompare(left.startedAt)),
    [sessionsQuery.data]
  );

  const startTimer = () => {
    start({
      category: selectedOption.category,
      activity,
      source: 'manual',
      name: name.trim() || t(selectedOption.labelKey),
    });
  };

  const stopTimer = async () => {
    await stopAndWait();
  };

  const addEntry = async () => {
    if (!validEntry) return;
    const startedAt = new Date(entryDate);
    const endedAt = new Date(startedAt.getTime() + minutes * 60_000);
    await logCompletedAndWait({
      clientSessionId: crypto.randomUUID(),
      category: selectedOption.category,
      activity,
      source: 'calendar',
      name: name.trim() || t(selectedOption.labelKey),
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationMs: minutes * 60_000,
    });
  };

  const beginEditing = (session: StudyActivitySession) => {
    if (!session.editable) return;
    saveSession.reset();
    setEditing(session);
    setEditActivity(session.activity);
    setEditName(session.name ?? '');
    setEditDate(localStudyTimeInputValue(new Date(session.startedAt)));
    setEditMinutes(Math.max(1, Math.round(session.durationMs / 60_000)));
  };

  const cancelEditing = () => {
    saveSession.reset();
    setEditing(null);
  };

  const commitEdit = () => {
    if (!editing?.editable || !validEdit) return;
    const selected =
      STUDY_ACTIVITY_OPTIONS.find((item) => item.activity === editActivity) ??
      STUDY_ACTIVITY_OPTIONS[0];
    const startedAt = new Date(editDate);
    const endedAt = new Date(startedAt.getTime() + editMinutes * 60_000);
    saveSession.mutate(
      {
        ...editing,
        activity: editActivity,
        category: selected.category,
        name: editName.trim() || t(selected.labelKey),
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMs: editMinutes * 60_000,
        audioPlaybackMs: editActivity === 'daily_audio' ? editMinutes * 60_000 : null,
        cardsCreated: editActivity === 'card_creation' ? editing.cardsCreated : null,
      },
      {
        onSuccess: () => {
          setEditing(null);
        },
      }
    );
  };

  const beginDeleting = (session: StudyActivitySession) => {
    if (!session.editable) return;
    deleteSession.reset();
    setDeletingSession(session);
  };

  const cancelDeleting = () => {
    deleteSession.reset();
    setDeletingSession(null);
  };

  const confirmDeleting = () => {
    if (!deletingSession?.editable) return;
    deleteSession.mutate(deletingSession.clientSessionId, {
      onSuccess: () => setDeletingSession(null),
    });
  };

  return {
    timer: {
      active,
      activity,
      setActivity,
      name,
      setName,
      start: startTimer,
      stop: stopTimer,
    },
    calendar: {
      name,
      selectedOption,
      entryDate,
      setEntryDate,
      minutes,
      setMinutes,
      isValid: validEntry,
      addEntry,
    },
    history: {
      sessions: manualSessions,
      isLoading: sessionsQuery.isLoading,
      isError: sessionsQuery.isError,
      hasNextPage: sessionsQuery.hasNextPage,
      isFetchingNextPage: sessionsQuery.isFetchingNextPage,
      loadMore: () => sessionsQuery.fetchNextPage(),
      beginEditing,
      beginDeleting,
    },
    edit: {
      session: editing,
      activity: editActivity,
      setActivity: setEditActivity,
      name: editName,
      setName: setEditName,
      date: editDate,
      setDate: setEditDate,
      minutes: editMinutes,
      setMinutes: setEditMinutes,
      isValid: validEdit,
      isPending: saveSession.isPending,
      isError: saveSession.isError,
      cancel: cancelEditing,
      save: commitEdit,
    },
    deletion: {
      session: deletingSession,
      isPending: deleteSession.isPending,
      isError: deleteSession.isError,
      cancel: cancelDeleting,
      confirm: confirmDeleting,
    },
  };
}

export type StudyTimeSessionManager = ReturnType<typeof useStudyTimeSessionManager>;
