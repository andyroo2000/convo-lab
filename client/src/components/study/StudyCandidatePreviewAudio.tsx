import StudyAudioPlayer from './StudyAudioPlayer';

const StudyCandidatePreviewAudio = ({
  isRegenerating,
  label,
  onRegenerate,
  previewUrl,
  regenerateLabel,
  regenerateError,
  staleLabel,
  title,
}: {
  isRegenerating: boolean;
  label: string;
  onRegenerate: () => void;
  previewUrl: string | null;
  regenerateLabel: string;
  regenerateError: string | null;
  staleLabel: string;
  title: string;
}) => (
  <div className="mb-3 rounded-lg border border-gray-200 bg-white/70 p-3">
    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">{title}</p>
    {previewUrl ? (
      <div className="mt-2">
        <StudyAudioPlayer url={previewUrl} label={label} size="compact" />
      </div>
    ) : (
      <p className="mt-2 text-sm text-amber-700">{staleLabel}</p>
    )}
    <button
      type="button"
      onClick={onRegenerate}
      disabled={isRegenerating}
      className="mt-2 rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-navy hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {regenerateLabel}
    </button>
    {regenerateError ? <p className="mt-2 text-sm text-red-600">{regenerateError}</p> : null}
  </div>
);

export default StudyCandidatePreviewAudio;
