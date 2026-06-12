import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, Loader2 } from 'lucide-react';
import { getAudioScriptTtsVoices } from '@languageflow/shared/src/voiceSelection';
import VoicePreview from '../components/common/VoicePreview';
import { API_URL } from '../config';
import { useIsDemo } from '../hooks/useDemo';
import DemoRestrictionModal from '../components/common/DemoRestrictionModal';

interface EditableSegment {
  id?: string;
  clientKey: string;
  text: string;
  reading: string;
  translation: string;
  imagePrompt?: string | null;
}

type Step = 'input' | 'annotating' | 'review' | 'rendering';

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
  const [episodeId, setEpisodeId] = useState<string | null>(null);
  const [title, setTitle] = useState('Japanese Script');
  const [segments, setSegments] = useState<EditableSegment[]>([]);
  const [step, setStep] = useState<Step>('input');
  const [error, setError] = useState<string | null>(null);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [renderStatus, setRenderStatus] = useState('Generating audio at 0.75x, 0.85x, and 1.0x...');

  const createAndAnnotate = async () => {
    if (isDemo) {
      setShowDemoModal(true);
      return;
    }
    if (!sourceText.trim()) {
      setError('Paste Japanese text before generating a script.');
      return;
    }

    setError(null);
    setStep('annotating');

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
      setEpisodeId(episode.id);

      const annotateResponse = await fetch(`${API_URL}/api/scripts/${episode.id}/annotate`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!annotateResponse.ok) {
        throw new Error(await readApiError(annotateResponse, 'Failed to annotate script.'));
      }
      const script = await annotateResponse.json();
      setTitle(script.episode.title);
      setVoiceId(script.voiceId);
      setSegments(
        script.segments.map((segment: EditableSegment, index: number) => ({
          ...segment,
          clientKey: segment.id || `${index}-${segment.text}`,
          reading: segment.reading || segment.text,
        }))
      );
      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to prepare script.');
      setStep('input');
    }
  };

  const updateSegment = (index: number, patch: Partial<EditableSegment>) => {
    setSegments((prev) =>
      prev.map((segment, currentIndex) =>
        currentIndex === index ? { ...segment, ...patch } : segment
      )
    );
  };

  const pollUntilReady = async (id: string) => {
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
      const readyCount = script.renders.filter(
        (render: { status: string }) => render.status === 'ready'
      ).length;
      setRenderStatus(`Generated ${readyCount}/3 audio tracks...`);

      if (script.status === 'ready') {
        const suffix = viewAsUserId ? `?viewAs=${viewAsUserId}` : '';
        navigate(`/app/playback/${id}${suffix}`);
        return;
      }
      if (script.status === 'error') {
        throw new Error(script.errorMessage || 'Script audio generation failed.');
      }

      await new Promise((resolve) => {
        window.setTimeout(resolve, 3000);
      });
    }
    /* eslint-enable no-await-in-loop */

    throw new Error('Script audio generation timed out. Please open it from the Library later.');
  };

  const saveAndRender = async () => {
    if (!episodeId) return;
    setError(null);
    setStep('rendering');

    try {
      const saveResponse = await fetch(`${API_URL}/api/scripts/${episodeId}/segments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title, voiceId, segments }),
      });
      if (!saveResponse.ok) {
        throw new Error(await readApiError(saveResponse, 'Failed to save script edits.'));
      }

      const renderResponse = await fetch(`${API_URL}/api/scripts/${episodeId}/render`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!renderResponse.ok) {
        throw new Error(await readApiError(renderResponse, 'Failed to start audio rendering.'));
      }

      await pollUntilReady(episodeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to render script audio.');
      setStep('review');
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

          {(step === 'input' || step === 'annotating') && (
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
                  disabled={step === 'annotating'}
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
                  disabled={step === 'annotating'}
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
                onClick={createAndAnnotate}
                className="retro-dialogue-create-v3-submit"
                disabled={step === 'annotating'}
                data-testid="script-button-annotate"
              >
                {step === 'annotating' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Segmenting...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    Segment script
                  </>
                )}
              </button>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-6 retro-dialogue-create-v3-generator">
              <section className="retro-dialogue-create-v3-section">
                <h2 className="retro-dialogue-create-v3-section-title">Review</h2>
                {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                <label htmlFor="script-title" className="retro-dialogue-create-v3-label">
                  Title
                </label>
                <input
                  id="script-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="retro-dialogue-create-v3-input"
                />
              </section>

              {segments.map((segment, index) => (
                <section
                  key={segment.clientKey || segment.id || segment.text}
                  className="retro-dialogue-create-v3-section"
                >
                  <h3 className="retro-dialogue-create-v3-section-title">Segment {index + 1}</h3>
                  {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                  <label
                    className="retro-dialogue-create-v3-label"
                    htmlFor={`script-text-${index}`}
                  >
                    Japanese
                  </label>
                  <textarea
                    id={`script-text-${index}`}
                    value={segment.text}
                    onChange={(event) => updateSegment(index, { text: event.target.value })}
                    className="retro-dialogue-create-v3-input retro-dialogue-create-v3-textarea is-short"
                  />
                  {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                  <label
                    className="retro-dialogue-create-v3-label is-small"
                    htmlFor={`script-reading-${index}`}
                  >
                    Furigana reading
                  </label>
                  <textarea
                    id={`script-reading-${index}`}
                    value={segment.reading}
                    onChange={(event) => updateSegment(index, { reading: event.target.value })}
                    className="retro-dialogue-create-v3-input retro-dialogue-create-v3-textarea is-short"
                  />
                  {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                  <label
                    className="retro-dialogue-create-v3-label is-small"
                    htmlFor={`script-translation-${index}`}
                  >
                    English
                  </label>
                  <textarea
                    id={`script-translation-${index}`}
                    value={segment.translation}
                    onChange={(event) => updateSegment(index, { translation: event.target.value })}
                    className="retro-dialogue-create-v3-input retro-dialogue-create-v3-textarea is-short"
                  />
                </section>
              ))}

              <button
                type="button"
                onClick={saveAndRender}
                className="retro-dialogue-create-v3-submit"
                data-testid="script-button-render"
              >
                Generate audio
              </button>
            </div>
          )}

          {step === 'rendering' && (
            <div className="retro-dialogue-create-v3-generator">
              <div className="retro-dialogue-create-v3-state">
                <div className="loading-spinner retro-dialogue-create-v3-spinner" />
                <h2 className="retro-dialogue-create-v3-state-title">Rendering script audio</h2>
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
