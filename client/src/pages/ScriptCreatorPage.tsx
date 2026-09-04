import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { AUDIO_SCRIPT_SPEEDS } from '@languageflow/shared/src/audioScript';
import { getAudioScriptTtsVoices } from '@languageflow/shared/src/voiceSelection';
import VoicePreview from '../components/common/VoicePreview';
import { useIsDemo } from '../hooks/useDemo';
import DemoRestrictionModal from '../components/common/DemoRestrictionModal';
import { readScriptApiError, scriptApi } from '../lib/scriptApi';

type Step = 'input' | 'generating';
type ScriptId = string;
type ScriptSourceText = string;
type VoiceId = string;
type RenderStatus = string;
type ScriptApiErrorMessage = string;

interface ScriptStatusResponse {
  errorMessage?: string;
  imageStatus?: string;
  renders: Array<{ status: string }>;
  segments?: Array<{ imageStatus?: string; imageMediaId?: string | null }>;
  status: string;
}

interface PollUntilReadyOptions {
  id: ScriptId;
  isMounted: () => boolean;
  navigate: ReturnType<typeof useNavigate>;
  setRenderStatus: (status: RenderStatus) => void;
  viewAsUserId?: ScriptId;
}

const fetchScriptStatus = async (id: ScriptId): Promise<ScriptStatusResponse> => {
  const response = await fetch(scriptApi.operation(id, 'status'), {
    credentials: 'include',
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(await readScriptApiError(response, 'Failed to check script status.'));
  }
  return response.json();
};

const describeRenderProgress = (script: ScriptStatusResponse) => {
  const readyCount = script.renders.filter((render) => render.status === 'ready').length;
  const segments = Array.isArray(script.segments) ? script.segments : [];
  const imageReadyCount = segments.filter(
    (segment) => segment.imageStatus === 'ready' && Boolean(segment.imageMediaId)
  ).length;
  return `Generated ${readyCount}/${AUDIO_SCRIPT_SPEEDS.length} audio tracks and ${imageReadyCount}/${segments.length} illustrations...`;
};

const completedImageStatuses = new Set(['ready', 'partial', 'error']);

const isScriptReady = (script: ScriptStatusResponse) =>
  script.status === 'ready' && completedImageStatuses.has(script.imageStatus ?? 'pending');

const playbackPath = (id: ScriptId, viewAsUserId?: ScriptId) => {
  const suffix = viewAsUserId ? `?${new URLSearchParams({ viewAs: viewAsUserId }).toString()}` : '';
  return `/app/playback/${id}${suffix}`;
};

const handleTerminalScriptStatus = (
  script: ScriptStatusResponse,
  { id, navigate, viewAsUserId }: PollUntilReadyOptions
) => {
  if (isScriptReady(script)) {
    navigate(playbackPath(id, viewAsUserId));
    return true;
  }
  if (script.status === 'error') {
    throw new Error(script.errorMessage || 'Script audio generation failed.');
  }
  return false;
};

const waitForNextPoll = () =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, 3000);
  });

const pollUntilReady = async (options: PollUntilReadyOptions) => {
  const startedAt = Date.now();
  const timeoutMs = 10 * 60 * 1000;

  /* eslint-disable no-await-in-loop -- polling must wait between status requests */
  while (Date.now() - startedAt < timeoutMs) {
    const script = await fetchScriptStatus(options.id);
    if (!options.isMounted()) return;
    options.setRenderStatus(describeRenderProgress(script));
    if (handleTerminalScriptStatus(script, options)) return;

    await waitForNextPoll();
    if (!options.isMounted()) return;
  }
  /* eslint-enable no-await-in-loop */

  throw new Error('Script audio generation timed out. Please open it from the Library later.');
};

const requireSuccessfulResponse = async (
  response: Response,
  fallbackMessage: ScriptApiErrorMessage
) => {
  if (!response.ok) {
    throw new Error(await readScriptApiError(response, fallbackMessage));
  }
};

const createScriptEpisode = async (sourceText: ScriptSourceText, voiceId: VoiceId) => {
  const response = await fetch(scriptApi.collection, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ sourceText, voiceId }),
  });
  await requireSuccessfulResponse(response, 'Failed to create script.');
  return response.json() as Promise<{ id: string }>;
};

interface StartScriptOperationOptions {
  body?: string;
  fallbackMessage: ScriptApiErrorMessage;
  id: ScriptId;
  operation: 'annotate' | 'images' | 'render';
}

const startScriptOperation = async ({
  body,
  fallbackMessage,
  id,
  operation,
}: StartScriptOperationOptions) => {
  const response = await fetch(scriptApi.operation(id, operation), {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'include',
    body,
  });
  await requireSuccessfulResponse(response, fallbackMessage);
};

const startScriptGeneration = async (
  sourceText: ScriptSourceText,
  voiceId: VoiceId,
  setRenderStatus: (status: RenderStatus) => void
) => {
  const episode = await createScriptEpisode(sourceText, voiceId);
  await startScriptOperation({
    id: episode.id,
    operation: 'annotate',
    fallbackMessage: 'Failed to annotate script.',
  });

  setRenderStatus('Generating audio and illustrations...');
  await startScriptOperation({
    id: episode.id,
    operation: 'images',
    fallbackMessage: 'Failed to start image generation.',
    body: JSON.stringify({ force: false }),
  });
  await startScriptOperation({
    id: episode.id,
    operation: 'render',
    fallbackMessage: 'Failed to start audio rendering.',
  });
  return episode.id;
};

const ScriptCreatorPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewAsUserId = searchParams.get('viewAs') || undefined;
  const isDemo = useIsDemo();
  const voiceOptions = useMemo(() => getAudioScriptTtsVoices('ja'), []);
  const [sourceText, setSourceText] = useState('');
  const [voiceId, setVoiceId] = useState(voiceOptions[0]?.id ?? 'ja-JP-Neural2-D');
  const [step, setStep] = useState<Step>('input');
  const [error, setError] = useState<string | null>(null);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [renderStatus, setRenderStatus] = useState('Preparing your script...');
  const mountedRef = useRef(true);
  const submittingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const createAndGenerate = async () => {
    if (submittingRef.current) {
      return;
    }
    if (isDemo) {
      setShowDemoModal(true);
      return;
    }
    if (!sourceText.trim()) {
      setError('Paste Japanese text before generating a script.');
      return;
    }

    setError(null);
    setRenderStatus('Segmenting script and adding furigana...');
    setStep('generating');
    submittingRef.current = true;

    try {
      const episodeId = await startScriptGeneration(sourceText, voiceId, setRenderStatus);

      if (mountedRef.current) {
        await pollUntilReady({
          id: episodeId,
          isMounted: () => mountedRef.current,
          navigate,
          setRenderStatus,
          viewAsUserId,
        });
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to generate script.');
        setStep('input');
        setRenderStatus('Preparing your script...');
        submittingRef.current = false;
      }
    }
  };

  return (
    <div className="retro-dialogue-create-v3-wrap">
      <div className="retro-dialogue-create-v3-shell">
        <div className="retro-dialogue-create-v3-top">
          <h1 className="retro-dialogue-create-v3-title">Create Script</h1>
          <p className="retro-dialogue-create-v3-subtitle">
            Paste natural Japanese and turn it into timed listening practice.
          </p>
        </div>

        <div className="retro-dialogue-create-v3-main">
          {error && <div className="retro-dialogue-create-v3-alert is-error">{error}</div>}

          {step === 'input' && (
            <div className="space-y-6 retro-dialogue-create-v3-generator">
              <section className="retro-dialogue-create-v3-section">
                <h2 className="retro-dialogue-create-v3-section-title">Japanese text</h2>
                {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                <label htmlFor="script-source-text" className="retro-dialogue-create-v3-label">
                  Paste your script
                </label>
                <textarea
                  id="script-source-text"
                  value={sourceText}
                  onChange={(event) => setSourceText(event.target.value)}
                  className="retro-dialogue-create-v3-input retro-dialogue-create-v3-textarea"
                  placeholder="日本に住んでみて、一番驚いたことは..."
                  data-testid="script-input-source-text"
                />
              </section>

              <section className="retro-dialogue-create-v3-section">
                <h2 className="retro-dialogue-create-v3-section-title">Voice</h2>
                {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                <label htmlFor="script-voice" className="retro-dialogue-create-v3-label">
                  Google Neural2 voice
                </label>
                <select
                  id="script-voice"
                  value={voiceId}
                  onChange={(event) => setVoiceId(event.target.value)}
                  className="retro-dialogue-create-v3-input retro-dialogue-create-v3-select"
                >
                  {voiceOptions.map((voice) => (
                    <option key={voice.id} value={voice.id}>
                      ({voice.gender === 'male' ? 'M' : 'F'}) {voice.description}
                    </option>
                  ))}
                </select>
                <VoicePreview voiceId={voiceId} />
              </section>

              <button
                type="button"
                onClick={createAndGenerate}
                disabled={step !== 'input'}
                className="retro-dialogue-create-v3-submit"
                data-testid="script-button-generate"
              >
                <FileText className="h-5 w-5" />
                Generate
              </button>
            </div>
          )}

          {step === 'generating' && (
            <div className="retro-dialogue-create-v3-generator">
              <div className="retro-dialogue-create-v3-state">
                <div className="loading-spinner retro-dialogue-create-v3-spinner" />
                <h2 className="retro-dialogue-create-v3-state-title">Generating script</h2>
                <p className="retro-dialogue-create-v3-state-copy">{renderStatus}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <DemoRestrictionModal isOpen={showDemoModal} onClose={() => setShowDemoModal(false)} />
    </div>
  );
};

export default ScriptCreatorPage;
