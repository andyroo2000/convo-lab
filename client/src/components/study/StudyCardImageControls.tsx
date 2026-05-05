import { STUDY_CANDIDATE_IMAGE_PROMPT_MAX_LENGTH } from '@languageflow/shared/src/studyConstants';
import type { StudyCardImagePlacement } from '@languageflow/shared/src/types';
import { useTranslation } from 'react-i18next';

const StudyCardImageControls = ({
  altText,
  imagePlacement,
  imagePrompt,
  imagePromptId,
  imagePromptLabel,
  isRegenerating,
  isRegenerateDisabled,
  onImagePlacementChange,
  onImagePromptChange,
  onRegenerate,
  previewUrl,
  regenerateError = null,
  regenerateLabel,
  showImagePlacement = true,
  title,
}: {
  altText: string;
  imagePlacement: StudyCardImagePlacement;
  imagePrompt: string;
  imagePromptId: string;
  imagePromptLabel: string;
  isRegenerating: boolean;
  isRegenerateDisabled?: boolean;
  onImagePlacementChange: (value: StudyCardImagePlacement) => void;
  onImagePromptChange: (value: string) => void;
  onRegenerate: () => void;
  previewUrl: string | null;
  regenerateError?: string | null;
  regenerateLabel: string;
  showImagePlacement?: boolean;
  title: string;
}) => {
  const { t } = useTranslation('study');
  const isGenerateDisabled =
    isRegenerating ||
    isRegenerateDisabled ||
    imagePlacement === 'none' ||
    imagePrompt.trim().length === 0;

  return (
    <div className="mb-3 rounded-lg border border-gray-200 bg-white/70 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">{title}</p>
      {previewUrl ? (
        <div
          className={`relative mt-2 inline-block ${isRegenerating ? 'pointer-events-none opacity-70' : ''}`}
          aria-busy={isRegenerating}
        >
          <img src={previewUrl} alt={altText} className="max-h-56 rounded-lg object-contain" />
          {isRegenerating ? (
            <div
              role="status"
              aria-label={regenerateLabel}
              className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/70"
            >
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-navy border-t-transparent" />
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        className={`mt-3 grid gap-3 ${showImagePlacement ? 'md:grid-cols-[minmax(0,1fr)_12rem]' : ''}`}
      >
        <label htmlFor={imagePromptId} className="block text-sm font-semibold text-navy">
          {imagePromptLabel}
          <textarea
            id={imagePromptId}
            value={imagePrompt}
            onChange={(event) => onImagePromptChange(event.target.value)}
            maxLength={STUDY_CANDIDATE_IMAGE_PROMPT_MAX_LENGTH}
            readOnly={isRegenerating}
            aria-busy={isRegenerating}
            className="mt-1 block min-h-20 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm font-normal text-gray-700"
          />
        </label>
        {showImagePlacement ? (
          <label
            htmlFor={`${imagePromptId}-placement`}
            className="block text-sm font-semibold text-navy"
          >
            {t('form.imagePlacement')}
            <select
              id={`${imagePromptId}-placement`}
              value={imagePlacement}
              onChange={(event) =>
                onImagePlacementChange(event.target.value as StudyCardImagePlacement)
              }
              disabled={isRegenerating}
              className="mt-1 block w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm font-normal text-gray-700"
            >
              <option value="none">{t('form.imagePlacementNone')}</option>
              <option value="prompt">{t('form.imagePlacementPrompt')}</option>
              <option value="answer">{t('form.imagePlacementAnswer')}</option>
              <option value="both">{t('form.imagePlacementBoth')}</option>
            </select>
          </label>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onRegenerate}
        disabled={isGenerateDisabled}
        className="mt-2 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {regenerateLabel}
      </button>
      {regenerateError ? <p className="mt-2 text-sm text-red-600">{regenerateError}</p> : null}
    </div>
  );
};

export default StudyCardImageControls;
