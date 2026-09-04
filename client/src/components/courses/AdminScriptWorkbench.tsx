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

type WorkbenchState = ReturnType<typeof useAdminScriptWorkbench>;

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

function getStepButtonClass(stepKey: PipelineStage, activeStep: PipelineStage, enabled: boolean) {
  if (activeStep === stepKey) return 'bg-coral text-white';
  if (enabled) return 'bg-gray-100 text-gray-700 hover:bg-gray-200';
  return 'bg-gray-50 text-gray-400 cursor-not-allowed';
}

const promptStepEnabled = (readOnly: boolean, prompt: string) => !readOnly || Boolean(prompt);

const audioStepEnabled = (courseStatus: string) =>
  courseStatus === 'generating' || courseStatus === 'ready';

const StepNavigation = ({
  workbench,
  readOnly,
}: {
  workbench: WorkbenchState;
  readOnly: boolean;
}) => {
  const { activeStep, courseStatus, exchanges, prompt, scriptConfig, scriptUnits, setActiveStep } =
    workbench;
  const steps = [
    { key: 'prompt' as const, label: '1. Prompt', enabled: promptStepEnabled(readOnly, prompt) },
    { key: 'exchanges' as const, label: '2. Dialogue', enabled: !!exchanges },
    { key: 'config' as const, label: '3. Config', enabled: !!scriptConfig },
    { key: 'script' as const, label: '4. Script', enabled: !!scriptUnits },
    {
      key: 'audio' as const,
      label: '5. Audio',
      enabled: audioStepEnabled(courseStatus),
    },
  ];
  return (
    <div className="flex gap-2">
      {steps.map((step) => (
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
  );
};

const WorkbenchStatus = ({ error, loading }: Pick<WorkbenchState, 'error' | 'loading'>) => (
  <>
    {error && (
      <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm font-medium">
        {error}
      </div>
    )}
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
  </>
);

type ScriptConfigState = NonNullable<WorkbenchState['scriptConfig']>;

interface ConfigFieldsProps {
  config: ScriptConfigState;
  updateConfig: (key: string, value: string | number) => void;
}

interface ConfigEntryFieldsProps {
  entries: [string, unknown][];
  formatLabel: (key: string) => string;
  idPrefix: string;
  inputType: 'number' | 'text';
  title: string;
  updateConfig: ConfigFieldsProps['updateConfig'];
}

function configInputValue(inputType: ConfigEntryFieldsProps['inputType'], value: string) {
  return inputType === 'number' ? parseFloat(value) || 0 : value;
}

const ConfigEntryFields = ({
  entries,
  formatLabel,
  idPrefix,
  inputType,
  title,
  updateConfig,
}: ConfigEntryFieldsProps) => (
  <div className="border-2 border-gray-200 rounded-lg p-4">
    <h4 className="font-bold text-gray-800 mb-3">{title}</h4>
    <div className={inputType === 'number' ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-1 gap-3'}>
      {entries.map(([key, value]) => (
        <div key={key}>
          <label
            htmlFor={`${idPrefix}-${key}`}
            className="block text-xs font-medium text-gray-600 mb-1"
          >
            {formatLabel(key)}
          </label>
          <input
            id={`${idPrefix}-${key}`}
            type={inputType}
            step={inputType === 'number' ? '0.1' : undefined}
            value={value as string | number}
            onChange={(event) => updateConfig(key, configInputValue(inputType, event.target.value))}
            className={`w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-coral focus:outline-none text-sm ${inputType === 'text' ? 'font-mono' : ''}`}
          />
        </div>
      ))}
    </div>
  </div>
);

const AiPromptFields = ({ config, updateConfig }: ConfigFieldsProps) => (
  <div className="border-2 border-gray-200 rounded-lg p-4">
    <h4 className="font-bold text-gray-800 mb-3">AI Prompts</h4>
    <div className="space-y-4">
      <div>
        <span className="block text-xs font-medium text-gray-600 mb-1">
          Scenario Introduction Prompt
        </span>
        <textarea
          aria-label="Scenario Introduction Prompt"
          value={config.scenarioIntroPrompt}
          onChange={(event) => updateConfig('scenarioIntroPrompt', event.target.value)}
          className="w-full h-40 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-coral focus:outline-none text-sm font-mono"
        />
      </div>
      <div>
        <span className="block text-xs font-medium text-gray-600 mb-1">
          Progressive Phrase Building Prompt
        </span>
        <textarea
          aria-label="Progressive Phrase Building Prompt"
          value={config.progressivePhrasePrompt}
          onChange={(event) => updateConfig('progressivePhrasePrompt', event.target.value)}
          className="w-full h-40 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-coral focus:outline-none text-sm font-mono"
        />
      </div>
    </div>
  </div>
);

const ScriptConfigurationSection = ({
  workbench,
  readOnly,
}: {
  workbench: WorkbenchState;
  readOnly: boolean;
}) => {
  const {
    activeStep,
    handleBuildScriptConfig,
    handleGenerateScript,
    loading,
    scriptConfig,
    setActiveStep,
    setScriptConfig,
  } = workbench;
  if (activeStep !== 'config' || !scriptConfig) return null;
  const updateConfig = (key: string, value: string | number) =>
    setScriptConfig({ ...scriptConfig, [key]: value });

  return (
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
        <ConfigEntryFields
          entries={Object.entries(scriptConfig).filter(
            ([key]) => key.includes('pause') || key.includes('Seconds')
          )}
          formatLabel={(key) => key.replace(/([A-Z])/g, ' $1').trim()}
          idPrefix="pause"
          inputType="number"
          title="Pause Durations (seconds)"
          updateConfig={updateConfig}
        />
        <AiPromptFields config={scriptConfig} updateConfig={updateConfig} />
        <ConfigEntryFields
          entries={Object.entries(scriptConfig).filter(([key]) => key.includes('Template'))}
          formatLabel={(key) =>
            key
              .replace(/([A-Z])/g, ' $1')
              .replace('Template', '')
              .trim()
          }
          idPrefix="template"
          inputType="text"
          title="Narration Templates (use {translation}, {relationshipName} as placeholders)"
          updateConfig={updateConfig}
        />
      </div>
    </div>
  );
};

const ScriptUnitContent = ({
  unit,
}: {
  unit: NonNullable<WorkbenchState['scriptUnits']>[number];
}) => {
  if (unit.type === 'pause') return <span>{unit.seconds}s</span>;
  if (unit.type === 'marker') return <span>{unit.label}</span>;
  if (unit.type === 'narration_L1') return <span>{unit.text}</span>;
  if (unit.type === 'L2') {
    return (
      <span>
        {unit.text}
        {unit.translation && (
          <span className="text-green-600 ml-2 text-xs">({unit.translation})</span>
        )}
      </span>
    );
  }
  return null;
};

const scriptUnitKey = (unit: NonNullable<WorkbenchState['scriptUnits']>[number], index: number) =>
  unit.type === 'marker' ? `unit-${index}-${unit.label}` : `unit-${index}-${unit.type}`;

const isPlayableScriptUnit = (unit: NonNullable<WorkbenchState['scriptUnits']>[number]) =>
  unit.type === 'narration_L1' || unit.type === 'L2';

const scriptUnitListWidth = (selectedUnitIndex: number | null) =>
  selectedUnitIndex === null ? 'w-full' : 'w-3/5';

const ScriptUnitRow = ({
  unit,
  index,
  workbench,
}: {
  unit: NonNullable<WorkbenchState['scriptUnits']>[number];
  index: number;
  workbench: WorkbenchState;
}) => {
  const { lineRenderings, selectedUnitIndex, setSelectedUnitIndex } = workbench;
  const unitKey = scriptUnitKey(unit, index);
  const isClickable = isPlayableScriptUnit(unit);
  const isSelected = selectedUnitIndex === index;
  const renderingCount = lineRenderings.filter((rendering) => rendering.unitIndex === index).length;
  return (
    <button
      key={unitKey}
      type="button"
      onClick={() => isClickable && setSelectedUnitIndex(isSelected ? null : index)}
      disabled={!isClickable}
      className={`w-full text-left px-3 py-1.5 text-sm rounded-r transition-all ${unitStyles[unit.type] || 'bg-gray-50'} ${isClickable ? 'cursor-pointer hover:ring-2 hover:ring-coral/30' : ''} ${isSelected ? 'ring-2 ring-coral' : ''}`}
    >
      <span className="inline-flex items-center gap-1">
        <span className="inline-block w-12 text-xs font-mono opacity-60">
          {typeLabels[unit.type] || unit.type}
        </span>
        {renderingCount > 0 && (
          <span
            className="inline-flex items-center justify-center w-4 h-4 bg-coral text-white rounded-full text-[10px] font-bold shrink-0"
            title={`${renderingCount} rendering(s)`}
          >
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        )}
      </span>
      <ScriptUnitContent unit={unit} />
    </button>
  );
};

const LineTester = ({ courseId, workbench }: { courseId: string; workbench: WorkbenchState }) => {
  const { lineRenderings, scriptUnits, selectedUnitIndex, setLineRenderings } = workbench;
  if (selectedUnitIndex === null || !scriptUnits?.[selectedUnitIndex]) return null;
  return (
    <div className="w-2/5 border-2 border-gray-200 rounded-lg p-4 max-h-[600px] overflow-y-auto sticky top-0">
      <LineTTSTester
        key={selectedUnitIndex}
        courseId={courseId}
        unit={scriptUnits[selectedUnitIndex]}
        unitIndex={selectedUnitIndex}
        renderings={lineRenderings.filter((rendering) => rendering.unitIndex === selectedUnitIndex)}
        onRenderingCreated={(rendering) =>
          setLineRenderings((previous) => [rendering, ...previous])
        }
        onRenderingDeleted={(renderingId) =>
          setLineRenderings((previous) =>
            previous.filter((rendering) => rendering.id !== renderingId)
          )
        }
      />
    </div>
  );
};

const ScriptPreviewSection = ({
  courseId,
  workbench,
  readOnly,
}: AdminScriptWorkbenchProps & { workbench: WorkbenchState }) => {
  const {
    activeStep,
    estimatedDuration,
    handleGenerateAudio,
    loading,
    scriptUnits,
    selectedUnitIndex,
    setActiveStep,
  } = workbench;
  if (activeStep !== 'script' || !scriptUnits) return null;
  return (
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
        <div
          className={`space-y-1 max-h-[600px] overflow-y-auto ${scriptUnitListWidth(selectedUnitIndex)}`}
        >
          {scriptUnits.map((unit, index) => (
            <ScriptUnitRow
              key={scriptUnitKey(unit, index)}
              unit={unit}
              index={index}
              workbench={workbench}
            />
          ))}
        </div>
        <LineTester courseId={courseId} workbench={workbench} />
      </div>
    </div>
  );
};

const AdminScriptWorkbench = ({ courseId, readOnly = false }: AdminScriptWorkbenchProps) => {
  const workbench = useAdminScriptWorkbench(courseId, readOnly);
  const {
    activeStep,
    audioUrl,
    courseStatus,
    editForm,
    editingExchange,
    exchanges,
    handleBuildPrompt,
    handleBuildScriptConfig,
    handleGenerateAudio,
    handleGenerateDialogue,
    handleSaveExchangeEdit,
    loading,
    openExchangeEditor,
    prompt,
    promptMetadata,
    savingExchange,
    setActiveStep,
    setEditForm,
    setEditingExchange,
    setPrompt,
  } = workbench;

  return (
    <div className="space-y-4 mt-6">
      <StepNavigation workbench={workbench} readOnly={readOnly} />
      <WorkbenchStatus error={workbench.error} loading={loading} />
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
      <ScriptConfigurationSection workbench={workbench} readOnly={readOnly} />
      <ScriptPreviewSection courseId={courseId} workbench={workbench} readOnly={readOnly} />
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
