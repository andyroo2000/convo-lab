import { STUDY_CANDIDATE_IMAGE_PROMPT_MAX_LENGTH } from '@languageflow/shared/src/studyConstants';

const StudyCandidatePreviewImage = ({
  imagePrompt,
  imagePromptId,
  imagePromptLabel,
  isRegenerating,
  isRegenerateDisabled,
  onImagePromptChange,
  onRegenerate,
  previewUrl,
  regenerateError,
  regenerateLabel,
  title,
}: {
  imagePrompt: string;
  imagePromptId: string;
  imagePromptLabel: string;
  isRegenerating: boolean;
  isRegenerateDisabled?: boolean;
  onImagePromptChange: (value: string) => void;
  onRegenerate: () => void;
  previewUrl: string | null;
  regenerateError: string | null;
  regenerateLabel: string;
  title: string;
}) => (
  <div className="mb-3 rounded-lg border border-gray-200 bg-white/70 p-3">
    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">{title}</p>
    {previewUrl ? (
      <div
        className={`relative mt-2 inline-block ${isRegenerating ? 'pointer-events-none opacity-70' : ''}`}
        aria-busy={isRegenerating}
      >
        <img
          src={previewUrl}
          alt="Generated card prompt"
          className="max-h-56 rounded-lg object-contain"
        />
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
    <label htmlFor={imagePromptId} className="mt-3 block text-sm font-semibold text-navy">
      {imagePromptLabel}
      <textarea
        id={imagePromptId}
        value={imagePrompt}
        onChange={(event) => onImagePromptChange(event.target.value)}
        maxLength={STUDY_CANDIDATE_IMAGE_PROMPT_MAX_LENGTH}
        className="mt-1 block min-h-20 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm font-normal text-gray-700"
      />
    </label>
    <button
      type="button"
      onClick={onRegenerate}
      disabled={isRegenerating || isRegenerateDisabled || imagePrompt.trim().length === 0}
      className="mt-2 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {regenerateLabel}
    </button>
    {regenerateError ? <p className="mt-2 text-sm text-red-600">{regenerateError}</p> : null}
  </div>
);

export default StudyCandidatePreviewImage;
