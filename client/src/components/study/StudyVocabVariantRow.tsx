import StudyCandidatePreviewAudio from './StudyCandidatePreviewAudio';
import StudyCandidateCardPreviewModal from './StudyCandidatePreview';
import {
  buildStudyCandidateCommitItem,
  buildStudyCandidatePreviewCard,
} from './studyCandidateModel';
import type { StudyVocabVariantDraft } from '../../hooks/useGeneratedStudyVocabBundle';

interface StudyVocabVariantRowProps {
  index: number;
  variant: StudyVocabVariantDraft;
  isRegenerating: boolean;
  isPreviewOpen: boolean;
  regenerateError: string | null;
  onPreview: (index: number) => void;
  onClosePreview: () => void;
  onRegenerateAudio: (index: number) => void;
}

const StudyVocabVariantRow = ({
  index,
  variant,
  isRegenerating,
  isPreviewOpen,
  regenerateError,
  onPreview,
  onClosePreview,
  onRegenerateAudio,
}: StudyVocabVariantRowProps) => {
  const commitItem = buildStudyCandidateCommitItem(variant.draft);
  const previewCard = buildStudyCandidatePreviewCard(variant.draft, commitItem);
  const title =
    commitItem.prompt.cueText ??
    commitItem.answer.expression ??
    commitItem.answer.restoredText ??
    commitItem.prompt.clozeText ??
    'Untitled variant';

  return (
    <article className="rounded-lg border border-gray-200 bg-white/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-navy">{title}</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-gray-500">
            {variant.meta.variantKind.replace(/_/g, ' ')}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onPreview(index)}
            className="rounded-full border border-gray-300 px-3 py-2 text-xs font-semibold text-navy hover:bg-gray-50"
          >
            Preview
          </button>
        </div>
      </div>
      <StudyCandidatePreviewAudio
        isRegenerating={isRegenerating}
        label="Play preview audio"
        onRegenerate={() => onRegenerateAudio(index)}
        previewUrl={variant.draft.previewAudio?.url ?? null}
        regenerateLabel={isRegenerating ? 'Regenerating…' : 'Regenerate audio'}
        regenerateError={regenerateError}
        staleLabel="Audio will be generated when you add this card."
        title="Preview audio"
      />
      {isPreviewOpen ? (
        <StudyCandidateCardPreviewModal card={previewCard} onClose={onClosePreview} />
      ) : null}
    </article>
  );
};

export default StudyVocabVariantRow;
