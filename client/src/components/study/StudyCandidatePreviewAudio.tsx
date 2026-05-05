import StudyAudioPlayer from './StudyAudioPlayer';

const StudyCandidatePreviewAudio = ({
  isRegenerating,
  isRegenerateDisabled,
  label,
  onRegenerate,
  previewUrl,
  regenerateLabel,
  regenerateError,
  staleLabel,
  title,
}: {
  isRegenerating: boolean;
  isRegenerateDisabled?: boolean;
  label: string;
  onRegenerate: () => void;
  previewUrl: string | null;
  regenerateLabel: string;
  regenerateError: string | null;
  staleLabel: string;
  title: string;
}) => {
  let previewContent: JSX.Element;
  if (previewUrl) {
    previewContent = (
      <div
        className={`relative mt-2 ${isRegenerating ? 'pointer-events-none opacity-70' : ''}`}
        aria-busy={isRegenerating}
      >
        <StudyAudioPlayer url={previewUrl} label={label} size="compact" />
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
    );
  } else if (isRegenerating) {
    previewContent = (
      <div
        role="status"
        aria-label={regenerateLabel}
        className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-navy"
      >
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-navy border-t-transparent" />
        <span>{regenerateLabel}</span>
      </div>
    );
  } else {
    previewContent = <p className="mt-2 text-sm text-amber-700">{staleLabel}</p>;
  }

  const shouldShowRegenerateButton = previewUrl || !isRegenerating;

  return (
    <div className="mb-3 rounded-lg border border-gray-200 bg-white/70 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">{title}</p>
      {previewContent}
      {shouldShowRegenerateButton ? (
        <button
          type="button"
          onClick={onRegenerate}
          disabled={isRegenerating || isRegenerateDisabled}
          className="mt-2 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {regenerateLabel}
        </button>
      ) : null}
      {regenerateError ? <p className="mt-2 text-sm text-red-600">{regenerateError}</p> : null}
    </div>
  );
};

export default StudyCandidatePreviewAudio;
