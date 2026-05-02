import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import StudyCardAudioSettingsFields from './StudyCardAudioSettingsFields';
import StudyCardFormFields from './StudyCardFormFields';
import StudyCandidatePreviewAudio from './StudyCandidatePreviewAudio';
import StudyCandidatePreviewImage from './StudyCandidatePreviewImage';
import StudyCandidateCardPreviewModal from './StudyCandidatePreview';
import { toAssetUrl } from './studyCardUtils';
import type { StudyCardFormValues } from './studyCardFormModel';
import {
  buildStudyCandidateCommitItem,
  buildStudyCandidatePreviewCard,
  hasVisualProductionPreview,
  type StudyCandidateDraft,
} from './studyCandidateModel';

interface StudyCandidateDraftListProps {
  candidateDrafts: StudyCandidateDraft[];
  commitError: unknown;
  isCommitPending: boolean;
  learnerContextSummary: string | null;
  onCommitCandidates: () => void;
  onRegenerateCandidateAudio: (index: number) => void;
  onRegenerateCandidateImage: (index: number) => void;
  onUpdateCandidateImagePrompt: (index: number, value: string) => void;
  onToggleCandidate: (index: number) => void;
  onUpdateCandidateField: <K extends keyof StudyCardFormValues>(
    index: number,
    field: K,
    value: StudyCardFormValues[K]
  ) => void;
  previewDraftIndex: number | null;
  regenerateErrorByCandidateId: Record<string, string>;
  regenerateImageErrorByCandidateId: Record<string, string>;
  regeneratingCandidateId: string | null;
  regeneratingImageCandidateId: string | null;
  selectedCount: number;
  setPreviewDraftIndex: (index: number | null) => void;
  success: string | null;
}

const StudyCandidateDraftList = ({
  candidateDrafts,
  commitError,
  isCommitPending,
  learnerContextSummary,
  onCommitCandidates,
  onRegenerateCandidateAudio,
  onRegenerateCandidateImage,
  onUpdateCandidateImagePrompt,
  onToggleCandidate,
  onUpdateCandidateField,
  previewDraftIndex,
  regenerateErrorByCandidateId,
  regenerateImageErrorByCandidateId,
  regeneratingCandidateId,
  regeneratingImageCandidateId,
  selectedCount,
  setPreviewDraftIndex,
  success,
}: StudyCandidateDraftListProps) => {
  const { t } = useTranslation('study');
  const isAnyCandidateRegenerating =
    regeneratingCandidateId !== null || regeneratingImageCandidateId !== null;

  return (
    <section className="space-y-4">
      <div className="card retro-paper-panel max-w-4xl">
        <h2 className="text-2xl font-bold text-navy">{t('create.candidates')}</h2>
        {learnerContextSummary ? (
          <details className="mt-3 rounded-xl border border-gray-200 bg-white/70 p-3 text-sm text-gray-600">
            <summary className="cursor-pointer font-semibold text-navy">
              {t('create.learnerContextUsed')}
            </summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-3 font-sans text-xs leading-5 text-gray-600">
              {learnerContextSummary}
            </pre>
          </details>
        ) : null}
      </div>

      {candidateDrafts.map((draft, index) => {
        const previewUrl = toAssetUrl(draft.previewAudio?.url);
        const previewImageUrl = toAssetUrl(draft.previewImage?.url);
        const shouldShowImagePreview = hasVisualProductionPreview(draft);
        const candidateSelectId = `candidate-${index}-selected`;
        const commitItem = buildStudyCandidateCommitItem(draft);
        const previewCard = buildStudyCandidatePreviewCard(draft, commitItem);
        const isRegenerating = regeneratingCandidateId === draft.candidate.clientId;
        const isImageRegenerating = regeneratingImageCandidateId === draft.candidate.clientId;
        const previewTitle =
          draft.candidate.candidateKind === 'audio-recognition'
            ? t('create.audioRecognitionPrompt')
            : t('create.answerPreview');

        return (
          <article key={draft.candidate.clientId} className="card retro-paper-panel max-w-4xl">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                  {t(`create.kinds.${draft.candidate.candidateKind}`)}
                </p>
                <p className="mt-1 text-sm text-gray-600">{draft.candidate.rationale}</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPreviewDraftIndex(index)}
                  className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-navy hover:bg-gray-50"
                >
                  {t('create.previewCard')}
                </button>
                <div className="flex items-center gap-2">
                  <input
                    id={candidateSelectId}
                    type="checkbox"
                    checked={draft.selected}
                    onChange={() => onToggleCandidate(index)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <label htmlFor={candidateSelectId} className="text-sm font-semibold text-navy">
                    {t('create.addCandidate')}
                  </label>
                </div>
              </div>
            </div>

            {draft.candidate.warnings?.length ? (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {draft.candidate.warnings.join(' ')}
              </div>
            ) : null}

            <StudyCandidatePreviewAudio
              isRegenerateDisabled={isAnyCandidateRegenerating && !isRegenerating}
              isRegenerating={isRegenerating}
              label={t('create.playPreview')}
              onRegenerate={() => onRegenerateCandidateAudio(index)}
              previewUrl={previewUrl}
              regenerateError={regenerateErrorByCandidateId[draft.candidate.clientId] ?? null}
              regenerateLabel={
                isRegenerating ? t('create.regeneratingPreview') : t('create.regeneratePreview')
              }
              staleLabel={t('create.previewStale')}
              title={previewTitle}
            />

            {shouldShowImagePreview ? (
              <StudyCandidatePreviewImage
                imagePrompt={draft.imagePrompt}
                imagePromptId={`candidate-${index}-image-prompt`}
                imagePromptLabel={t('create.imagePrompt')}
                isRegenerateDisabled={isAnyCandidateRegenerating && !isImageRegenerating}
                isRegenerating={isImageRegenerating}
                onImagePromptChange={(value) => onUpdateCandidateImagePrompt(index, value)}
                onRegenerate={() => onRegenerateCandidateImage(index)}
                previewUrl={previewImageUrl}
                regenerateError={
                  regenerateImageErrorByCandidateId[draft.candidate.clientId] ?? null
                }
                regenerateLabel={
                  isImageRegenerating ? t('create.regeneratingImage') : t('create.regenerateImage')
                }
                title={t('create.imagePreview')}
              />
            ) : null}

            <StudyCardAudioSettingsFields
              values={draft.values}
              idPrefix={`candidate-${index}`}
              onFieldChange={(field, value) => onUpdateCandidateField(index, field, value)}
            />

            <StudyCardFormFields
              values={draft.values}
              idPrefix={`candidate-${index}`}
              hidePromptFields={draft.candidate.candidateKind === 'audio-recognition'}
              includeAudioSettings={false}
              includeSentenceFields
              onFieldChange={(field, value) => onUpdateCandidateField(index, field, value)}
            />

            {previewDraftIndex === index ? (
              <StudyCandidateCardPreviewModal
                card={previewCard}
                onClose={() => setPreviewDraftIndex(null)}
              />
            ) : null}
          </article>
        );
      })}

      <section className="card retro-paper-panel max-w-4xl">
        {commitError ? (
          <p className="mb-3 text-sm text-red-600">
            {commitError instanceof Error ? commitError.message : t('create.commitFailed')}
          </p>
        ) : null}
        {success ? <p className="mb-3 text-sm text-emerald-700">{success}</p> : null}
        {isCommitPending ? (
          <p className="mb-3 text-sm text-gray-600" role="status">
            {t('create.commitProgress', { count: selectedCount })}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onCommitCandidates}
            disabled={selectedCount === 0 || isCommitPending}
            className="rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isCommitPending
              ? t('create.addingSelected')
              : t('create.addSelected', { count: selectedCount })}
          </button>
          <Link
            to="/app/study"
            className="rounded-full border border-gray-300 px-5 py-3 text-sm font-semibold text-navy hover:bg-gray-50"
          >
            {t('create.back')}
          </Link>
        </div>
      </section>
    </section>
  );
};

export default StudyCandidateDraftList;
