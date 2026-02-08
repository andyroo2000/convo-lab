import { useState, useRef } from 'react';

interface LineRendering {
  id: string;
  unitIndex: number;
  text: string;
  speed: number;
  voiceId: string;
  audioUrl: string;
  createdAt: string;
}

interface ScriptUnit {
  type: 'narration_L1' | 'L2' | 'pause' | 'marker';
  text?: string;
  reading?: string;
  translation?: string;
  voiceId?: string;
  speed?: number;
}

interface LineTTSTesterProps {
  courseId: string;
  unit: ScriptUnit;
  unitIndex: number;
  renderings: LineRendering[];
  onRenderingCreated: (rendering: LineRendering) => void;
  onRenderingDeleted: (renderingId: string) => void;
}

const SPEED_MIN = 0.5;
const SPEED_MAX = 2.0;
const SPEED_STEP = 0.05;
const SPEED_DEFAULT = 1.0;

const LineTTSTester = ({
  courseId,
  unit,
  unitIndex,
  renderings,
  onRenderingCreated,
  onRenderingDeleted,
}: LineTTSTesterProps) => {
  const [text, setText] = useState(unit.text || '');
  const [speed, setSpeed] = useState(unit.speed || SPEED_DEFAULT);
  const [synthesizing, setSynthesizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const voiceId = unit.voiceId || '';

  const handleSynthesize = async () => {
    if (!text.trim() || !voiceId) return;

    setSynthesizing(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/courses/${courseId}/synthesize-line`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text: text.trim(), voiceId, speed, unitIndex }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Line synthesis failed');
      }

      const data = await res.json();
      onRenderingCreated({
        id: data.renderingId,
        unitIndex,
        text: text.trim(),
        speed,
        voiceId,
        audioUrl: data.audioUrl,
        createdAt: new Date().toISOString(),
      });

      // Auto-play the result
      setPlayingUrl(data.audioUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Line synthesis failed');
    } finally {
      setSynthesizing(false);
    }
  };

  const handlePlay = (url: string) => {
    if (playingUrl === url && audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      setPlayingUrl(null);
    } else {
      setPlayingUrl(url);
    }
  };

  const handleDelete = async (renderingId: string) => {
    try {
      await fetch(`/api/admin/courses/${courseId}/line-renderings/${renderingId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      onRenderingDeleted(renderingId);
    } catch {
      setError('Failed to delete rendering');
    }
  };

  const isFishAudio = voiceId.startsWith('fishaudio:');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-dark-brown">
          Line TTS Tester
          <span className="ml-2 text-xs font-normal text-gray-500">#{unitIndex}</span>
        </h4>
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            unit.type === 'L2' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
          }`}
        >
          {unit.type}
        </span>
      </div>

      {/* Voice Info */}
      <div className="text-xs text-gray-500">
        Voice: <span className="font-mono">{voiceId || 'none'}</span>
      </div>

      {/* Editable Text */}
      <div>
        <span className="block text-xs font-bold text-gray-700 mb-1">Text</span>
        <textarea
          aria-label="Text content"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-coral focus:outline-none text-sm h-24 resize-none"
        />
      </div>

      {/* Speed Slider */}
      <div>
        <label
          htmlFor={`line-speed-${unitIndex}`}
          className="block text-xs font-bold text-gray-700 mb-1"
        >
          Speed: {speed.toFixed(2)}x
        </label>
        <input
          id={`line-speed-${unitIndex}`}
          type="range"
          min={SPEED_MIN}
          max={SPEED_MAX}
          step={SPEED_STEP}
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
          className="w-full accent-coral"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>{SPEED_MIN}x</span>
          <span>{SPEED_DEFAULT}x</span>
          <span>{SPEED_MAX}x</span>
        </div>
      </div>

      {/* Synthesize Button */}
      <button
        type="button"
        onClick={handleSynthesize}
        disabled={synthesizing || !text.trim() || !isFishAudio}
        className="w-full px-4 py-2 bg-coral hover:bg-coral-dark text-white font-bold text-sm rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {synthesizing ? 'Synthesizing...' : 'Synthesize'}
      </button>

      {!isFishAudio && voiceId && (
        <p className="text-xs text-amber-600">
          Only Fish Audio voices are supported for line synthesis.
        </p>
      )}

      {/* Error */}
      {error && (
        <div className="p-2 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs">{error}</div>
      )}

      {/* Audio Player */}
      {playingUrl && (
        <audio
          ref={audioRef}
          src={playingUrl}
          autoPlay
          onEnded={() => setPlayingUrl(null)}
          controls
          className="w-full"
        />
      )}

      {/* Previous Renderings */}
      {renderings.length > 0 && (
        <div>
          <h5 className="text-xs font-bold text-gray-700 mb-2">
            Previous Renderings ({renderings.length})
          </h5>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {renderings.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs"
              >
                <button
                  type="button"
                  onClick={() => handlePlay(r.audioUrl)}
                  className="shrink-0 w-7 h-7 flex items-center justify-center bg-coral text-white rounded-full hover:bg-coral-dark transition-all"
                  title="Play"
                >
                  {playingUrl === r.audioUrl ? (
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="4" width="4" height="16" />
                      <rect x="14" y="4" width="4" height="16" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-gray-700">{r.text}</p>
                  <p className="text-gray-400">{r.speed}x</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(r.id)}
                  className="shrink-0 text-red-400 hover:text-red-600 font-bold px-1"
                  title="Delete"
                >
                  X
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LineTTSTester;
