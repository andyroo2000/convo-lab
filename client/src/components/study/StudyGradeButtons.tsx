import { useTranslation } from 'react-i18next';

interface StudyGradeButtonsProps {
  disabled?: boolean;
  onGrade: (grade: 'again' | 'hard' | 'good' | 'easy') => void;
}

const StudyGradeButtons = ({ disabled = false, onGrade }: StudyGradeButtonsProps) => {
  const { t } = useTranslation('study');

  return (
    <div className="study-washi-grades grid grid-cols-4 gap-2">
      {(['again', 'hard', 'good', 'easy'] as const).map((grade, index) => (
        <button
          key={grade}
          type="button"
          onClick={() => onGrade(grade)}
          disabled={disabled}
          aria-label={t(`gradeButtons.${grade}`)}
          data-grade={grade}
          className="study-washi-grade disabled:cursor-not-allowed disabled:opacity-60"
        >
          <p className="leading-tight">{t(`gradeButtons.${grade}`)}</p>
          <p className="mt-1 hidden text-xs uppercase tracking-[0.18em] text-current/70">
            {t('gradeButtons.key', { index: index + 1 })}
          </p>
        </button>
      ))}
    </div>
  );
};

export default StudyGradeButtons;
