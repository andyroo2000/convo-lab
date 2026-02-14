import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Clock, Pause, Play, RotateCcw, Trash2 } from 'lucide-react';

// eslint-disable-next-line import/no-extraneous-dependencies
import { SENTENCE_SCRIPT_PROMPT } from '@languageflow/shared/src/scriptLabPrompts';
// eslint-disable-next-line import/no-extraneous-dependencies
import {
  DEFAULT_NARRATOR_VOICES,
  DEFAULT_SPEAKER_VOICES,
  TTS_VOICES,
} from '@languageflow/shared/src/constants-new';

import { API_URL } from '../../../config';
import { LessonScriptUnit } from '../../../types';
import VoicePreview from '../../common/VoicePreview';

interface SentenceScriptResponse {
  units: LessonScriptUnit[] | null;
  estimatedDurationSeconds: number | null;
  rawResponse: string;
  translation: string | null;
  parseError?: string;
  testId?: string;
}

interface PastTestSummary {
  id: string;
  sentence: string;
  translation: string | null;
  estimatedDurationSecs: number | null;
  parseError: string | null;
  createdAt: string;
}

interface PastTestFull {
  id: string;
  sentence: string;
  translation: string | null;
  targetLanguage: string;
  nativeLanguage: string;
  jlptLevel: string | null;
  l1VoiceId: string;
  l2VoiceId: string;
  promptTemplate: string;
  unitsJson: LessonScriptUnit[] | null;
  rawResponse: string;
  estimatedDurationSecs: number | null;
  parseError: string | null;
  createdAt: string;
}

const PROMPT_STORAGE_KEY = 'scriptLab:sentencePromptTemplate';

const getStoredPromptTemplate = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage.getItem(PROMPT_STORAGE_KEY);
  } catch {
    return null;
  }
};

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const AudioCourseCreation = () => {
  const [sentence, setSentence] = useState('');
  const [promptOverride, setPromptOverride] = useState(
    () => getStoredPromptTemplate() ?? SENTENCE_SCRIPT_PROMPT
  );
  const [savedPrompt, setSavedPrompt] = useState(() => getStoredPromptTemplate());
  const [saveMessage, setSaveMessage] = useState('');
  const [l1VoiceId, setL1VoiceId] = useState<string>(DEFAULT_NARRATOR_VOICES.en);
  const [l2VoiceId, setL2VoiceId] = useState<string>(DEFAULT_SPEAKER_VOICES.ja.speaker1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [response, setResponse] = useState<SentenceScriptResponse | null>(null);

  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [lineLoadingIndex, setLineLoadingIndex] = useState<number | null>(null);
  const [audioCache, setAudioCache] = useState<Record<number, string>>({});
  const audioRef = useRef<HTMLAudioElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  // Past tests state
  const [pastTests, setPastTests] = useState<PastTestSummary[]>([]);
  const [activeTestId, setActiveTestId] = useState<string | null>(null);
  const [loadingTestId, setLoadingTestId] = useState<string | null>(null);
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set());

  const narratorVoiceOptions = useMemo(
    () => TTS_VOICES.en.voices.filter((voice) => voice.provider === 'fishaudio'),
    []
  );

  const japaneseVoiceOptions = useMemo(
    () => TTS_VOICES.ja.voices.filter((voice) => voice.provider === 'fishaudio'),
    []
  );

  const estimatedDuration = useMemo(() => {
    if (response?.estimatedDurationSeconds == null) {
      return null;
    }
    return Math.round(response.estimatedDurationSeconds);
  }, [response]);

  useLayoutEffect(() => {
    const textarea = promptRef.current;
    if (!textarea) {
      return;
    }
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [promptOverride]);

  const fetchPastTests = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/script-lab/sentence-tests?limit=50`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = (await res.json()) as { tests: PastTestSummary[] };
        setPastTests(data.tests);
      }
    } catch {
      // silently fail — history is non-critical
    }
  }, []);

  useEffect(() => {
    fetchPastTests();
  }, [fetchPastTests]);

  const handleLoadTest = async (testId: string) => {
    if (loadingTestId) return;
    setLoadingTestId(testId);
    setError('');

    try {
      const res = await fetch(`${API_URL}/api/admin/script-lab/sentence-tests/${testId}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Failed to load test');
      }

      const data = (await res.json()) as PastTestFull;

      // Populate form inputs
      setSentence(data.sentence);
      setL1VoiceId(data.l1VoiceId);
      setL2VoiceId(data.l2VoiceId);
      if (data.promptTemplate) {
        setPromptOverride(data.promptTemplate);
      }

      // Populate results
      setResponse({
        units: data.unitsJson,
        estimatedDurationSeconds: data.estimatedDurationSecs,
        rawResponse: data.rawResponse,
        translation: data.translation,
        parseError: data.parseError || undefined,
        testId: data.id,
      });

      setActiveTestId(data.id);
      setAudioCache({});
      setPlayingIndex(null);
      setPlayingUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load test');
    } finally {
      setLoadingTestId(null);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedForDelete.size === 0) return;

    try {
      const res = await fetch(`${API_URL}/api/admin/script-lab/sentence-tests`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ids: [...selectedForDelete] }),
      });

      if (!res.ok) {
        throw new Error('Failed to delete tests');
      }

      // Clear active test if it was deleted
      if (activeTestId && selectedForDelete.has(activeTestId)) {
        setActiveTestId(null);
        setResponse(null);
      }

      setSelectedForDelete(new Set());
      fetchPastTests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete tests');
    }
  };

  const handleGenerate = async () => {
    if (!sentence.trim()) {
      setError('Please enter a Japanese sentence');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      const res = await fetch(`${API_URL}/api/admin/script-lab/sentence-script`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sentence: sentence.trim(),
          promptOverride,
          l1VoiceId,
          l2VoiceId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to generate script');
      }

      const data = (await res.json()) as SentenceScriptResponse;
      setResponse(data);
      setActiveTestId(data.testId || null);
      setAudioCache({});
      setPlayingIndex(null);
      setPlayingUrl(null);
      fetchPastTests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate script');
      setResponse(null);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleResetPrompt = () => {
    setPromptOverride(SENTENCE_SCRIPT_PROMPT);
  };

  const handleSavePrompt = () => {
    try {
      window.localStorage.setItem(PROMPT_STORAGE_KEY, promptOverride);
      setSavedPrompt(promptOverride);
      setSaveMessage('Saved');
      setTimeout(() => setSaveMessage(''), 2000);
    } catch {
      setError('Failed to save prompt template');
    }
  };

  const hasUnsavedChanges = savedPrompt?.trim() !== promptOverride.trim();

  const handlePlay = async (unit: LessonScriptUnit, index: number) => {
    if (unit.type !== 'narration_L1' && unit.type !== 'L2') {
      return;
    }

    if (playingIndex === index && audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      setPlayingIndex(null);
      return;
    }

    const cachedUrl = audioCache[index];
    if (cachedUrl) {
      setPlayingUrl(cachedUrl);
      setPlayingIndex(index);
      return;
    }

    setLineLoadingIndex(index);
    setError('');

    const textToSynthesize = unit.type === 'L2' ? unit.reading || unit.text : unit.text;

    try {
      const res = await fetch(`${API_URL}/api/admin/script-lab/synthesize-line`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          text: textToSynthesize,
          voiceId: unit.voiceId,
          speed: unit.speed,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to synthesize line');
      }

      const data = (await res.json()) as { audioUrl: string };
      setAudioCache((prev) => ({ ...prev, [index]: data.audioUrl }));
      setPlayingUrl(data.audioUrl);
      setPlayingIndex(index);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to synthesize line');
    } finally {
      setLineLoadingIndex(null);
    }
  };

  return (
    <div className="space-y-6 retro-admin-v3-module">
      {error && <div className="retro-admin-v3-alert is-error">{error}</div>}

      <div>
        {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
        <label htmlFor="sentence-input" className="block text-sm font-medium text-gray-700 mb-1">
          Japanese Sentence <span className="text-red-500">*</span>
        </label>
        <textarea
          id="sentence-input"
          value={sentence}
          onChange={(e) => setSentence(e.target.value)}
          className="retro-admin-v3-input w-full px-3 py-2"
          rows={3}
          placeholder="Hokkaido ni ikitai desu."
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
          <label htmlFor="l1-voice-input" className="block text-sm font-medium text-gray-700 mb-1">
            Narrator Voice (L1)
          </label>
          <select
            id="l1-voice-input"
            value={l1VoiceId}
            onChange={(e) => setL1VoiceId(e.target.value)}
            className="retro-admin-v3-input w-full px-3 py-2 text-sm"
          >
            {narratorVoiceOptions.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.description} ({voice.gender})
              </option>
            ))}
          </select>
          <VoicePreview voiceId={l1VoiceId} />
        </div>

        <div>
          {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
          <label htmlFor="l2-voice-input" className="block text-sm font-medium text-gray-700 mb-1">
            Japanese Voice (L2)
          </label>
          <select
            id="l2-voice-input"
            value={l2VoiceId}
            onChange={(e) => setL2VoiceId(e.target.value)}
            className="retro-admin-v3-input w-full px-3 py-2 text-sm"
          >
            {japaneseVoiceOptions.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.description} ({voice.gender})
              </option>
            ))}
          </select>
          <VoicePreview voiceId={l2VoiceId} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
          <label htmlFor="prompt-editor" className="block text-sm font-medium text-gray-700">
            Prompt Template
          </label>
          <div className="flex items-center gap-3">
            {saveMessage && <span className="text-xs text-emerald-600">{saveMessage}</span>}
            {!saveMessage && !hasUnsavedChanges && savedPrompt && (
              <span className="text-xs text-emerald-600">Saved</span>
            )}
            <button
              type="button"
              onClick={handleSavePrompt}
              className="text-xs retro-admin-v3-link font-medium"
              disabled={!promptOverride.trim()}
            >
              Save as Base
            </button>
            <button
              type="button"
              onClick={handleResetPrompt}
              className="text-xs text-gray-500 hover:text-indigo flex items-center gap-1 retro-admin-v3-link"
            >
              <RotateCcw className="w-3 h-3" />
              Reset to Default
            </button>
          </div>
        </div>
        <textarea
          id="prompt-editor"
          ref={promptRef}
          value={promptOverride}
          onChange={(e) => setPromptOverride(e.target.value)}
          onInput={() => {
            if (!promptRef.current) return;
            promptRef.current.style.height = 'auto';
            promptRef.current.style.height = `${promptRef.current.scrollHeight}px`;
          }}
          className="retro-admin-v3-input w-full px-3 py-2 font-mono text-xs"
          rows={6}
        />
        <p className="text-xs text-gray-500 mt-2">
          Use placeholders: {'{{sentence}}'}, {'{{translation}}'}, {'{{targetLanguage}}'},{' '}
          {'{{nativeLanguage}}'}.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleGenerate}
          className="retro-admin-v3-btn-primary"
          disabled={isGenerating}
        >
          {isGenerating ? 'Generating...' : 'Generate Script'}
        </button>
      </div>

      {/* Past Tests */}
      {pastTests.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-700">Past Tests</h3>
            {selectedForDelete.size > 0 && (
              <button
                type="button"
                onClick={handleDeleteSelected}
                className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Delete {selectedForDelete.size}
              </button>
            )}
          </div>
          <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100 retro-admin-v3-subpanel">
            {pastTests.map((test) => {
              const isActive = activeTestId === test.id;
              const isLoading = loadingTestId === test.id;
              const isSelected = selectedForDelete.has(test.id);

              return (
                <div
                  key={test.id}
                  className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 transition-colors ${
                    isActive ? 'bg-indigo/5 border-l-2 border-l-indigo' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      e.stopPropagation();
                      setSelectedForDelete((prev) => {
                        const next = new Set(prev);
                        if (isSelected) {
                          next.delete(test.id);
                        } else {
                          next.add(test.id);
                        }
                        return next;
                      });
                    }}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-indigo shrink-0"
                  />
                  <button
                    type="button"
                    onClick={() => handleLoadTest(test.id)}
                    disabled={isLoading}
                    className="flex-1 flex items-center gap-3 text-left min-w-0"
                  >
                    <span className="truncate font-medium text-gray-800">{test.sentence}</span>
                    <span className="shrink-0 flex items-center gap-2 text-xs text-gray-400">
                      {test.parseError && (
                        <span className="text-amber-500 font-medium">parse error</span>
                      )}
                      {test.estimatedDurationSecs != null && (
                        <span className="flex items-center gap-0.5">
                          <Clock className="w-3 h-3" />
                          {Math.round(test.estimatedDurationSecs)}s
                        </span>
                      )}
                      <span>{formatRelativeTime(test.createdAt)}</span>
                      {isLoading && <span className="text-indigo">loading...</span>}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {response && (
        <div className="space-y-4">
          <div className="retro-admin-v3-subpanel bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700">
            <div className="flex flex-wrap gap-4">
              <div>
                <span className="font-semibold">Translation:</span> {response.translation || 'Auto'}
              </div>
              {estimatedDuration !== null && (
                <div>
                  <span className="font-semibold">Estimated Duration:</span> {estimatedDuration}s
                </div>
              )}
            </div>
          </div>

          {response.parseError && (
            <div className="retro-admin-v3-alert bg-amber-50 border border-amber-200 text-amber-700 text-sm">
              Failed to parse script JSON: {response.parseError}
            </div>
          )}

          {response.units && response.units.length > 0 && (
            <div className="space-y-2 max-h-[520px] overflow-y-auto">
              {response.units.map((unit, index) => {
                const isPlayable = unit.type === 'narration_L1' || unit.type === 'L2';
                const isPlaying = playingIndex === index;
                const isLoading = lineLoadingIndex === index;

                return (
                  <div
                    // eslint-disable-next-line react/no-array-index-key
                    key={`unit-${unit.type}-${index}`}
                    className="flex items-start gap-3 text-sm bg-white border border-gray-200 rounded-lg p-3 retro-admin-v3-subpanel"
                  >
                    <div className="text-xs text-gray-400 font-mono w-8 text-right">
                      {index + 1}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="text-xs font-semibold text-gray-500 uppercase">
                        {unit.type}
                      </div>
                      {unit.type === 'pause' && (
                        <div className="text-gray-600">Pause {unit.seconds}s</div>
                      )}
                      {unit.type === 'marker' && (
                        <div className="text-gray-700 font-semibold">{unit.label}</div>
                      )}
                      {unit.type === 'narration_L1' && (
                        <div className="text-gray-800 italic">{unit.text}</div>
                      )}
                      {unit.type === 'L2' && (
                        <div>
                          <div className="text-gray-900 font-medium">{unit.text}</div>
                          {unit.reading && (
                            <div className="text-xs text-gray-500 font-mono mt-1">
                              {unit.reading}
                            </div>
                          )}
                          {unit.speed && unit.speed !== 1 && (
                            <div className="text-xs text-gray-500 mt-1">Speed: {unit.speed}x</div>
                          )}
                        </div>
                      )}
                    </div>
                    {isPlayable && (
                      <button
                        type="button"
                        onClick={() => handlePlay(unit, index)}
                        className="retro-admin-v3-btn-primary px-3 py-2 text-xs font-semibold flex items-center gap-2 disabled:opacity-60"
                        disabled={isLoading}
                      >
                        {/* eslint-disable-next-line no-nested-ternary */}
                        {isLoading ? (
                          'Loading...'
                        ) : isPlaying ? (
                          <>
                            <Pause className="w-3 h-3" />
                            Pause
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3" />
                            Play
                          </>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Raw Response</div>
            <pre className="bg-gray-900 text-gray-100 text-xs p-3 rounded-lg overflow-x-auto max-h-64">
              {response.rawResponse}
            </pre>
          </div>
        </div>
      )}

      {playingUrl && (
        <audio
          ref={audioRef}
          src={playingUrl}
          autoPlay
          onEnded={() => {
            setPlayingIndex(null);
            setPlayingUrl(null);
          }}
          className="w-full"
          controls
        />
      )}
    </div>
  );
};

export default AudioCourseCreation;
