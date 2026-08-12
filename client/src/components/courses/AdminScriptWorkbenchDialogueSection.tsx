import type { DialogueExchange, PipelineStage } from './adminScriptWorkbenchTypes';

interface AdminScriptWorkbenchDialogueSectionProps {
  editForm: DialogueExchange | null;
  editingExchange: number | null;
  exchanges: DialogueExchange[];
  loading: boolean;
  onBuildScriptConfig: () => Promise<boolean>;
  onEditFormChange: (exchange: DialogueExchange | null) => void;
  onEditingExchangeChange: (index: number | null) => void;
  onNavigate: (stage: PipelineStage) => void;
  onOpenEditor: (index: number, exchange: DialogueExchange) => void;
  onSaveExchange: () => void;
  readOnly: boolean;
  savingExchange: boolean;
}

const AdminScriptWorkbenchDialogueSection = ({
  editForm,
  editingExchange,
  exchanges,
  loading,
  onBuildScriptConfig,
  onEditFormChange,
  onEditingExchangeChange,
  onNavigate,
  onOpenEditor,
  onSaveExchange,
  readOnly,
  savingExchange,
}: AdminScriptWorkbenchDialogueSectionProps) => (
  <>
    <div className="bg-white border-l-8 border-green-500 p-6 shadow-sm space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-dark-brown">
          Dialogue Exchanges ({exchanges.length})
        </h3>
        {!readOnly && (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onNavigate('prompt')}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-sm rounded-lg transition-all"
            >
              Back to Prompt
            </button>
            <button
              type="button"
              onClick={async () => {
                if (await onBuildScriptConfig()) onNavigate('config');
              }}
              disabled={loading}
              className="px-6 py-2 bg-coral hover:bg-coral-dark text-white font-bold text-sm rounded-lg transition-all disabled:opacity-50"
            >
              Configure Script
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {exchanges.map((exchange) => (
          <button
            key={`exchange-${exchange.order}`}
            type="button"
            className={`w-full text-left border-2 border-gray-100 rounded-lg p-4 transition-all ${readOnly ? '' : 'hover:border-gray-300 cursor-pointer'}`}
            onClick={() => !readOnly && onOpenEditor(exchange.order, exchange)}
            disabled={readOnly || savingExchange}
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 shrink-0">
                {exchange.speakerName}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-medium text-gray-900">{exchange.textL2}</p>
                {exchange.readingL2 && (
                  <p className="text-sm text-gray-500 mt-0.5">{exchange.readingL2}</p>
                )}
                <p className="text-sm text-gray-600 mt-1">{exchange.translationL1}</p>
                {exchange.vocabularyItems.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {exchange.vocabularyItems.map((vocab) => (
                      <span
                        key={`vocab-${exchange.order}-${vocab.textL2}`}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-green-50 text-green-800 border border-green-200"
                      >
                        {vocab.textL2}
                        {vocab.jlptLevel && (
                          <span className="text-green-600 font-bold">{vocab.jlptLevel}</span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-xs text-gray-400 shrink-0">#{exchange.order + 1}</span>
            </div>
          </button>
        ))}
      </div>
    </div>

    {editingExchange !== null && editForm && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
          <h3 className="text-lg font-bold text-dark-brown">
            Edit Exchange #{editingExchange + 1}
          </h3>

          {/* eslint-disable jsx-a11y/label-has-associated-control */}
          <label className="block">
            <span className="block text-sm font-bold text-gray-700 mb-1">Speaker</span>
            <input
              type="text"
              value={editForm.speakerName}
              onChange={(event) =>
                onEditFormChange({ ...editForm, speakerName: event.target.value })
              }
              disabled={savingExchange}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-coral focus:outline-none text-sm disabled:opacity-50"
            />
          </label>

          <label className="block">
            <span className="block text-sm font-bold text-gray-700 mb-1">Text (L2)</span>
            <textarea
              value={editForm.textL2}
              onChange={(event) => onEditFormChange({ ...editForm, textL2: event.target.value })}
              disabled={savingExchange}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-coral focus:outline-none text-sm h-20 disabled:opacity-50"
            />
          </label>

          <label className="block">
            <span className="block text-sm font-bold text-gray-700 mb-1">Reading</span>
            <input
              type="text"
              value={editForm.readingL2 || ''}
              onChange={(event) =>
                onEditFormChange({ ...editForm, readingL2: event.target.value || null })
              }
              disabled={savingExchange}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-coral focus:outline-none text-sm disabled:opacity-50"
            />
          </label>

          <label className="block">
            <span className="block text-sm font-bold text-gray-700 mb-1">Translation</span>
            <textarea
              value={editForm.translationL1}
              onChange={(event) =>
                onEditFormChange({ ...editForm, translationL1: event.target.value })
              }
              disabled={savingExchange}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-coral focus:outline-none text-sm h-16 disabled:opacity-50"
            />
          </label>
          {/* eslint-enable jsx-a11y/label-has-associated-control */}

          <div>
            <span className="block text-sm font-bold text-gray-700 mb-2">Vocabulary Items</span>
            {editForm.vocabularyItems.map((vocab, vocabularyIndex) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={`edit-vocab-${vocabularyIndex}`} className="flex gap-2 mb-2 items-center">
                <input
                  type="text"
                  value={vocab.textL2}
                  disabled={savingExchange}
                  onChange={(event) => {
                    const items = [...editForm.vocabularyItems];
                    items[vocabularyIndex] = {
                      ...items[vocabularyIndex],
                      textL2: event.target.value,
                    };
                    onEditFormChange({ ...editForm, vocabularyItems: items });
                  }}
                  className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm disabled:opacity-50"
                  placeholder="Word"
                />
                <input
                  type="text"
                  value={vocab.translationL1}
                  disabled={savingExchange}
                  onChange={(event) => {
                    const items = [...editForm.vocabularyItems];
                    items[vocabularyIndex] = {
                      ...items[vocabularyIndex],
                      translationL1: event.target.value,
                    };
                    onEditFormChange({ ...editForm, vocabularyItems: items });
                  }}
                  className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm disabled:opacity-50"
                  placeholder="Translation"
                />
                <button
                  type="button"
                  disabled={savingExchange}
                  onClick={() => {
                    const items = editForm.vocabularyItems.filter(
                      (_, index) => index !== vocabularyIndex
                    );
                    onEditFormChange({ ...editForm, vocabularyItems: items });
                  }}
                  className="text-red-500 hover:text-red-700 text-sm font-bold px-1 disabled:opacity-50"
                >
                  X
                </button>
              </div>
            ))}
            <button
              type="button"
              disabled={savingExchange}
              onClick={() =>
                onEditFormChange({
                  ...editForm,
                  vocabularyItems: [...editForm.vocabularyItems, { textL2: '', translationL1: '' }],
                })
              }
              className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
            >
              + Add vocabulary item
            </button>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                onEditingExchangeChange(null);
                onEditFormChange(null);
              }}
              disabled={savingExchange}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-sm rounded-lg disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSaveExchange}
              disabled={savingExchange}
              className="px-4 py-2 bg-coral hover:bg-coral-dark text-white font-bold text-sm rounded-lg disabled:opacity-50"
            >
              {savingExchange ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    )}
  </>
);

export default AdminScriptWorkbenchDialogueSection;
