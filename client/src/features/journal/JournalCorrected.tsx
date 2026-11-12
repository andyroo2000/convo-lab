import { useState } from 'react';
import { Pencil } from 'lucide-react';
import JournalCopyButton from './JournalCopyButton';
import JournalAudioPlayer from './JournalAudioPlayer';
import JournalRuby from './JournalRuby';
import type { JournalAnalysis } from './types';
import type { JournalDocumentControls } from './useJournalDocument';

interface Props {
  ownerId: string;
  entryId: string;
  analysis: JournalAnalysis;
  controls: JournalDocumentControls;
}
function correctedContent(analysis: JournalAnalysis) {
  const feedback = analysis.result!;
  const addition = analysis.currentReply?.result;
  const text = analysis.correctedDocument?.text ?? addition?.entryText ?? feedback.correctedText;
  const reading =
    analysis.correctedDocument?.reading ?? addition?.entryReading ?? feedback.correctedReading;
  return { text, reading };
}

const JournalCorrected = ({ ownerId, entryId, analysis, controls }: Props) => {
  const [draft, setDraft] = useState<{ text: string; revision: number } | null>(null);
  const { text, reading } = correctedContent(analysis);
  async function save() {
    if (!draft) return;
    try {
      if (await controls.change({ text: draft.text }, draft.revision)) setDraft(null);
    } catch {
      /* Keep the user's text visible on failure. */
    }
  }
  return (
    <section aria-label="Corrected Version" className="space-y-4 border-t border-gray-200 pt-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-navy">Corrected Version</h2>
        <div className="flex items-center">
          {!draft && (
            <button
              type="button"
              aria-label="Edit corrected version"
              title="Edit corrected version"
              disabled={controls.busy}
              className="flex h-11 w-11 items-center justify-center rounded-lg text-indigo hover:bg-indigo/5 disabled:opacity-40"
              onClick={() => {
                controls.reset();
                setDraft({ text, revision: analysis.replyRevision ?? 0 });
              }}
            >
              <Pencil size={18} />
            </button>
          )}
          <JournalCopyButton key={text} text={text} />
        </div>
      </div>
      {draft ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            save().catch(() => undefined);
          }}
        >
          <textarea
            id="corrected-entry-editor"
            aria-label="Corrected entry text"
            lang="ja"
            value={draft.text}
            maxLength={30000}
            rows={8}
            readOnly={controls.busy}
            className="w-full rounded-xl border border-gray-300 bg-white p-4 text-xl leading-loose text-navy focus:border-indigo focus:outline-none"
            onChange={(event) => setDraft({ ...draft, text: event.target.value })}
          />
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={controls.busy || !draft.text.trim()}
              className="rounded-lg bg-indigo px-4 py-2 text-white disabled:opacity-40"
            >
              {controls.busy ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              disabled={controls.busy}
              className="rounded-lg px-4 py-2 text-gray-600"
              onClick={() => {
                setDraft(null);
                controls.reset();
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <JournalAudioPlayer
            key={`${analysis.id}:${analysis.replyRevision}`}
            ownerId={ownerId}
            entryId={entryId}
            analysisId={analysis.id}
            expectedReplyRevision={analysis.replyRevision ?? 0}
          />
          <p lang="ja" className="whitespace-pre-wrap text-xl leading-[2.7] text-navy">
            <JournalRuby text={reading} />
          </p>
        </>
      )}
      {controls.error && (
        <p role="alert" className="text-sm text-rose-700">
          {controls.error}
        </p>
      )}
    </section>
  );
};
export default JournalCorrected;
