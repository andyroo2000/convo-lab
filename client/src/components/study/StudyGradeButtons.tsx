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
}: StudyGradeButtonsProps) => (
  <div className="grid gap-3 md:grid-cols-4">
    {(['again', 'hard', 'good', 'easy'] as const).map((grade, index) => (
      <button
        key={grade}
        type="button"
        onClick={() => onGrade(grade)}
        disabled={disabled}
        className={`rounded-[1.5rem] border px-4 py-4 text-center transition disabled:cursor-not-allowed disabled:opacity-60 ${gradeButtonStyles[grade]}`}
      >
        <p className="text-2xl font-semibold">{gradeIntervals?.[grade] ?? '...'}</p>
        <p className="mt-2 text-xl font-semibold capitalize">{grade}</p>
        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-current/70">Key {index + 1}</p>
      </button>
    ))}
  </div>
);

export default StudyGradeButtons;
