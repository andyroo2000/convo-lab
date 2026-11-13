import type { JournalSegment } from './types';

export const journalHighlightStyles = {
  // The journal page has a fixed white surface, even with an OS dark preference.
  correction: 'border-solid border-[#c76870] bg-[#fbe9e9]',
  optional: 'border-dashed border-[#caa33e] bg-[#fff2c5]',
};

export function journalHighlightLayout(segment: JournalSegment) {
  if (segment.text === '' && segment.replacement)
    return 'inline-flex min-h-11 min-w-11 items-center justify-center';
  return 'inline';
}
