import { useId } from 'react';
import { createPortal } from 'react-dom';
import useJournalActionPopover from './useJournalActionPopover';
import JournalRuby from './JournalRuby';
import JournalEditText from './JournalEditText';
import JournalSuggestionFooter from './JournalSuggestionFooter';
import { journalHighlightLayout, journalHighlightStyles } from './journalHighlightStyles';
import type { JournalSegment } from './types';

const editDescription = (segment: JournalSegment) => {
  if (segment.replacement == null) return segment.text;
  if (segment.replacement === '') return `Remove ${segment.text}`;
  if (segment.text === '') return `Insert ${segment.replacement}`;
  return `Replace ${segment.text} with ${segment.replacement}`;
};

const labels = {
  correction: 'Correction',
  optional: 'Optional change',
  keep: '',
  plain: '',
};

interface HighlightProps {
  segment: JournalSegment;
  action?: { applied: boolean; disabled: boolean; error?: string; toggle: () => Promise<boolean> };
}
const JournalNote = ({ segment, action, close }: HighlightProps & { close: () => void }) => (
  <>
    <p className="text-sm leading-relaxed">
      <JournalRuby text={segment.explanationReading ?? segment.explanation ?? ''} />
    </p>
    {action?.error && (
      <p role="alert" className="mt-2 text-sm text-rose-700 dark:text-rose-300">
        {action.error}
      </p>
    )}
    {action ? (
      <JournalSuggestionFooter kind={segment.kind} action={action} close={close} />
    ) : (
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-300">
        To change this passage, edit the corrected version.
      </p>
    )}
  </>
);

const JournalHighlight = ({ segment, action }: HighlightProps) => {
  const { anchor, popup, open, position, show, hide, dismiss, trigger } = useJournalActionPopover();
  const id = useId();

  if (segment.kind === 'plain' || segment.kind === 'keep')
    return <JournalRuby text={segment.reading} />;

  const layout = journalHighlightLayout(segment);

  return (
    <>
      <button
        ref={anchor}
        type="button"
        className={`${layout} rounded border-b-2 px-0.5 py-0.5 leading-normal text-left text-inherit [box-decoration-break:clone] ${journalHighlightStyles[segment.kind]}`}
        aria-label={`${labels[segment.kind]}: ${editDescription(segment)}`}
        aria-controls={open ? id : undefined}
        aria-expanded={open}
        aria-haspopup="dialog"
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') show();
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse') hide();
        }}
        {...trigger}
      >
        <JournalEditText segment={segment} />
      </button>
      {open &&
        createPortal(
          <div
            ref={popup}
            id={id}
            role="dialog"
            aria-label={labels[segment.kind]}
            style={position}
            className="fixed z-50 max-h-[calc(100dvh-24px)] overflow-y-auto w-max max-w-[min(24rem,calc(100vw-24px))] rounded-[14px] border border-[#e8ddd5] bg-white p-3.5 text-navy shadow-lg dark:border-[#455055] dark:bg-[#2a3338] dark:text-[#e2e9ee]"
            onPointerEnter={show}
            onPointerLeave={(event) => {
              if (event.pointerType === 'mouse') hide();
            }}
          >
            <JournalNote segment={segment} action={action} close={dismiss} />
          </div>,
          document.body
        )}
    </>
  );
};

export default JournalHighlight;
