import type { StudyVocabVariantDraft } from '../../hooks/useGeneratedStudyVocabBundle';

import StudyVocabVariantRow from './StudyVocabVariantRow';

interface StudyVocabStageSectionProps {
  stage: number;
  title: string;
  variants: Array<{ index: number; variant: StudyVocabVariantDraft }>;
  previewDraftIndex: number | null;
  regenerateErrors: Record<string, string>;
  regeneratingCandidateId: string | null;
  onClosePreview: () => void;
  onPreview: (index: number) => void;
  onRegenerateAudio: (index: number) => void;
}

const StudyVocabStageSection = ({
  stage,
  title,
  variants,
  previewDraftIndex,
  regenerateErrors,
  regeneratingCandidateId,
  onClosePreview,
  onPreview,
  onRegenerateAudio,
}: StudyVocabStageSectionProps) => (
  <section className="space-y-3">
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Stage {stage}</p>
      <h3 className="font-display text-xl text-brown">{title}</h3>
    </div>
    {variants.map(({ index, variant }) => {
      const isRegenerating = regeneratingCandidateId === variant.draft.candidate.clientId;
      return (
        <StudyVocabVariantRow
          key={variant.meta.clientId}
          index={index}
          variant={variant}
          isRegenerating={isRegenerating}
          isRegenerateDisabled={Boolean(regeneratingCandidateId) && !isRegenerating}
          isPreviewOpen={previewDraftIndex === index}
          regenerateError={regenerateErrors[variant.draft.candidate.clientId] ?? null}
          onClosePreview={onClosePreview}
          onPreview={onPreview}
          onRegenerateAudio={onRegenerateAudio}
        />
      );
    })}
  </section>
);

export default StudyVocabStageSection;
