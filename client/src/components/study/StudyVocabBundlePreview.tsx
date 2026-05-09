import type { StudyVocabBundle } from '@languageflow/shared/src/types';

import type { StudyVocabVariantDraft } from '../../hooks/useGeneratedStudyVocabBundle';

import StudyVocabStageSection from './StudyVocabStageSection';

const STAGE_TITLES: Record<number, string> = {
  1: 'Sentence listening',
  2: 'Sentence recognition',
  3: 'Word listening',
  4: 'Word recognition',
  5: 'Sentence cloze',
};

interface StudyVocabBundlePreviewProps {
  bundle: StudyVocabBundle;
  commitError: Error | null;
  isCommitting: boolean;
  learnerContextSummary: string | null;
  onCommit: () => void;
  onClosePreview: () => void;
  onPreview: (index: number) => void;
  onRegenerateAudio: (index: number) => void;
  previewDraftIndex: number | null;
  regenerateErrors: Record<string, string>;
  regeneratingCandidateId: string | null;
  variantDrafts: StudyVocabVariantDraft[];
}

const StudyVocabBundlePreview = ({
  bundle,
  commitError,
  isCommitting,
  learnerContextSummary,
  onCommit,
  onClosePreview,
  onPreview,
  onRegenerateAudio,
  previewDraftIndex,
  regenerateErrors,
  regeneratingCandidateId,
  variantDrafts,
}: StudyVocabBundlePreviewProps) => {
  const indexedVariants = variantDrafts.map((variant, index) => ({ variant, index }));
  const stages = [1, 2, 3, 4, 5].map((stage) => ({
    stage,
    variants: indexedVariants.filter(({ variant }) => variant.meta.stage === stage),
  }));

  return (
    <section className="card retro-paper-panel max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-600">Target word</p>
          <h2 className="font-display text-3xl text-brown">{bundle.targetWord}</h2>
          {bundle.targetMeaning ? (
            <p className="mt-1 text-sm text-gray-700">{bundle.targetMeaning}</p>
          ) : null}
          {learnerContextSummary ? (
            <p className="mt-2 text-xs text-gray-500">Recent study context was included.</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onCommit}
          disabled={isCommitting}
          className="rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isCommitting ? 'Adding…' : `Add ${variantDrafts.length} staged cards`}
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {bundle.sentences.map((sentence) => (
          <article
            key={sentence.ordinal}
            className="rounded-lg border border-gray-200 bg-white/70 p-3"
          >
            <p className="text-sm font-semibold text-navy">{sentence.sentenceJp}</p>
            <p className="mt-1 text-sm text-gray-600">{sentence.sentenceEn}</p>
          </article>
        ))}
      </div>
      {stages.map(({ stage, variants }) => (
        <StudyVocabStageSection
          key={stage}
          stage={stage}
          title={STAGE_TITLES[stage] ?? `Stage ${stage}`}
          variants={variants}
          previewDraftIndex={previewDraftIndex}
          regenerateErrors={regenerateErrors}
          regeneratingCandidateId={regeneratingCandidateId}
          onClosePreview={onClosePreview}
          onPreview={onPreview}
          onRegenerateAudio={onRegenerateAudio}
        />
      ))}
      {commitError ? <p className="text-sm text-red-600">{commitError.message}</p> : null}
    </section>
  );
};

export default StudyVocabBundlePreview;
