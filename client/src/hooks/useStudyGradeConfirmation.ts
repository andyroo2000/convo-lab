import { useCallback, useEffect, useRef, useState } from 'react';
import type { StudySessionGrade } from '../components/study/studySessionWrapUpModel';

function gradeConfirmation(isCurrent: () => boolean) {
  const delay = new Promise<void>((resolve) => {
    window.setTimeout(resolve, 650);
  });
  return {
    async isCurrentAfterDelay() {
      await delay;
      return isCurrent();
    },
    async holdResult<T>(request: Promise<T>) {
      const [result] = await Promise.all([request, delay]);
      return result;
    },
  };
}

export type StudyGradeConfirmation = ReturnType<typeof gradeConfirmation>;

export function useStudyGradeConfirmation(accepting: boolean, cardId?: string) {
  const [selectedGrade, setSelectedGrade] = useState<StudySessionGrade | null>(null);
  const active = useRef<symbol | null>(null);
  useEffect(() => {
    setSelectedGrade(null);
    return () => {
      active.current = null;
    };
  }, [cardId, accepting]);

  const confirm = useCallback(
    async (
      grade: StudySessionGrade,
      submit: (confirmation: StudyGradeConfirmation) => Promise<void>
    ) => {
      if (!accepting || active.current) return;
      const ticket = Symbol('grade');
      active.current = ticket;
      setSelectedGrade(grade);
      try {
        await submit(gradeConfirmation(() => active.current === ticket));
      } finally {
        if (active.current === ticket) {
          active.current = null;
          setSelectedGrade(null);
        }
      }
    },
    [accepting]
  );

  return { selectedGrade, confirm };
}
