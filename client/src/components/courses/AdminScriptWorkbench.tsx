import useAdminScriptWorkbench from '../../hooks/useAdminScriptWorkbench';
import AdminScriptWorkbenchAudioSection from './AdminScriptWorkbenchAudioSection';
import AdminScriptWorkbenchDialogueSection from './AdminScriptWorkbenchDialogueSection';
import AdminScriptWorkbenchPromptSection from './AdminScriptWorkbenchPromptSection';
import LineTTSTester from './LineTTSTester';
import type { PipelineStage } from './adminScriptWorkbenchTypes';

interface AdminScriptWorkbenchProps {
  courseId: string;
  readOnly?: boolean;
}

function getStepButtonClass(stepKey: PipelineStage, activeStep: PipelineStage, enabled: boolean) {
  if (activeStep === stepKey) return 'bg-coral text-white';
  if (enabled) return 'bg-gray-100 text-gray-700 hover:bg-gray-200';
  return 'bg-gray-50 text-gray-400 cursor-not-allowed';
}

const AdminScriptWorkbench = ({ courseId, readOnly = false }: AdminScriptWorkbenchProps) => {
  const {
    activeStep,
    audioUrl,
    courseStatus,
    editForm,
    editingExchange,
    error,
    estimatedDuration,
    exchanges,
    handleBuildPrompt,
    handleBuildScriptConfig,
    handleGenerateAudio,
    handleGenerateDialogue,
    handleGenerateScript,
    handleSaveExchangeEdit,
    lineRenderings,
    loading,
    openExchangeEditor,
    prompt,
    promptMetadata,
    scriptConfig,
    scriptUnits,
    savingExchange,
    selectedUnitIndex,
    setActiveStep,
    setEditForm,
    setEditingExchange,
    setLineRenderings,
    setPrompt,
    setScriptConfig,
    setSelectedUnitIndex,
  } = useAdminScriptWorkbench(courseId, readOnly);

  const stepConfig = [
    { key: 'prompt' as const, label: '1. Prompt', enabled: readOnly ? !!prompt : true },
    { key: 'exchanges' as const, label: '2. Dialogue', enabled: !!exchanges },
    { key: 'config' as const, label: '3. Config', enabled: !!scriptConfig },
    { key: 'script' as const, label: '4. Script', enabled: !!scriptUnits },
    {
      key: 'audio' as const,
      label: '5. Audio',
      enabled: courseStatus === 'generating' || courseStatus === 'ready',
    },
  ];

  return (
    <div className="space-y-4 mt-6">
      {/* Step Navigation */}
      <div className="flex gap-2">
        {stepConfig.map((step) => (
          <button
            key={step.key}
            type="button"
            onClick={() => step.enabled && setActiveStep(step.key)}
            disabled={!step.enabled}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${getStepButtonClass(step.key, activeStep, step.enabled)}`}
          >
            {step.label}
          </button>
        ))}
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm font-medium">
          {error}
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="p-4 bg-blue-50 border-l-4 border-blue-500 text-blue-700 text-sm font-medium flex items-center gap-3">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
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
          {loading}
        </div>
      )}

      {/* Step 1: Prompt Preview */}
      {activeStep === 'prompt' && (
        <AdminScriptWorkbenchPromptSection
          loading={!!loading}
          metadata={promptMetadata}
          onGenerateDialogue={handleGenerateDialogue}
          onPromptChange={setPrompt}
          onRefreshPrompt={() => handleBuildPrompt()}
          prompt={prompt}
          readOnly={readOnly}
        />
      )}

      {/* Step 2: Dialogue Exchanges */}
      {activeStep === 'exchanges' && exchanges && (
        <AdminScriptWorkbenchDialogueSection
          editForm={editForm}
          editingExchange={editingExchange}
          exchanges={exchanges}
          loading={!!loading}
          onBuildScriptConfig={() => handleBuildScriptConfig()}
          onEditFormChange={setEditForm}
          onEditingExchangeChange={setEditingExchange}
          onNavigate={setActiveStep}
          onOpenEditor={openExchangeEditor}
          onSaveExchange={handleSaveExchangeEdit}
          readOnly={readOnly}
          savingExchange={savingExchange}
        />
      )}

      {/* Step 3: Script Configuration */}
      {activeStep === 'config' && scriptConfig && (
        <div className="bg-white border-l-8 border-yellow-500 p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-dark-brown">Script Generation Configuration</h3>
            {!readOnly && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setActiveStep('exchanges')}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-sm rounded-lg transition-all"
                >
                  Back to Dialogue
                </button>
                <button
                  type="button"
                  onClick={() => handleBuildScriptConfig()}
                  disabled={!!loading}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-sm rounded-lg transition-all disabled:opacity-50"
                >
                  Reset to Defaults
                </button>
                <button
                  type="button"
                  onClick={handleGenerateScript}
                  disabled={!!loading}
                  className="px-6 py-2 bg-coral hover:bg-coral-dark text-white font-bold text-sm rounded-lg transition-all disabled:opacity-50"
                >
                  Generate Script
                </button>
              </div>
            )}
          </div>

          <div className="space-y-6 max-h-[600px] overflow-y-auto">
            {/* Timing Configuration */}
            <div className="border-2 border-gray-200 rounded-lg p-4">
              <h4 className="font-bold text-gray-800 mb-3">Pause Durations (seconds)</h4>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(scriptConfig)
                  .filter(([key]) => key.includes('pause') || key.includes('Seconds'))
                  .map(([key, value]) => (
                    <div key={key}>
                      <label
                        htmlFor={`pause-${key}`}
                        className="block text-xs font-medium text-gray-600 mb-1"
                      >
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </label>
                      <input
                        id={`pause-${key}`}
                        type="number"
                        step="0.1"
                        value={value as number}
                        onChange={(e) =>
                          setScriptConfig({
                            ...scriptConfig,
                            [key]: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-coral focus:outline-none text-sm"
                      />
                    </div>
                  ))}
              </div>
            </div>

            {/* AI Prompts */}
            <div className="border-2 border-gray-200 rounded-lg p-4">
              <h4 className="font-bold text-gray-800 mb-3">AI Prompts</h4>
              <div className="space-y-4">
                <div>
                  <span className="block text-xs font-medium text-gray-600 mb-1">
                    Scenario Introduction Prompt
                  </span>
                  <textarea
                    aria-label="Scenario Introduction Prompt"
                    value={scriptConfig.scenarioIntroPrompt}
                    onChange={(e) =>
                      setScriptConfig({ ...scriptConfig, scenarioIntroPrompt: e.target.value })
                    }
                    className="w-full h-40 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-coral focus:outline-none text-sm font-mono"
                  />
                </div>
                <div>
                  <span className="block text-xs font-medium text-gray-600 mb-1">
                    Progressive Phrase Building Prompt
                  </span>
                  <textarea
                    aria-label="Progressive Phrase Building Prompt"
                    value={scriptConfig.progressivePhrasePrompt}
                    onChange={(e) =>
                      setScriptConfig({ ...scriptConfig, progressivePhrasePrompt: e.target.value })
                    }
                    className="w-full h-40 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-coral focus:outline-none text-sm font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Narration Templates */}
            <div className="border-2 border-gray-200 rounded-lg p-4">
              <h4 className="font-bold text-gray-800 mb-3">
                Narration Templates (use {'{'}translation{'}'}, {'{'}relationshipName{'}'} as
                placeholders)
              </h4>
              <div className="grid grid-cols-1 gap-3">
                {Object.entries(scriptConfig)
                  .filter(([key]) => key.includes('Template'))
                  .map(([key, value]) => (
                    <div key={key}>
                      <label
                        htmlFor={`template-${key}`}
                        className="block text-xs font-medium text-gray-600 mb-1"
                      >
                        {key
                          .replace(/([A-Z])/g, ' $1')
                          .replace('Template', '')
                          .trim()}
                      </label>
                      <input
                        id={`template-${key}`}
                        type="text"
                        value={value as string}
                        onChange={(e) =>
                          setScriptConfig({ ...scriptConfig, [key]: e.target.value })
                        }
                        className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-coral focus:outline-none text-sm font-mono"
                      />
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Script Preview with Line TTS Tester */}
      {activeStep === 'script' && scriptUnits && (
        <div className="bg-white border-l-8 border-yellow-500 p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-dark-brown">
              Script Preview ({scriptUnits.length} units
              {estimatedDuration ? `, ~${Math.round(estimatedDuration / 60)}min` : ''})
            </h3>
            {!readOnly && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setActiveStep('config')}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-sm rounded-lg transition-all"
                >
                  Back to Config
                </button>
                <button
                  type="button"
                  onClick={handleGenerateAudio}
                  disabled={!!loading}
                  className="px-6 py-2 bg-coral hover:bg-coral-dark text-white font-bold text-sm rounded-lg transition-all disabled:opacity-50"
                >
                  Generate Audio
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-4">
            {/* Script Lines - Left Column */}
            <div
              className={`space-y-1 max-h-[600px] overflow-y-auto ${selectedUnitIndex !== null ? 'w-3/5' : 'w-full'}`}
            >
              {scriptUnits.map((unit, idx) => {
                const unitStyles: Record<string, string> = {
                  narration_L1: 'bg-blue-50 border-l-4 border-blue-400 text-blue-900',
                  L2: 'bg-green-50 border-l-4 border-green-400 text-green-900',
                  pause: 'bg-gray-50 border-l-4 border-gray-300 text-gray-500',
                  marker: 'bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 font-bold',
                };

                const typeLabels: Record<string, string> = {
                  narration_L1: 'NAR',
                  L2: 'L2',
                  pause: 'PAUSE',
                  marker: 'MARK',
                };

                const unitKey =
                  unit.type === 'marker' ? `unit-${idx}-${unit.label}` : `unit-${idx}-${unit.type}`;

                const isClickable = unit.type === 'narration_L1' || unit.type === 'L2';
                const isSelected = selectedUnitIndex === idx;
                const unitRenderingCount = lineRenderings.filter((r) => r.unitIndex === idx).length;

                return (
                  <button
                    key={unitKey}
                    type="button"
                    onClick={() => isClickable && setSelectedUnitIndex(isSelected ? null : idx)}
                    disabled={!isClickable}
                    className={`w-full text-left px-3 py-1.5 text-sm rounded-r transition-all ${unitStyles[unit.type] || 'bg-gray-50'} ${
                      isClickable ? 'cursor-pointer hover:ring-2 hover:ring-coral/30' : ''
                    } ${isSelected ? 'ring-2 ring-coral' : ''}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-block w-12 text-xs font-mono opacity-60">
                        {typeLabels[unit.type] || unit.type}
                      </span>
                      {unitRenderingCount > 0 && (
                        <span
                          className="inline-flex items-center justify-center w-4 h-4 bg-coral text-white rounded-full text-[10px] font-bold shrink-0"
                          title={`${unitRenderingCount} rendering(s)`}
                        >
                          <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </span>
                      )}
                    </span>
                    {unit.type === 'pause' && <span>{unit.seconds}s</span>}
                    {unit.type === 'marker' && <span>{unit.label}</span>}
                    {unit.type === 'narration_L1' && <span>{unit.text}</span>}
                    {unit.type === 'L2' && (
                      <span>
                        {unit.text}
                        {unit.translation && (
                          <span className="text-green-600 ml-2 text-xs">({unit.translation})</span>
                        )}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Line TTS Tester - Right Column */}
            {selectedUnitIndex !== null && scriptUnits[selectedUnitIndex] && (
              <div className="w-2/5 border-2 border-gray-200 rounded-lg p-4 max-h-[600px] overflow-y-auto sticky top-0">
                <LineTTSTester
                  key={selectedUnitIndex}
                  courseId={courseId}
                  unit={scriptUnits[selectedUnitIndex]}
                  unitIndex={selectedUnitIndex}
                  renderings={lineRenderings.filter((r) => r.unitIndex === selectedUnitIndex)}
                  onRenderingCreated={(rendering) => {
                    setLineRenderings((prev) => [rendering, ...prev]);
                  }}
                  onRenderingDeleted={(renderingId) => {
                    setLineRenderings((prev) => prev.filter((r) => r.id !== renderingId));
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 4: Audio Generation */}
      {activeStep === 'audio' && (
        <AdminScriptWorkbenchAudioSection
          audioUrl={audioUrl}
          courseStatus={courseStatus}
          onGenerateAudio={handleGenerateAudio}
          onNavigate={setActiveStep}
        />
      )}
    </div>
  );
};

export default AdminScriptWorkbench;
