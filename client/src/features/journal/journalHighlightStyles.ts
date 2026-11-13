import type { JournalSegment } from './types';

export const journalHighlightStyles = {
  correction: 'border-solid border-[#c76870] bg-[#fbe9e9] dark:border-[#d28c94] dark:bg-[#482c31]',
  optional: 'border-dashed border-[#caa33e] bg-[#fff2c5] dark:border-[#cfad55] dark:bg-[#443b25]',
};

export function journalHighlightLayout(segment: JournalSegment) {
  if (segment.text === '' && segment.replacement)
    return 'inline-flex min-h-11 min-w-11 items-center justify-center';
  return 'inline';
}
