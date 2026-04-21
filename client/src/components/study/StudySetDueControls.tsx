import { useMemo, useState } from 'react';

interface StudySetDueControlsProps {
  disabled?: boolean;
  isSubmitting?: boolean;
  onCancel?: () => void;
  onSubmit: (payload: {
    mode: 'now' | 'tomorrow' | 'custom_date';
    dueAt?: string;
  }) => Promise<void> | void;
}

const StudySetDueControls = ({
  disabled = false,
  isSubmitting = false,
  onCancel,
  onSubmit,
}: StudySetDueControlsProps) => {
  const [customDate, setCustomDate] = useState('');
  const customDateInputId = 'study-set-due-custom-date';
  const customDateIso = useMemo(() => {
    if (!customDate) return null;
    const date = new Date(`${customDate}T09:00:00`);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }, [customDate]);

  return (
    <div className="space-y-3 rounded-2xl border border-gray-200 bg-cream/60 p-4">
      <p className="text-sm font-medium text-navy">Set due</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || isSubmitting}
          onClick={() => {
            onSubmit({ mode: 'now' });
          }}
          className="rounded-full border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Now
        </button>
        <button
          type="button"
          disabled={disabled || isSubmitting}
          onClick={() => {
            onSubmit({ mode: 'tomorrow' });
          }}
          className="rounded-full border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Tomorrow
        </button>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label
          htmlFor={customDateInputId}
          className="flex min-w-[12rem] flex-col gap-1 text-sm text-gray-600"
        >
          <span>Custom date</span>
          <input
            id={customDateInputId}
            type="date"
            value={customDate}
            onChange={(event) => setCustomDate(event.target.value)}
            disabled={disabled || isSubmitting}
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
        <button
          type="button"
          disabled={disabled || isSubmitting || !customDateIso}
          onClick={() => {
            if (!customDateIso) return;
            onSubmit({ mode: 'custom_date', dueAt: customDateIso });
          }}
          className="rounded-full border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Apply
        </button>
        {onCancel ? (
          <button
            type="button"
            disabled={disabled || isSubmitting}
            onClick={onCancel}
            className="rounded-full border border-transparent px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default StudySetDueControls;
