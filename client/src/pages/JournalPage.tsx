import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import JournalEntriesDrawer from '../features/journal/JournalEntriesDrawer';
import JournalNavigationSlots from '../features/journal/JournalNavigationSlots';
import JournalPreferences from '../features/journal/JournalPreferences';
import JournalDeskContext from '../features/journal/JournalDeskContext';
import '../features/journal/journalDesk.css';
import {
  journalFonts,
  readTypography,
  saveTypography,
} from '../features/journal/journalTypography';
import '../features/journal/journalPaper.css';
import JournalAppearance from '../features/journal/JournalAppearance';
import { useAuth } from '../contexts/AuthContext';
import { KnownKanjiProvider } from '../contexts/KnownKanjiContext';
import useJournalActivity from '../features/journal/useJournalActivity';
import JournalArchive from '../features/journal/JournalArchive';
import JournalEntryContent from '../features/journal/JournalEntryContent';
import JournalLanding from '../features/journal/JournalLanding';
import useJournalArchive from '../features/journal/useJournalArchive';
import JournalSyncProvider from '../features/journal/JournalSyncProvider';

function useBlankNotebook() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = useRef<string>();
  const requested = from.current !== undefined && location.state?.blankFrom === from.current;
  useEffect(() => {
    // A fresh navigation consumes the request. Reloads and history visits resume normally.
    from.current = undefined;
  }, [location.key]);
  const open = () => {
    from.current = location.key;
    navigate('/app/journal', { state: { blankFrom: location.key } });
  };
  return { requested, open };
}

const JournalWorkspace = ({ ownerId }: { ownerId: string }) => {
  const { entryId } = useParams();
  useJournalActivity(ownerId);
  const [typography, setTypography] = useState(readTypography);
  const [appearanceSaved, setAppearanceSaved] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const blankNotebook = useBlankNotebook();
  const archive = useJournalArchive(ownerId);
  const [editorRevision, setEditorRevision] = useState(0);
  const [editorBusy, setEditorBusy] = useState(false);
  const [blankDraftId, setBlankDraftId] = useState<string>();
  const activeId = entryId ?? blankDraftId;
  const { refresh } = archive;
  useEffect(() => {
    refresh();
  }, [refresh, entryId]);
  const [editingCount, setEditingCount] = useState(0);
  const editingChanged = useCallback(
    (delta: number) => setEditingCount((value) => Math.max(0, value + delta)),
    []
  );
  const close = () => {
    archive.refresh();
    blankNotebook.open();
  };
  const open = (id: string) => navigate(`/app/journal/${id}`);

  const appearance = useMemo(
    () => (
      <JournalAppearance
        value={typography}
        saved={appearanceSaved}
        menu
        onChange={(value) => {
          setTypography(value);
          setAppearanceSaved(saveTypography(value));
        }}
      />
    ),
    [typography, appearanceSaved]
  );
  const deskValue = useMemo(
    () => ({ target: null, editingChanged, textSize: typography.size }),
    [editingChanged, typography.size]
  );
  const contents = (
    <JournalEntriesDrawer
      entryId={entryId ?? location.key}
      onOpen={archive.refresh}
      disabled={editingCount > 0}
    >
      <JournalArchive
        archive={archive}
        selectedId={activeId}
        onCreate={close}
        busyId={editorBusy ? activeId : undefined}
        onDeleted={(id) => {
          if (id === activeId) close();
        }}
        onRenamed={(id) => {
          if (id !== activeId) return;
          if (entryId) setEditorRevision((value) => value + 1);
          else open(id);
        }}
      />
    </JournalEntriesDrawer>
  );
  return (
    <JournalDeskContext.Provider value={deskValue}>
      <div className="journal-desk">
        <JournalNavigationSlots
          contents={contents}
          settings={<JournalPreferences ownerId={ownerId} appearance={appearance} />}
        />
        <section
          aria-label="Journal entry"
          style={
            {
              '--journal-font': journalFonts[typography.font],
              '--journal-size': `${typography.size}px`,
              '--journal-weight': typography.font === 'klee' ? 600 : 400,
            } as CSSProperties
          }
          className="min-w-0"
        >
          {entryId ? (
            <JournalEntryContent
              key={`${ownerId}:${entryId}:${editorRevision}`}
              ownerId={ownerId}
              entryId={entryId}
              onBusyChange={setEditorBusy}
              onSaved={archive.saved}
              onOpen={open}
              onClose={close}
            />
          ) : (
            <JournalLanding
              key={location.key}
              ownerId={ownerId}
              archive={archive}
              blank={blankNotebook.requested}
              onActiveDraft={setBlankDraftId}
              onSelectToday={(id) => navigate(`/app/journal/${id}`, { replace: true })}
              onBusyChange={setEditorBusy}
              onSaved={archive.saved}
              onOpen={open}
              onClose={close}
            />
          )}
        </section>
      </div>
    </JournalDeskContext.Provider>
  );
};

const JournalPage = () => {
  const { user } = useAuth();
  const [search] = useSearchParams();
  if (search.has('viewAs')) return <p>Journal entries are private to your own account.</p>;
  if (!user) return null;
  return (
    <KnownKanjiProvider>
      <JournalSyncProvider key={user.id} ownerId={String(user.id)}>
        <JournalWorkspace ownerId={String(user.id)} />
      </JournalSyncProvider>
    </KnownKanjiProvider>
  );
};

export default JournalPage;
