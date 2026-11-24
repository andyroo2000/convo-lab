import { useTranslation } from 'react-i18next';

import type { StudySessionGrade } from './studySessionWrapUpModel';

interface StudyGradeButtonsProps {
  disabled?: boolean;
  selectedGrade?: StudySessionGrade | null;
  onGrade: (grade: 'again' | 'hard' | 'good' | 'easy') => void;
}

const StudyGradeButtons = ({
  disabled = false,
  selectedGrade,
  onGrade,
}: StudyGradeButtonsProps) => {
  const { t } = useTranslation('study');

  return (
    <div className="study-washi-grades">
      {(['again', 'hard', 'good', 'easy'] as const).map((grade) => (
        <button
          key={grade}
          type="button"
          onClick={() => onGrade(grade)}
          disabled={disabled || Boolean(selectedGrade)}
          aria-pressed={selectedGrade === grade}
          aria-label={t(`gradeButtons.${grade}`)}
          data-grade={grade}
          className="study-washi-grade disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="study-grade-pill">
            {t(`gradeButtons.${grade}`)}
            {selectedGrade === grade && (
              <span aria-hidden="true" className="study-grade-check">
                ✓
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
};

export default StudyGradeButtons;
