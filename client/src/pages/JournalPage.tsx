import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  useLocation,
  useNavigate,
  useNavigationType,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import JournalEntriesDrawer from '../features/journal/JournalEntriesDrawer';
import JournalOverflow from '../features/journal/JournalOverflow';
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

const JournalWorkspace = ({ ownerId }: { ownerId: string }) => {
  const { entryId } = useParams();
  useJournalActivity(ownerId);
  const [typography, setTypography] = useState(readTypography);
  const [appearanceSaved, setAppearanceSaved] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
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
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const close = () => {
    archive.refresh();
    navigate('/app/journal', { state: { blank: true } });
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
    () => ({ target, appearance, editingChanged }),
    [target, appearance, editingChanged]
  );
  return (
    <JournalDeskContext.Provider value={deskValue}>
      <div className="journal-desk">
        <header className="journal-desk-toolbar">
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
          <div ref={setTarget} className="journal-desk-slot" />
          <div className="journal-desk-fallback">
            <JournalOverflow>{appearance}</JournalOverflow>
          </div>
        </header>
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
              blank={navigationType === 'PUSH' && location.state?.blank === true}
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
      <JournalWorkspace key={user.id} ownerId={String(user.id)} />
    </KnownKanjiProvider>
  );
};

export default JournalPage;
