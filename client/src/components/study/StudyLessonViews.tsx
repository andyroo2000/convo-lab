import type { StudyCardSummary } from '@languageflow/shared/src/types';

import type { StudyLessonPhase as StudyLessonPhaseValue } from '../../hooks/useStudyReviewSessionState';
import type { StudySessionKind } from '../../hooks/useStudySessionLoader';
import { StudyCardFace } from './StudyCardPreview';

interface StudyLessonPreviewNavigationProps {
  isFirst: boolean;
  isLast: boolean;
  nextLabel: string;
  onNext: () => void;
  onPrevious: () => void;
  onStartQuiz: () => void;
  previousLabel: string;
  startQuizLabel: string;
}

const StudyLessonPreviewNavigation = ({
  isFirst,
  isLast,
  nextLabel,
  onNext,
  onPrevious,
  onStartQuiz,
  previousLabel,
  startQuizLabel,
}: StudyLessonPreviewNavigationProps) => (
  <div className="grid grid-cols-2 gap-3">
    <button
      type="button"
      onClick={onPrevious}
      disabled={isFirst}
      className="rounded-2xl border border-gray-300 px-6 py-4 text-lg font-bold text-navy disabled:cursor-not-allowed disabled:opacity-50"
    >
      {previousLabel}
    </button>
    <button
      type="button"
      onClick={isLast ? onStartQuiz : onNext}
      className="rounded-2xl bg-emerald-700 px-6 py-4 text-lg font-bold text-white"
    >
      {isLast ? startQuizLabel : nextLabel}
    </button>
  </div>
);

export interface StudyLessonPreviewProps {
  card: StudyCardSummary | null;
  cardPosition: string;
  description: string;
  emptyMessage: string;
  isFirst: boolean;
  isLast: boolean;
  nextLabel: string;
  onNext: () => void;
  onPrevious: () => void;
  onStartQuiz: () => void;
  previousLabel: string;
  startQuizLabel: string;
  title: string;
}

export const StudyLessonPreview = ({
  card,
  cardPosition,
  description,
  emptyMessage,
  isFirst,
  isLast,
  nextLabel,
  onNext,
  onPrevious,
  onStartQuiz,
  previousLabel,
  startQuizLabel,
  title,
}: StudyLessonPreviewProps) => (
  <div className="min-h-0 flex-1 overflow-y-auto py-4">
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="rounded-2xl bg-emerald-50 p-5 ring-1 ring-emerald-200">
        <h2 className="text-2xl font-bold text-navy">{title}</h2>
        <p className="mt-1 text-gray-600">{description}</p>
      </div>
      {card ? (
        <>
          <div key={card.id} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
            <p className="mb-4 text-center text-sm font-semibold uppercase tracking-[0.16em] text-gray-500">
              {cardPosition}
            </p>
            <StudyCardFace card={card} layout="mobile-focus" side="back" />
          </div>
          <StudyLessonPreviewNavigation
            isFirst={isFirst}
            isLast={isLast}
            nextLabel={nextLabel}
            onNext={onNext}
            onPrevious={onPrevious}
            onStartQuiz={onStartQuiz}
            previousLabel={previousLabel}
            startQuizLabel={startQuizLabel}
          />
        </>
      ) : (
        <p className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-600">
          {emptyMessage}
        </p>
      )}
    </div>
  </div>
);

export interface StudyLessonCompleteProps {
  anotherBatchLabel: string;
  description: string;
  finishLabel: string;
  onAnotherBatch: () => void;
  onFinish: () => void;
  title: string;
}

export const StudyLessonComplete = ({
  anotherBatchLabel,
  description,
  finishLabel,
  onAnotherBatch,
  onFinish,
  title,
}: StudyLessonCompleteProps) => (
  <div className="flex min-h-[60vh] flex-1 items-center justify-center">
    <div className="max-w-lg rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-200">
      <h2 className="text-3xl font-bold text-navy">{title}</h2>
      <p className="mt-3 text-gray-600">{description}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={onAnotherBatch}
          className="rounded-full bg-emerald-700 px-6 py-3 font-bold text-white"
        >
          {anotherBatchLabel}
        </button>
        <button
          type="button"
          onClick={onFinish}
          className="rounded-full border border-gray-300 px-6 py-3 font-bold text-navy"
        >
          {finishLabel}
        </button>
      </div>
    </div>
  </div>
);

interface StudyLessonPhaseProps {
  active: boolean;
  complete: StudyLessonCompleteProps;
  lessonPhase: StudyLessonPhaseValue;
  masteryAnimationActive: boolean;
  preview: StudyLessonPreviewProps;
  sessionKind: StudySessionKind;
  sessionLoading: boolean;
}

export const StudyLessonPhase = ({
  active,
  complete,
  lessonPhase,
  masteryAnimationActive,
  preview,
  sessionKind,
  sessionLoading,
}: StudyLessonPhaseProps) => {
  if (!active || sessionKind !== 'lessons') return null;
  if (lessonPhase === 'preview' && !sessionLoading) {
    return <StudyLessonPreview {...preview} />;
  }
  if (lessonPhase === 'complete' && !masteryAnimationActive) {
    return <StudyLessonComplete {...complete} />;
  }
  return null;
};
