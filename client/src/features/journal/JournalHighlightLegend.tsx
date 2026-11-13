import { journalHighlightStyles } from './journalHighlightStyles';

const JournalHighlightLegend = () => (
  <div
    role="group"
    aria-label="Highlight meanings"
    className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-500"
  >
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className={`h-3 w-4 rounded-sm border-b-2 ${journalHighlightStyles.correction}`}
      />
      Correction
    </span>
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className={`h-3 w-4 rounded-sm border-b-2 ${journalHighlightStyles.optional}`}
      />
      Optional change
    </span>
  </div>
);
export default JournalHighlightLegend;
