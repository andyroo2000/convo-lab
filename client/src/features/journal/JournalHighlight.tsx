import { useId } from 'react';
import { createPortal } from 'react-dom';
import useJournalActionPopover from './useJournalActionPopover';
import JournalRuby from './JournalRuby';
import JournalSuggestionFooter from './JournalSuggestionFooter';
import type { JournalSegment } from './types';

const styles = {
  correction: 'bg-rose-50 decoration-rose-400 decoration-solid',
  optional: 'bg-amber-50 decoration-amber-500 decoration-dashed',
  keep: '',
  plain: '',
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
      <p role="alert" className="mt-2 text-sm text-rose-700">
        {action.error}
      </p>
    )}
    {action ? (
      <JournalSuggestionFooter kind={segment.kind} action={action} close={close} />
    ) : (
      <p className="mt-2 text-xs text-gray-500">
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

  return (
    <>
      <button
        ref={anchor}
        type="button"
        className={`inline rounded px-0.5 leading-normal text-left text-inherit underline decoration-2 underline-offset-4 [box-decoration-break:clone] ${styles[segment.kind]}`}
        aria-label={`${labels[segment.kind]}: ${segment.text}`}
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
        <JournalRuby text={segment.reading} />
      </button>
      {open &&
        createPortal(
          <div
            ref={popup}
            id={id}
            role="dialog"
            aria-label={labels[segment.kind]}
            style={position}
            className="fixed z-50 max-h-[calc(100dvh-24px)] overflow-y-auto w-max max-w-[min(24rem,calc(100vw-24px))] rounded-[14px] border border-[#e5e7e5] bg-[#fffefa] p-3.5 text-[#173b56] shadow-lg dark:border-[#455055] dark:bg-[#2a3338] dark:text-[#e2e9ee]"
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
