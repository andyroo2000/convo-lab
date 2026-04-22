import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import toLocalNineAmIso from './studySetDueUtils';

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
  const { t } = useTranslation('study');
  const [customDate, setCustomDate] = useState('');
  const customDateInputId = 'study-set-due-custom-date';
  const customDateIso = useMemo(() => {
    if (!customDate) return null;
    return toLocalNineAmIso(customDate);
  }, [customDate]);

  return (
    <div
      data-testid="study-set-due-controls"
      className="space-y-3 rounded-2xl border border-gray-200 bg-cream/60 p-4"
    >
      <p className="text-sm font-medium text-navy">{t('setDue.title')}</p>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <button
          type="button"
          disabled={disabled || isSubmitting}
          onClick={() => {
            onSubmit({ mode: 'now' });
          }}
          className="rounded-full border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t('setDue.now')}
        </button>
        <button
          type="button"
          disabled={disabled || isSubmitting}
          onClick={() => {
            onSubmit({ mode: 'tomorrow' });
          }}
          className="rounded-full border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t('setDue.tomorrow')}
        </button>
      </div>
      <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-end">
        <label
          htmlFor={customDateInputId}
          className="flex w-full flex-col gap-1 text-sm text-gray-600 sm:min-w-[12rem]"
        >
          <span>{t('setDue.customDate')}</span>
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
          className="rounded-full border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {t('setDue.apply')}
        </button>
        {onCancel ? (
          <button
            type="button"
            disabled={disabled || isSubmitting}
            onClick={onCancel}
            className="rounded-full border border-transparent px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {t('setDue.cancel')}
          </button>
        ) : null}
      </div>
    </div>
  );
};

export default StudySetDueControls;
