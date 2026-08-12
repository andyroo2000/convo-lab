import type { PromptMetadata } from './adminScriptWorkbenchTypes';

interface AdminScriptWorkbenchPromptSectionProps {
  loading: boolean;
  metadata: PromptMetadata | null;
  onGenerateDialogue: () => void;
  onPromptChange: (prompt: string) => void;
  onRefreshPrompt: () => void;
  prompt: string;
  readOnly: boolean;
}

const AdminScriptWorkbenchPromptSection = ({
  loading,
  metadata,
  onGenerateDialogue,
  onPromptChange,
  onRefreshPrompt,
  prompt,
  readOnly,
}: AdminScriptWorkbenchPromptSectionProps) => (
  <div className="bg-white border-l-8 border-blue-500 p-6 shadow-sm space-y-4">
    <h3 className="text-lg font-bold text-dark-brown">Dialogue Extraction Prompt</h3>

    {metadata && (
      <div className="flex gap-4 text-sm text-gray-600">
        <span>
          Target exchanges: <strong>{metadata.targetExchangeCount}</strong>
        </span>
        <span>
          Vocab seeds: <strong>{metadata.vocabularySeeds ? 'Yes' : 'None'}</strong>
        </span>
        <span>
          Grammar seeds: <strong>{metadata.grammarSeeds ? 'Yes' : 'None'}</strong>
        </span>
      </div>
    )}

    <textarea
      value={prompt}
      onChange={(event) => !readOnly && onPromptChange(event.target.value)}
      readOnly={readOnly}
      className="w-full h-96 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-coral focus:outline-none text-sm font-mono leading-relaxed"
    />

    {!readOnly && (
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onRefreshPrompt}
          disabled={loading}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-sm rounded-lg transition-all disabled:opacity-50"
        >
          Refresh Seeds
        </button>
        <button
          type="button"
          onClick={onGenerateDialogue}
          disabled={loading || !prompt.trim()}
          className="px-6 py-2 bg-coral hover:bg-coral-dark text-white font-bold text-sm rounded-lg transition-all disabled:opacity-50"
        >
          Generate Dialogue
        </button>
      </div>
    )}
  </div>
);

export default AdminScriptWorkbenchPromptSection;
