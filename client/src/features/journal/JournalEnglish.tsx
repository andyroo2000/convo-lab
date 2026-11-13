import { useId } from 'react';
import { createPortal } from 'react-dom';
import useJournalPopover from './useJournalPopover';

const JournalEnglish = ({ translation }: { translation: string }) => {
  const popover = useJournalPopover();
  const id = useId();
  return (
    <>
      <button
        type="button"
        ref={popover.anchor}
        className="flex h-11 w-11 items-center justify-center rounded-lg text-xs font-semibold text-indigo hover:bg-white/70"
        aria-label={popover.open ? 'Hide English' : 'Show English'}
        aria-expanded={popover.open}
        aria-controls={popover.open ? id : undefined}
        onClick={popover.open ? popover.close : popover.show}
      >
        En
      </button>
      {popover.open &&
        createPortal(
          <div
            id={id}
            ref={popover.popup}
            role="region"
            aria-label="English translation"
            style={popover.position}
            className="fixed z-50 w-72 max-w-[calc(100vw-24px)] rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-gray-600 shadow-lg"
          >
            {translation}
          </div>,
          document.body
        )}
    </>
  );
};
export default JournalEnglish;
