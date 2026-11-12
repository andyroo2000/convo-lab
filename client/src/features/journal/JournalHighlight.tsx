import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import useJournalPopover from './useJournalPopover';
import JournalRuby from './JournalRuby';
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

function actionLabel(kind: JournalSegment['kind'], applied: boolean) {
  if (kind === 'correction') return applied ? 'Reject correction' : 'Apply correction';
  return applied ? 'Undo suggestion' : 'Apply suggestion';
}

interface HighlightProps {
  segment: JournalSegment;
  action?: { applied: boolean; disabled: boolean; toggle: () => Promise<boolean> };
}
const JournalNote = ({ segment, action, close }: HighlightProps & { close: () => void }) => (
  <>
    <p className="text-sm leading-relaxed text-gray-600">
      <JournalRuby text={segment.explanationReading ?? segment.explanation ?? ''} />
    </p>
    {action ? (
      <button
        type="button"
        disabled={action.disabled}
        className="mt-3 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-indigo hover:bg-indigo/5 disabled:opacity-40"
        onClick={() => {
          action
            .toggle()
            .then((saved) => {
              if (saved) close();
            })
            .catch(() => undefined);
        }}
      >
        {actionLabel(segment.kind, action.applied)}
      </button>
    ) : (
      <p className="mt-2 text-xs text-gray-500">
        To change this passage, edit the corrected version.
      </p>
    )}
  </>
);

const JournalHighlight = ({ segment, action }: HighlightProps) => {
  const { anchor, popup, open, position, show, hide, close } = useJournalPopover();
  const id = useId();
  const closeOnClick = useRef(false);

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
        onFocus={show}
        onPointerDown={() => {
          closeOnClick.current = open;
        }}
        onClick={() => {
          if (closeOnClick.current) close();
          else show();
          closeOnClick.current = false;
        }}
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
            className="fixed z-50 max-h-[calc(100dvh-24px)] overflow-y-auto w-max max-w-[min(24rem,calc(100vw-24px))] rounded-xl border border-gray-200 bg-white p-3 shadow-lg"
            onPointerEnter={show}
            onPointerLeave={(event) => {
              if (event.pointerType === 'mouse') hide();
            }}
          >
            <JournalNote segment={segment} action={action} close={close} />
          </div>,
          document.body
        )}
    </>
  );
};

export default JournalHighlight;
