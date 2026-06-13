import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { AUDIO_SCRIPT_SPEEDS } from '@languageflow/shared/src/audioScript';
import { getAudioScriptTtsVoices } from '@languageflow/shared/src/voiceSelection';
import VoicePreview from '../components/common/VoicePreview';
import { API_URL } from '../config';
import { useIsDemo } from '../hooks/useDemo';
import DemoRestrictionModal from '../components/common/DemoRestrictionModal';

type Step = 'input' | 'generating';

async function readApiError(response: Response, fallback: string): Promise<string> {
  const payload = await response.json().catch(() => null);
  return payload?.error || payload?.message || fallback;
}

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

  async function pollUntilReady(id: string) {
    const startedAt = Date.now();
    const timeoutMs = 10 * 60 * 1000;

    /* eslint-disable no-await-in-loop -- polling must wait between status requests */
    while (Date.now() - startedAt < timeoutMs) {
      const response = await fetch(`${API_URL}/api/scripts/${id}/status`, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Failed to check script status.'));
      }
      const script = await response.json();
      if (!mountedRef.current) return;
      const readyCount = script.renders.filter(
        (render: { status: string }) => render.status === 'ready'
      ).length;
      const segmentCount = Array.isArray(script.segments) ? script.segments.length : 0;
      const imageReadyCount = Array.isArray(script.segments)
        ? script.segments.filter(
            (segment: { imageStatus?: string; imageMediaId?: string | null }) =>
              segment.imageStatus === 'ready' && segment.imageMediaId
          ).length
        : 0;
      const imageStatus = script.imageStatus || 'pending';
      setRenderStatus(
        `Generated ${readyCount}/${AUDIO_SCRIPT_SPEEDS.length} audio tracks and ${imageReadyCount}/${segmentCount} illustrations...`
      );

      if (
        script.status === 'ready' &&
        (imageStatus === 'ready' || imageStatus === 'partial' || imageStatus === 'error')
      ) {
        const suffix = viewAsUserId ? `?viewAs=${viewAsUserId}` : '';
        if (!mountedRef.current) return;
        navigate(`/app/playback/${id}${suffix}`);
        return;
      }
      if (script.status === 'error') {
        throw new Error(script.errorMessage || 'Script audio generation failed.');
      }

      await new Promise((resolve) => {
        window.setTimeout(resolve, 3000);
      });
      if (!mountedRef.current) return;
    }
    /* eslint-enable no-await-in-loop */

    throw new Error('Script audio generation timed out. Please open it from the Library later.');
  }

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
      const createResponse = await fetch(`${API_URL}/api/scripts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sourceText, voiceId }),
      });
      if (!createResponse.ok) {
        throw new Error(await readApiError(createResponse, 'Failed to create script.'));
      }
      const episode = await createResponse.json();

      const annotateResponse = await fetch(`${API_URL}/api/scripts/${episode.id}/annotate`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!annotateResponse.ok) {
        throw new Error(await readApiError(annotateResponse, 'Failed to annotate script.'));
      }

      setRenderStatus('Generating audio and illustrations...');
      const imagesResponse = await fetch(`${API_URL}/api/scripts/${episode.id}/images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ force: false }),
      });
      if (!imagesResponse.ok) {
        throw new Error(await readApiError(imagesResponse, 'Failed to start image generation.'));
      }
      const renderResponse = await fetch(`${API_URL}/api/scripts/${episode.id}/render`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!renderResponse.ok) {
        throw new Error(await readApiError(renderResponse, 'Failed to start audio rendering.'));
      }

      if (mountedRef.current) {
        await pollUntilReady(episode.id);
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
