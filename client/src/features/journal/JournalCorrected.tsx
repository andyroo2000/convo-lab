import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Pencil } from 'lucide-react';
import JournalDeskContext from './JournalDeskContext';
import JournalFinalEditor from './JournalFinalEditor';
import JournalReadingStatus from './JournalReadingStatus';
import { correctedContent } from './journalVersionText';
import JournalPaper from './JournalPaper';
import JournalAudioPlayer from './JournalAudioPlayer';
import JournalSentenceText from './JournalSentenceText';
import JournalPlaybackProvider from './JournalPlaybackContext';
import type { JournalAnalysis } from './types';
import type { JournalDocumentControls } from './useJournalDocument';

interface Props {
  ownerId: string;
  entryId: string;
  analysis: JournalAnalysis;
  controls: JournalDocumentControls;
  toolbarTarget?: HTMLElement | null;
  listenTarget?: HTMLElement | null;
  active?: boolean;
  heading?: ReactNode;
}
const JournalCorrected = ({
  ownerId,
  entryId,
  analysis,
  controls,
  toolbarTarget,
  listenTarget,
  active = true,
  heading,
}: Props) => {
  const { text, reading } = correctedContent(analysis);
  const [editing, setEditing] = useState<{ text: string; revision: number } | null>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const { editingChanged } = useContext(JournalDeskContext);
  const isEditing = Boolean(editing);
  useEffect(() => {
    if (!isEditing) return undefined;
    editingChanged?.(1);
    return () => editingChanged?.(-1);
  }, [isEditing, editingChanged]);
  const closeEditor = () => {
    setEditing(null);
    controls.reset();
    requestAnimationFrame(() => editButton.current?.focus());
  };
  const edit = (
    <button
      ref={editButton}
      type="button"
      aria-label="Edit final text"
      title="Edit final text"
      disabled={controls.busy || Boolean(editing)}
      className="journal-menu-item"
      onClick={() => {
        controls.reset();
        setEditing({ text, revision: analysis.replyRevision ?? 0 });
      }}
    >
      <Pencil size={18} aria-hidden="true" /> Edit final
    </button>
  );
  return (
    <section aria-label="Corrected Version" className="space-y-4">
      {active && (toolbarTarget ? createPortal(edit, toolbarTarget) : edit)}
      {editing ? (
        <JournalFinalEditor
          {...editing}
          controls={controls}
          onClose={closeEditor}
          heading={heading}
        />
      ) : (
        <JournalPlaybackProvider
          key={`${ownerId}:${entryId}:${analysis.id}:${analysis.replyRevision}`}
        >
          <div className="journal-final-notebook">
            <JournalReadingStatus analysis={analysis} controls={controls} />
            <JournalAudioPlayer
              key={`${analysis.id}:${analysis.replyRevision}`}
              toolbarTarget={toolbarTarget}
              listenTarget={listenTarget}
              active={active}
              ownerId={ownerId}
              entryId={entryId}
              analysisId={analysis.id}
              expectedReplyRevision={analysis.replyRevision ?? 0}
            />
            <JournalPaper heading={heading}>
              <JournalSentenceText text={reading} />
            </JournalPaper>
          </div>
        </JournalPlaybackProvider>
      )}
    </section>
  );
};
export default JournalCorrected;
