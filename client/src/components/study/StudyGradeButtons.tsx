import { useTranslation } from 'react-i18next';

interface StudyGradeButtonsProps {
  gradeIntervals: Record<'again' | 'hard' | 'good' | 'easy', string> | null;
  disabled?: boolean;
  onGrade: (grade: 'again' | 'hard' | 'good' | 'easy') => void;
  onReplayAudio?: () => void;
}

const gradeButtonStyles: Record<'again' | 'hard' | 'good' | 'easy', string> = {
  again: 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100',
  hard: 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100',
  good: 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
  easy: 'border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100',
};

const StudyGradeButtons = ({
  gradeIntervals,
  disabled = false,
  onGrade,
  onReplayAudio,
}: StudyGradeButtonsProps) => {
  const { t } = useTranslation('study');
  const replayDisabled = !onReplayAudio || disabled;

  return (
    <div className="grid grid-cols-[3rem_repeat(4,minmax(0,1fr))] gap-1.5 md:grid-cols-[2.75rem_repeat(4,minmax(0,1fr))] md:gap-2">
      <button
        type="button"
        onClick={onReplayAudio}
        disabled={replayDisabled}
        aria-label="Replay answer audio"
        title="Replay answer audio"
        data-testid="study-grade-tray-audio"
        className="inline-flex min-h-[3rem] items-center justify-center rounded-lg border border-gray-300 bg-white px-1 py-1.5 text-navy transition hover:border-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 md:min-h-[2.25rem] md:px-2 md:py-1"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
      </button>
      {(['again', 'hard', 'good', 'easy'] as const).map((grade, index) => (
        <button
          key={grade}
          type="button"
          onClick={() => onGrade(grade)}
          disabled={disabled}
          className={`min-h-[3rem] rounded-lg border px-1 py-1.5 text-center transition disabled:cursor-not-allowed disabled:opacity-60 md:flex md:min-h-[2.25rem] md:items-center md:justify-center md:gap-2 md:px-3 md:py-1 ${gradeButtonStyles[grade]}`}
        >
          <p className="text-xs font-semibold leading-tight md:text-sm">
            {gradeIntervals?.[grade] ?? '...'}
          </p>
          <p className="mt-0.5 text-xs font-semibold leading-tight md:mt-0 md:text-sm">
            {t(`gradeButtons.${grade}`)}
          </p>
          <p className="mt-1 hidden text-xs uppercase tracking-[0.18em] text-current/70">
            {t('gradeButtons.key', { index: index + 1 })}
          </p>
        </button>
      ))}
    </div>
  );
};

export default StudyGradeButtons;
