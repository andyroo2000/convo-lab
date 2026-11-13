import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import {
  journalFonts,
  readTypography,
  saveTypography,
} from '../features/journal/journalTypography';
import JournalAppearance from '../features/journal/JournalAppearance';
import { useAuth } from '../contexts/AuthContext';
import { KnownKanjiProvider } from '../contexts/KnownKanjiContext';
import JournalArchive from '../features/journal/JournalArchive';
import JournalEditor from '../features/journal/JournalEditor';
import JournalConversation from '../features/journal/JournalConversation';
import useJournalArchive from '../features/journal/useJournalArchive';

function useJournalListScroll(entryId?: string) {
  const listScroll = useRef(0);
  const wasReading = useRef(Boolean(entryId));
  useLayoutEffect(() => {
    if (window.matchMedia('(min-width: 768px)').matches) return;
    if (entryId && !wasReading.current) {
      listScroll.current = window.scrollY;
      window.scrollTo(0, 0);
    }
    if (!entryId && wasReading.current) window.scrollTo(0, listScroll.current);
    wasReading.current = Boolean(entryId);
  }, [entryId]);
}

const JournalWorkspace = ({ ownerId }: { ownerId: string }) => {
  const { entryId } = useParams();
  const [typography, setTypography] = useState(readTypography);
  const [appearanceSaved, setAppearanceSaved] = useState(true);
  const navigate = useNavigate();
  const archive = useJournalArchive(ownerId);
  const { refresh } = archive;
  useEffect(() => {
    refresh();
  }, [refresh, entryId]);
  useJournalListScroll(entryId);
  const open = (id: string) => navigate(`/app/journal/${id}`);
  const create = () => {
    const id = archive.create();
    if (id) open(id);
  };

  return (
    <div className="mx-auto max-w-7xl overflow-hidden rounded-2xl border border-gray-200 bg-white md:grid md:grid-cols-[20rem_minmax(0,1fr)]">
      <aside
        className={`${entryId ? 'hidden md:block' : ''} border-r border-gray-100 bg-gray-50/60 md:max-h-[calc(100dvh-8rem)] md:overflow-y-auto`}
        aria-label="Journal entries"
      >
        <JournalArchive
          archive={archive}
          selectedId={entryId}
          onCreate={create}
          onDeleted={(id) => {
            if (entryId === id) navigate('/app/journal');
          }}
        />
      </aside>
      <section
        aria-label="Journal entry"
        style={
          {
            '--journal-font': journalFonts[typography.font],
            '--journal-size': `${typography.size}px`,
          } as CSSProperties
        }
        className={entryId ? 'min-w-0' : 'hidden md:flex md:items-center md:justify-center'}
      >
        {entryId ? (
          <>
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
              <Link
                to="/app/journal"
                className="m-4 inline-flex items-center gap-1 text-sm text-indigo md:hidden"
              >
                <ChevronLeft size={18} aria-hidden="true" />
                Journal
              </Link>
              <div className="ml-auto">
                <JournalAppearance
                  value={typography}
                  saved={appearanceSaved}
                  onChange={(value) => {
                    setTypography(value);
                    setAppearanceSaved(saveTypography(value));
                  }}
                />
              </div>
            </div>
            <JournalEditor
              key={`${ownerId}:${entryId}`}
              ownerId={ownerId}
              entryId={entryId}
              onSaved={archive.saved}
              onOpen={open}
              renderFeedback={(analysis) => (
                <JournalConversation
                  key={analysis.id}
                  ownerId={ownerId}
                  entryId={entryId}
                  analysis={analysis}
                  onOpen={open}
                />
              )}
            />
          </>
        ) : (
          <p className="p-12 text-gray-500">Select an entry or start a new one.</p>
        )}
      </section>
    </div>
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
