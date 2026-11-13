import { useId, useRef } from 'react';
import { Check, X } from 'lucide-react';
import { journalFonts, type JournalTypography } from './journalTypography';

interface Props {
  value: JournalTypography;
  onChange: (value: JournalTypography) => void;
  saved: boolean;
}
const JournalAppearance = ({ value, onChange, saved }: Props) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  return (
    <>
      <button
        type="button"
        aria-label="Journal appearance"
        aria-haspopup="dialog"
        className="flex h-11 w-[52px] items-center justify-center rounded-[10px] border border-indigo/60 text-indigo hover:border-indigo hover:bg-indigo/5"
        onClick={() => dialog.current?.showModal()}
      >
        <span aria-hidden="true" className="text-lg">
          Aa
        </span>
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={`${id}-title`}
        className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-2xl border border-gray-200 bg-white p-5 text-navy shadow-xl backdrop:bg-black/20 md:inset-0 md:m-auto md:w-80 md:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id={`${id}-title`} className="font-semibold">
            Journal appearance
          </h2>
          <button
            type="button"
            aria-label="Close appearance"
            onClick={() => dialog.current?.close()}
            className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>
        <fieldset>
          <legend className="mb-2 text-sm text-gray-600">Font</legend>
          <div className="grid grid-cols-2 gap-3">
            {(['sans', 'serif'] as const).map((font) => (
              <button
                key={font}
                type="button"
                aria-pressed={value.font === font}
                onClick={() => onChange({ ...value, font })}
                className={`relative flex min-h-24 flex-col items-start gap-3 rounded-xl border p-4 text-left focus-visible:outline-indigo ${value.font === font ? 'border-indigo bg-indigo/5' : 'border-gray-200 hover:border-indigo'}`}
              >
                <span
                  aria-hidden="true"
                  style={{ fontFamily: journalFonts[font] }}
                  className="text-3xl"
                >
                  Aa あ
                </span>
                <span className="text-sm">{font === 'sans' ? 'Sans-serif' : 'Serif'}</span>
                {value.font === font && (
                  <Check
                    size={16}
                    aria-hidden="true"
                    className="absolute right-2 top-2 text-indigo"
                  />
                )}
              </button>
            ))}
          </div>
        </fieldset>
        <label htmlFor={`${id}-size`} className="mt-6 flex justify-between text-sm">
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
          className="mt-2 h-11 w-full accent-indigo"
          onChange={(event) => onChange({ ...value, size: Number(event.target.value) })}
        />
        <p className="mt-3 text-xs text-gray-500" role="status">
          {saved
            ? 'For all Journal entries on this device.'
            : 'Changed for now. This browser could not save your preference.'}
        </p>
      </dialog>
    </>
  );
};
export default JournalAppearance;
