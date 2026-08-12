interface AdminScriptWorkbenchAudioSectionProps {
  audioUrl: string | null;
  courseStatus: string;
  onGenerateAudio: () => void;
  onNavigate: (step: 'config' | 'script') => void;
}

const AdminScriptWorkbenchAudioSection = ({
  audioUrl,
  courseStatus,
  onGenerateAudio,
  onNavigate,
}: AdminScriptWorkbenchAudioSectionProps) => (
  <div className="bg-white border-l-8 border-purple-500 p-6 shadow-sm space-y-4">
    <h3 className="text-lg font-bold text-dark-brown">Audio Generation</h3>

    {courseStatus === 'generating' && (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <svg className="animate-spin h-5 w-5 text-purple-600" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <span className="text-gray-700 font-medium">
            Generating audio... This takes 2-10 minutes.
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-purple-600 h-2 rounded-full transition-all duration-500 animate-pulse"
            style={{ width: '60%' }}
          />
        </div>
      </div>
    )}

    {courseStatus === 'ready' && audioUrl && (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-green-700">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-bold">Audio generation complete!</span>
        </div>
        <audio controls src={audioUrl} className="w-full" />
      </div>
    )}

    {courseStatus === 'error' && (
      <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm">
        Audio generation failed. You can try again.
        <button
          type="button"
          onClick={onGenerateAudio}
          className="ml-3 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 font-bold text-xs rounded"
        >
          Retry
        </button>
      </div>
    )}

    <div className="flex gap-3">
      <button
        type="button"
        onClick={() => onNavigate('config')}
        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-sm rounded-lg transition-all"
      >
        Back to Config
      </button>
      <button
        type="button"
        onClick={() => onNavigate('script')}
        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-sm rounded-lg transition-all"
      >
        Back to Script
      </button>
    </div>
  </div>
);

export default AdminScriptWorkbenchAudioSection;
