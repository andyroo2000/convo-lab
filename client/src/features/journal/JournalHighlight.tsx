import { useContext, useId, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import JournalDeskContext from './JournalDeskContext';
import { defaultTypography } from './journalTypography';
import useJournalActionPopover from './useJournalActionPopover';
import JournalRuby from './JournalRuby';
import JournalCorrection from './JournalCorrection';
import JournalExplanation from './JournalExplanation';
import './journalTutorText.css';
import './journalNotePopover.css';
import JournalEditText from './JournalEditText';
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
  separate?: boolean;
}
const JournalNote = ({ segment }: Pick<HighlightProps, 'segment'>) => (
  <>
    <JournalCorrection segment={segment} />
    <JournalExplanation segment={segment} />
  </>
);

const JournalHighlight = ({ segment, separate = false }: HighlightProps) => {
  const { anchor, popup, open, position, pointer, show, hide, trigger } = useJournalActionPopover();
  const id = useId();
  const { textSize = defaultTypography.size } = useContext(JournalDeskContext);

  if (segment.kind === 'plain' || segment.kind === 'keep')
    return <JournalRuby text={segment.reading} />;

  const layout = journalHighlightLayout(segment);

  return (
    <>
      <button
        ref={anchor}
        type="button"
        className={`${layout} ${separate ? 'ml-[6px]' : ''} rounded border-b-2 px-0.5 py-0.5 leading-normal text-left text-inherit [box-decoration-break:clone] ${journalHighlightStyles[segment.kind]}`}
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
            style={{ ...position, '--journal-size': `${textSize}px` } as CSSProperties}
            className="journal-note-popover fixed z-50 w-max max-w-[min(30rem,calc(100vw-24px))] text-navy shadow-lg dark:text-[#e2e9ee]"
            onPointerEnter={show}
            onPointerLeave={(event) => {
              if (event.pointerType === 'mouse') hide();
            }}
          >
            {pointer.visible && (
              <span
                className="journal-note-pointer"
                data-placement={pointer.placement}
                style={{ left: pointer.left }}
                aria-hidden="true"
              />
            )}
            <div className="journal-note-content">
              <JournalNote segment={segment} />
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default JournalHighlight;
