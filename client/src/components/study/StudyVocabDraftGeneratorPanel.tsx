import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import useFakeProgress from '../../hooks/useFakeProgress';
import StudyVocabCandidateForm from './StudyVocabCandidateForm';

interface StudyVocabDraftGeneratorPanelProps {
  context: string;
  draftList: ReactNode;
  error: unknown;
  includeLearnerContext: boolean;
  isGenerating: boolean;
  onContextChange: (value: string) => void;
  onIncludeLearnerContextChange: (value: boolean) => void;
  onSourceSentenceChange: (value: string) => void;
  onSubmit: () => void;
  onTargetWordChange: (value: string) => void;
  sourceSentence: string;
  successMessage: string | null;
  targetWord: string;
}

const StudyVocabDraftGeneratorPanel = ({
  context,
  draftList,
  error,
  includeLearnerContext,
  isGenerating,
  onContextChange,
  onIncludeLearnerContextChange,
  onSourceSentenceChange,
  onSubmit,
  onTargetWordChange,
  sourceSentence,
  successMessage,
  targetWord,
}: StudyVocabDraftGeneratorPanelProps) => {
  const { t } = useTranslation('study');
  const generationProgress = useFakeProgress(isGenerating, { expectedMs: 4_000 });
  const roundedProgress = Math.round(generationProgress.progress);

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(22rem,34rem)_minmax(0,1fr)]">
      <div className="order-2 min-w-0 xl:order-1">{draftList}</div>
      <div className="order-1 space-y-4 xl:order-2">
        <StudyVocabCandidateForm
          targetWord={targetWord}
          sourceSentence={sourceSentence}
          context={context}
          includeLearnerContext={includeLearnerContext}
          isGenerating={isGenerating}
          onContextChange={onContextChange}
          onIncludeLearnerContextChange={onIncludeLearnerContextChange}
          onSourceSentenceChange={onSourceSentenceChange}
          onSubmit={onSubmit}
          onTargetWordChange={onTargetWordChange}
        />

        {error ? (
          <p className="text-sm text-red-600">
            {error instanceof Error ? error.message : t('create.generateFailed')}
          </p>
        ) : null}
        {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}
        {generationProgress.isVisible && !error && !successMessage ? (
          <div
            role="status"
            aria-label={t('create.generationProgressLabel')}
            className="max-w-xl rounded-xl border border-blue-100 bg-blue-50 px-4 py-3"
          >
            <div className="flex items-center justify-between gap-3 text-sm font-medium text-navy">
              <span>{t('create.generationProgressTitle')}</span>
              <span data-testid="study-generate-progress-percent">{roundedProgress}%</span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={roundedProgress}
              className="mt-2 h-2 overflow-hidden rounded-full bg-white"
            >
              <div
                data-testid="study-generate-progress-bar"
                className="h-full rounded-full bg-navy transition-[width] duration-300 ease-out"
                style={{ width: `${generationProgress.progress}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-gray-600">{t('create.generationProgressHint')}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default StudyVocabDraftGeneratorPanel;
