import { useState, useEffect, useCallback } from 'react';
import LineTTSTester from './LineTTSTester';

interface DialogueExchange {
  order: number;
  speakerName: string;
  relationshipName: string;
  speakerVoiceId: string;
  textL2: string;
  readingL2: string | null;
  translationL1: string;
  vocabularyItems: VocabularyItem[];
}

interface VocabularyItem {
  textL2: string;
  readingL2?: string;
  translationL1: string;
  jlptLevel?: string;
}

interface ScriptUnit {
  type: 'narration_L1' | 'L2' | 'pause' | 'marker';
  text?: string;
  reading?: string;
  translation?: string;
  voiceId?: string;
  speed?: number;
  pitch?: number;
  seconds?: number;
  label?: string;
}

interface PromptMetadata {
  targetExchangeCount: number;
  vocabularySeeds: string;
  grammarSeeds: string;
}

interface ScriptConfig {
  // Timing constants
  reviewAnticipationSeconds: number;
  reviewRepeatPauseSeconds: number;
  reviewSlowSpeed: number;
  pauseAfterScenarioIntro: number;
  pauseAfterSpeakerIntro: number;
  pauseAfterL2Playback: number;
  pauseAfterTranslation: number;
  pauseAfterVocabItem: number;
  pauseAfterFullPhrase: number;
  pauseForLearnerResponse: number;
  pauseBetweenRepetitions: number;

  // AI Prompts
  scenarioIntroPrompt: string;
  progressivePhrasePrompt: string;

  // Narration templates
  speakerSaysTemplate: string;
  translationTemplate: string;
  vocabIntroTemplate: string;
  responseIntroTemplate: string;
  vocabTeachTemplate: string;
  progressiveChunkTemplate: string;
  fullPhraseTemplate: string;
  fullPhraseReplayTemplate: string;
  noVocabTeachTemplate: string;
  reviewIntroTemplate: string;
  reviewQuestionTemplate: string;
  outroTemplate: string;
}

interface LineRendering {
  id: string;
  unitIndex: number;
  text: string;
  speed: number;
  voiceId: string;
  audioUrl: string;
  createdAt: string;
}

interface AdminScriptWorkbenchProps {
  courseId: string;
  readOnly?: boolean;
}

type PipelineStage = 'prompt' | 'exchanges' | 'config' | 'script' | 'audio';

function getStepButtonClass(stepKey: PipelineStage, activeStep: PipelineStage, enabled: boolean) {
  if (activeStep === stepKey) return 'bg-coral text-white';
  if (enabled) return 'bg-gray-100 text-gray-700 hover:bg-gray-200';
  return 'bg-gray-50 text-gray-400 cursor-not-allowed';
}

const AdminScriptWorkbench = ({ courseId, readOnly = false }: AdminScriptWorkbenchProps) => {
  const [activeStep, setActiveStep] = useState<PipelineStage>('prompt');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Prompt
  const [prompt, setPrompt] = useState('');
  const [promptMetadata, setPromptMetadata] = useState<PromptMetadata | null>(null);

  // Step 2: Exchanges
  const [exchanges, setExchanges] = useState<DialogueExchange[] | null>(null);
  const [editingExchange, setEditingExchange] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<DialogueExchange | null>(null);

  // Step 2.5: Script Config
  const [scriptConfig, setScriptConfig] = useState<ScriptConfig | null>(null);

  // Step 3: Script
  const [scriptUnits, setScriptUnits] = useState<ScriptUnit[] | null>(null);
  const [estimatedDuration, setEstimatedDuration] = useState<number | null>(null);

  // Line TTS Tester
  const [selectedUnitIndex, setSelectedUnitIndex] = useState<number | null>(null);
  const [lineRenderings, setLineRenderings] = useState<LineRendering[]>([]);

  // Step 4: Audio
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [courseStatus, setCourseStatus] = useState<string>('draft');
  const [audioPolling, setAudioPolling] = useState(false);

  const handleBuildPrompt = useCallback(
    async (silent = false) => {
      if (!silent) setLoading('Building prompt...');
      setError(null);

      try {
        const res = await fetch(`/api/admin/courses/${courseId}/build-prompt`, {
          method: 'POST',
          credentials: 'include',
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'Failed to build prompt');
        }

        const data = await res.json();
        setPrompt(data.prompt);
        setPromptMetadata(data.metadata);
      } catch (err) {
        if (!silent) setError(err instanceof Error ? err.message : 'Failed to build prompt');
      } finally {
        if (!silent) setLoading(null);
      }
    },
    [courseId]
  );

  // Load existing pipeline data on mount
  useEffect(() => {
    const loadPipelineData = async () => {
      try {
        const res = await fetch(`/api/admin/courses/${courseId}/pipeline-data`, {
          credentials: 'include',
        });
        if (!res.ok) return;

        const data = await res.json();
        setCourseStatus(data.status);
        setAudioUrl(data.audioUrl);

        if (data.stage === 'script' && data.scriptUnits) {
          setScriptUnits(data.scriptUnits);
          setExchanges(data.exchanges);
          setEstimatedDuration(data.approxDurationSeconds);
          if (data.scriptConfig) {
            setScriptConfig(data.scriptConfig);
          }
          setActiveStep(data.audioUrl ? 'audio' : 'script');
        } else if (data.stage === 'exchanges' && data.exchanges) {
          setExchanges(data.exchanges);
          setActiveStep('exchanges');
        }

        // Load the prompt (skip in readOnly mode since it's a POST action)
        if (!readOnly) {
          await handleBuildPrompt(true);
        }

        // Load line renderings
        try {
          const renderingsRes = await fetch(`/api/admin/courses/${courseId}/line-renderings`, {
            credentials: 'include',
          });
          if (renderingsRes.ok) {
            const renderingsData = await renderingsRes.json();
            setLineRenderings(renderingsData.renderings || []);
          }
        } catch {
          // Ignore - renderings are optional
        }
      } catch {
        // Ignore load errors - start fresh
      }
    };
    loadPipelineData();
  }, [courseId, handleBuildPrompt, readOnly]);

  // Poll for audio completion
  useEffect(() => {
    if (!audioPolling) return undefined;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/courses/${courseId}/status`, {
          credentials: 'include',
        });
        if (!res.ok) return;

        const data = await res.json();
        setCourseStatus(data.status);

        if (data.status === 'ready' && data.audioUrl) {
          setAudioUrl(data.audioUrl);
          setAudioPolling(false);
        } else if (data.status === 'error') {
          setError('Audio generation failed');
          setAudioPolling(false);
        }
      } catch {
        // Ignore polling errors
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [audioPolling, courseId]);

  const handleGenerateDialogue = async () => {
    setLoading('Generating dialogue (this may take 30-60s)...');
    setError(null);

    try {
      const res = await fetch(`/api/admin/courses/${courseId}/generate-dialogue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ customPrompt: prompt }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to generate dialogue');
      }

      const data = await res.json();
      setExchanges(data.exchanges);
      setScriptUnits(null);
      setAudioUrl(null);
      setActiveStep('exchanges');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate dialogue');
    } finally {
      setLoading(null);
    }
  };

  const handleBuildScriptConfig = useCallback(
    async (silent = false) => {
      if (!silent) setLoading('Building script configuration...');
      setError(null);

      try {
        const res = await fetch(`/api/admin/courses/${courseId}/build-script-config`, {
          method: 'POST',
          credentials: 'include',
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'Failed to build script config');
        }

        const data = await res.json();
        setScriptConfig(data.config);
      } catch (err) {
        if (!silent) setError(err instanceof Error ? err.message : 'Failed to build script config');
      } finally {
        if (!silent) setLoading(null);
      }
    },
    [courseId]
  );

  const handleGenerateScript = async () => {
    setLoading('Generating script (this may take 30-60s)...');
    setError(null);

    try {
      const res = await fetch(`/api/admin/courses/${courseId}/generate-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to generate script');
      }

      const data = await res.json();
      setScriptUnits(data.scriptUnits);
      setEstimatedDuration(data.estimatedDurationSeconds);
      setAudioUrl(null);
      setActiveStep('script');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate script');
    } finally {
      setLoading(null);
    }
  };

  const handleGenerateAudio = async () => {
    setLoading('Queuing audio generation...');
    setError(null);

    try {
      const res = await fetch(`/api/admin/courses/${courseId}/generate-audio`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to start audio generation');
      }

      setCourseStatus('generating');
      setAudioPolling(true);
      setActiveStep('audio');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start audio generation');
    } finally {
      setLoading(null);
    }
  };

  const handleSaveExchangeEdit = async () => {
    if (editingExchange === null || !editForm || !exchanges) return;

    const updatedExchanges = [...exchanges];
    updatedExchanges[editingExchange] = editForm;
    setExchanges(updatedExchanges);
    setEditingExchange(null);
    setEditForm(null);

    // Persist to server
    try {
      await fetch(`/api/admin/courses/${courseId}/pipeline-data`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ stage: 'exchanges', data: updatedExchanges }),
      });
    } catch {
      setError('Failed to save exchange edit');
    }
  };

  const openExchangeEditor = (idx: number, exchange: DialogueExchange) => {
    setEditingExchange(idx);
    setEditForm({ ...exchange, vocabularyItems: [...exchange.vocabularyItems] });
  };

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
        <div className="bg-white border-l-8 border-blue-500 p-6 shadow-sm space-y-4">
          <h3 className="text-lg font-bold text-dark-brown">Dialogue Extraction Prompt</h3>

          {promptMetadata && (
            <div className="flex gap-4 text-sm text-gray-600">
              <span>
                Target exchanges: <strong>{promptMetadata.targetExchangeCount}</strong>
              </span>
              <span>
                Vocab seeds: <strong>{promptMetadata.vocabularySeeds ? 'Yes' : 'None'}</strong>
              </span>
              <span>
                Grammar seeds: <strong>{promptMetadata.grammarSeeds ? 'Yes' : 'None'}</strong>
              </span>
            </div>
          )}

          <textarea
            value={prompt}
            onChange={(e) => !readOnly && setPrompt(e.target.value)}
            readOnly={readOnly}
            className="w-full h-96 px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-coral focus:outline-none text-sm font-mono leading-relaxed"
          />

          {!readOnly && (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleBuildPrompt()}
                disabled={!!loading}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-sm rounded-lg transition-all disabled:opacity-50"
              >
                Refresh Seeds
              </button>
              <button
                type="button"
                onClick={handleGenerateDialogue}
                disabled={!!loading || !prompt.trim()}
                className="px-6 py-2 bg-coral hover:bg-coral-dark text-white font-bold text-sm rounded-lg transition-all disabled:opacity-50"
              >
                Generate Dialogue
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Dialogue Exchanges */}
      {activeStep === 'exchanges' && exchanges && (
        <div className="bg-white border-l-8 border-green-500 p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-dark-brown">
              Dialogue Exchanges ({exchanges.length})
            </h3>
            {!readOnly && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setActiveStep('prompt')}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-sm rounded-lg transition-all"
                >
                  Back to Prompt
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await handleBuildScriptConfig();
                    setActiveStep('config');
                  }}
                  disabled={!!loading}
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
                onClick={() => !readOnly && openExchangeEditor(exchange.order, exchange)}
                disabled={readOnly}
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
      )}

      {/* Exchange Edit Modal */}
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
                onChange={(e) => setEditForm({ ...editForm, speakerName: e.target.value })}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-coral focus:outline-none text-sm"
              />
            </label>

            <label className="block">
              <span className="block text-sm font-bold text-gray-700 mb-1">Text (L2)</span>
              <textarea
                value={editForm.textL2}
                onChange={(e) => setEditForm({ ...editForm, textL2: e.target.value })}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-coral focus:outline-none text-sm h-20"
              />
            </label>

            <label className="block">
              <span className="block text-sm font-bold text-gray-700 mb-1">Reading</span>
              <input
                type="text"
                value={editForm.readingL2 || ''}
                onChange={(e) => setEditForm({ ...editForm, readingL2: e.target.value || null })}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-coral focus:outline-none text-sm"
              />
            </label>

            <label className="block">
              <span className="block text-sm font-bold text-gray-700 mb-1">Translation</span>
              <textarea
                value={editForm.translationL1}
                onChange={(e) => setEditForm({ ...editForm, translationL1: e.target.value })}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-coral focus:outline-none text-sm h-16"
              />
            </label>
            {/* eslint-enable jsx-a11y/label-has-associated-control */}

            <div>
              <span className="block text-sm font-bold text-gray-700 mb-2">Vocabulary Items</span>
              {editForm.vocabularyItems.map((vocab, vidx) => (
                // eslint-disable-next-line react/no-array-index-key
                <div key={`edit-vocab-${vidx}`} className="flex gap-2 mb-2 items-center">
                  <input
                    type="text"
                    value={vocab.textL2}
                    onChange={(e) => {
                      const items = [...editForm.vocabularyItems];
                      items[vidx] = { ...items[vidx], textL2: e.target.value };
                      setEditForm({ ...editForm, vocabularyItems: items });
                    }}
                    className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm"
                    placeholder="Word"
                  />
                  <input
                    type="text"
                    value={vocab.translationL1}
                    onChange={(e) => {
                      const items = [...editForm.vocabularyItems];
                      items[vidx] = { ...items[vidx], translationL1: e.target.value };
                      setEditForm({ ...editForm, vocabularyItems: items });
                    }}
                    className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm"
                    placeholder="Translation"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const items = editForm.vocabularyItems.filter((_, i) => i !== vidx);
                      setEditForm({ ...editForm, vocabularyItems: items });
                    }}
                    className="text-red-500 hover:text-red-700 text-sm font-bold px-1"
                  >
                    X
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  setEditForm({
                    ...editForm,
                    vocabularyItems: [
                      ...editForm.vocabularyItems,
                      { textL2: '', translationL1: '' },
                    ],
                  });
                }}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                + Add vocabulary item
              </button>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setEditingExchange(null);
                  setEditForm(null);
                }}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-sm rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveExchangeEdit}
                className="px-4 py-2 bg-coral hover:bg-coral-dark text-white font-bold text-sm rounded-lg"
              >
                Save
              </button>
            </div>
          </div>
        </div>
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
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
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
                onClick={handleGenerateAudio}
                className="ml-3 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 font-bold text-xs rounded"
              >
                Retry
              </button>
            </div>
          )}

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
              onClick={() => setActiveStep('script')}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-sm rounded-lg transition-all"
            >
              Back to Script
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminScriptWorkbench;
