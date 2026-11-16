import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
import JournalEditor from '../features/journal/JournalEditor';
import JournalConversation from '../features/journal/JournalConversation';
import useJournalArchive from '../features/journal/useJournalArchive';

const JournalWorkspace = ({ ownerId }: { ownerId: string }) => {
  const { entryId } = useParams();
  useJournalActivity(ownerId);
  const [typography, setTypography] = useState(readTypography);
  const [appearanceSaved, setAppearanceSaved] = useState(true);
  const navigate = useNavigate();
  const archive = useJournalArchive(ownerId);
  const [editorRevision, setEditorRevision] = useState(0);
  const [editorBusy, setEditorBusy] = useState(false);
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
  const close = () => navigate('/app/journal');
  const open = (id: string) => navigate(`/app/journal/${id}`);
  const create = () => {
    const id = archive.create();
    if (id) open(id);
  };

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
          <JournalEntriesDrawer entryId={entryId} disabled={editingCount > 0}>
            <JournalArchive
              archive={archive}
              selectedId={entryId}
              onCreate={create}
              busyId={editorBusy ? entryId : undefined}
              onDeleted={(id) => {
                if (id === entryId) navigate('/app/journal');
              }}
              onRenamed={(id) => {
                if (id === entryId) setEditorRevision((value) => value + 1);
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
            <JournalEditor
              key={`${ownerId}:${entryId}:${editorRevision}`}
              ownerId={ownerId}
              entryId={entryId}
              onBusyChange={setEditorBusy}
              onSaved={archive.saved}
              onOpen={open}
              onClose={close}
              renderFeedback={(analysis, heading) => (
                <JournalConversation
                  key={analysis.id}
                  ownerId={ownerId}
                  entryId={entryId}
                  analysis={analysis}
                  heading={heading}
                  onOpen={open}
                  onClose={close}
                />
              )}
            />
          ) : (
            <p className="p-12 text-gray-500">Select an entry or start a new one.</p>
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
