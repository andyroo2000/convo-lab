import { useId } from 'react';
import { createPortal } from 'react-dom';
import useJournalPopover from './useJournalPopover';
import JournalRuby from './JournalRuby';
import type { JournalSegment } from './types';

const styles = {
  correction: 'bg-rose-50 decoration-rose-400 decoration-solid',
  optional: 'bg-amber-50 decoration-amber-500 decoration-dashed',
  keep: 'bg-emerald-50 decoration-emerald-500 decoration-dotted',
  plain: '',
};
const labels = {
  correction: 'Correction',
  optional: 'Optional change',
  keep: 'Worth keeping',
  plain: '',
};

const JournalHighlight = ({ segment }: { segment: JournalSegment }) => {
  const { anchor, popup, open, position, show, hide } = useJournalPopover();
  const id = useId();

  return (
    <>
      <button
        ref={anchor}
        type="button"
        className={`rounded px-0.5 text-left text-inherit underline decoration-2 underline-offset-4 ${styles[segment.kind]}`}
        aria-label={`${labels[segment.kind]}: ${segment.text}`}
        aria-describedby={open ? id : undefined}
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') show();
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse') hide();
        }}
        onFocus={show}
        onBlur={hide}
        onClick={show}
      >
        <JournalRuby text={segment.reading} />
      </button>
      {open &&
        createPortal(
          <div
            ref={popup}
            id={id}
            role="tooltip"
            style={position}
            className="fixed z-50 max-h-[calc(100dvh-24px)] overflow-y-auto w-max max-w-[min(24rem,calc(100vw-24px))] rounded-xl border border-gray-200 bg-white p-3 shadow-lg"
            onPointerEnter={show}
            onPointerLeave={(event) => {
              if (event.pointerType === 'mouse') hide();
            }}
          >
            <p lang="ja" className="whitespace-pre-wrap text-xl leading-loose text-navy">
              <JournalRuby text={segment.suggestionReading ?? segment.reading} />
            </p>
            <p className="mt-1 text-sm leading-relaxed text-gray-600">
              <JournalRuby text={segment.explanationReading ?? ''} />
            </p>
          </div>,
          document.body
        )}
    </>
  );
};

export default JournalHighlight;
