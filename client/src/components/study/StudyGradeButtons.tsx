import { useTranslation } from 'react-i18next';

interface StudyGradeButtonsProps {
  gradeIntervals: Record<'again' | 'hard' | 'good' | 'easy', string> | null;
  disabled?: boolean;
  onGrade: (grade: 'again' | 'hard' | 'good' | 'easy') => void;
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
}: StudyGradeButtonsProps) => {
  const { t } = useTranslation('study');

  return (
    <div className="grid grid-cols-4 gap-1.5 md:gap-3">
      {(['again', 'hard', 'good', 'easy'] as const).map((grade, index) => (
        <button
          key={grade}
          type="button"
          onClick={() => onGrade(grade)}
          disabled={disabled}
          className={`min-h-[3rem] rounded-lg border px-1 py-1.5 text-center transition disabled:cursor-not-allowed disabled:opacity-60 md:min-h-[8.25rem] md:rounded-[1.5rem] md:px-4 md:py-4 ${gradeButtonStyles[grade]}`}
        >
          <p className="text-xs font-semibold leading-tight md:text-2xl">
            {gradeIntervals?.[grade] ?? '...'}
          </p>
          <p className="mt-0.5 text-xs font-semibold leading-tight md:mt-2 md:text-xl">
            {t(`gradeButtons.${grade}`)}
          </p>
          <p className="mt-1 hidden text-xs uppercase tracking-[0.18em] text-current/70 md:block">
            {t('gradeButtons.key', { index: index + 1 })}
          </p>
        </button>
      ))}
    </div>
  );
};

export default StudyGradeButtons;
