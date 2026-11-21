import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';
import useDialogDismissal from '../../hooks/useDialogDismissal';
import { journalFonts, type JournalTypography } from './journalTypography';
import './journalEntryDialogs.css';
import './journalAppearance.css';

interface Props {
  value: JournalTypography;
  onChange: (value: JournalTypography) => void;
  saved: boolean;
  menu?: boolean;
}
const FontPreview = ({ value }: { value: JournalTypography }) => (
  <p
    aria-label="Font preview"
    className="journal-font-preview"
    style={{
      fontFamily: journalFonts[value.font],
      fontSize: value.size,
      fontWeight: value.font === 'klee' ? 600 : 400,
    }}
  >
    <span lang="ja">今日はいい一日でした。</span>
  </p>
);

const JournalAppearance = ({ value, onChange, saved, menu = false }: Props) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const openDialog = useDialogDismissal(dialog);
  return (
    <>
      <button
        type="button"
        aria-label={menu ? 'Appearance' : 'Journal appearance'}
        aria-haspopup="dialog"
        className={
          menu
            ? 'journal-menu-item'
            : 'flex h-11 w-11 p-0 items-center justify-center rounded-[10px] bg-indigo/5 text-indigo hover:bg-indigo/10'
        }
        onClick={(event) => openDialog(event.currentTarget)}
      >
        <span aria-hidden="true" className="text-lg">
          Aa
        </span>
        {menu && 'Appearance'}
      </button>
      {createPortal(
        <dialog
          ref={dialog}
          aria-labelledby={`${id}-title`}
          className="journal-entry-dialog journal-appearance-dialog"
        >
          <div className="journal-appearance-header">
            <h2 id={`${id}-title`} className="journal-entry-dialog-heading">
              Journal appearance
            </h2>
            <button
              type="button"
              aria-label="Close appearance"
              onClick={() => dialog.current?.close()}
              className="journal-appearance-close"
            >
              <X size={18} />
            </button>
          </div>
          <FontPreview value={value} />
          <fieldset>
            <legend className="sr-only">Font</legend>
            <div className="journal-font-options">
              {(['klee', 'sans', 'serif'] as const).map((font) => (
                <button
                  key={font}
                  type="button"
                  aria-pressed={value.font === font}
                  onClick={() => onChange({ ...value, font })}
                  className="journal-font-option"
                >
                  <span
                    aria-hidden="true"
                    style={{
                      fontFamily: journalFonts[font],
                      fontWeight: font === 'klee' ? 600 : 400,
                    }}
                    className="journal-font-specimen"
                  >
                    Aa あ
                  </span>
                  <span className="journal-font-name">
                    {{ klee: 'Klee One', sans: 'Sans-serif', serif: 'Serif' }[font]}
                  </span>
                  {value.font === font && (
                    <Check size={16} aria-hidden="true" className="journal-font-check" />
                  )}
                </button>
              ))}
            </div>
          </fieldset>
          <label htmlFor={`${id}-size`} className="journal-font-size-label">
            Font size <span>{value.size} px</span>
          </label>
          <input
            id={`${id}-size`}
            type="range"
            min={16}
            max={30}
            step={1}
            value={value.size}
            aria-valuetext={`${value.size} pixels`}
            className="journal-font-size-slider"
            onChange={(event) => onChange({ ...value, size: Number(event.target.value) })}
          />
          {!saved && (
            <p className="journal-font-save-status" role="status">
              Changed for now. This browser could not save your preference.
            </p>
          )}
        </dialog>,
        document.body
      )}
    </>
  );
};
export default JournalAppearance;
