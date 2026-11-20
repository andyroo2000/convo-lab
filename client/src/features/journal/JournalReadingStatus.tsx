import type { JournalAnalysis } from './types';
import type { JournalDocumentControls } from './useJournalDocument';

interface Props {
  analysis: JournalAnalysis;
  controls: JournalDocumentControls;
}

const JournalReadingStatus = ({ analysis, controls }: Props) => {
  const document = analysis.correctedDocument;
  if (document?.readingStatus === 'pending') {
    return (
      <p role="status" className="text-sm text-gray-500">
        Saved. Updating furigana…
      </p>
    );
  }
  if (document?.readingStatus !== 'failed') return null;
  return (
    <div className="space-y-2 text-sm text-gray-500">
      <p role="status">
        Your edits are saved. Furigana couldn’t be updated.{' '}
        <button
          type="button"
          className="underline"
          disabled={controls.busy}
          onClick={() => {
            controls.change({ text: document.text }).catch(() => undefined);
          }}
        >
          Retry furigana
        </button>
      </p>
      {controls.error && <p role="alert">{controls.error}</p>}
    </div>
  );
};

export default JournalReadingStatus;
