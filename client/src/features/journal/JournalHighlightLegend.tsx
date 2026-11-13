const JournalHighlightLegend = () => (
  <div
    aria-label="Highlight meanings"
    className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-500 dark:text-gray-300"
  >
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className="h-3 w-4 rounded-sm border-b border-[#c76870] bg-[#fbe9e9] dark:border-[#d28c94] dark:bg-[#482c31]"
      />
      Correction
    </span>
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className="h-3 w-4 rounded-sm border-b border-dashed border-[#caa33e] bg-[#fff2c5] dark:border-[#cfad55] dark:bg-[#443b25]"
      />
      Optional change
    </span>
  </div>
);
export default JournalHighlightLegend;
