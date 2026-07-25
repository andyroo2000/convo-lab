import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, EyeOff, Mic, Play, Square } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useEpisodes } from '../hooks/useEpisodes';
import { Episode, Sentence } from '../types';

const PracticePage = () => {
  const { episodeId } = useParams<{ episodeId: string }>();
  const { getEpisode } = useEpisodes();
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [lineIndex, setLineIndex] = useState(0);
  const [showTranslation, setShowTranslation] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingURL, setRecordingURL] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const stopLineTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!episodeId) {
      setError('No practice episode was selected.');
      return undefined;
    }
    let active = true;
    getEpisode(episodeId)
      .then((result) => {
        if (active) setEpisode(result);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to load practice.');
      });
    return () => {
      active = false;
    };
  }, [episodeId, getEpisode]);

  useEffect(
    () => () => {
      if (recordingURL) URL.revokeObjectURL(recordingURL);
      if (stopLineTimerRef.current !== null) window.clearTimeout(stopLineTimerRef.current);
      mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    },
    [recordingURL]
  );

  const lines = useMemo(
    () => [...(episode?.dialogue?.sentences ?? [])].sort((a, b) => a.order - b.order),
    [episode]
  );
  const line = lines[lineIndex];
  const speaker = episode?.dialogue?.speakers.find((item) => item.id === line?.speakerId);

  const resetLine = (nextIndex: number) => {
    audioRef.current?.pause();
    if (stopLineTimerRef.current !== null) {
      window.clearTimeout(stopLineTimerRef.current);
      stopLineTimerRef.current = null;
    }
    setLineIndex(nextIndex);
    setShowTranslation(false);
    if (recordingURL) URL.revokeObjectURL(recordingURL);
    setRecordingURL(null);
  };

  const playLine = (sentence: Sentence) => {
    const audio = audioRef.current;
    if (!audio || !episode) return;
    let source = sentence.audioUrl;
    let startMilliseconds = 0;
    let endMilliseconds: number | undefined;
    if (!source && episode.audioUrl_0_85) {
      source = episode.audioUrl_0_85;
      startMilliseconds = sentence.startTime_0_85 ?? sentence.startTime ?? 0;
      endMilliseconds = sentence.endTime_0_85 ?? sentence.endTime;
    } else if (!source && episode.audioUrl_1_0) {
      source = episode.audioUrl_1_0;
      startMilliseconds = sentence.startTime_1_0 ?? sentence.startTime ?? 0;
      endMilliseconds = sentence.endTime_1_0 ?? sentence.endTime;
    } else if (!source && episode.audioUrl) {
      source = episode.audioUrl;
      startMilliseconds = sentence.startTime ?? sentence.startTime_1_0 ?? 0;
      endMilliseconds = sentence.endTime ?? sentence.endTime_1_0;
    } else if (!source && episode.audioUrl_0_7) {
      source = episode.audioUrl_0_7;
      startMilliseconds = sentence.startTime_0_7 ?? sentence.startTime ?? 0;
      endMilliseconds = sentence.endTime_0_7 ?? sentence.endTime;
    }
    if (!source) {
      setError('Audio has not been generated for this line yet.');
      return;
    }
    if (audio.src !== new URL(source, window.location.origin).href) {
      audio.src = source;
    }
    const start = startMilliseconds / 1000;
    const end = endMilliseconds === undefined ? undefined : endMilliseconds / 1000;
    audio.currentTime = start;
    audio.play().catch(() => {
      setError('Audio playback was blocked. Tap Play line to try again.');
    });
    if (stopLineTimerRef.current !== null) window.clearTimeout(stopLineTimerRef.current);
    if (end && end > start) {
      stopLineTimerRef.current = window.setTimeout(
        () => {
          audio.pause();
        },
        (end - start) * 1000
      );
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordingChunksRef.current = [];
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      });
      recorder.addEventListener('stop', () => {
        const blob = new Blob(recordingChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        if (recordingURL) URL.revokeObjectURL(recordingURL);
        setRecordingURL(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
      });
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setError(null);
    } catch {
      setError('Microphone access is required to record your response.');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  };

  if (error && !episode) {
    return (
      <div className="card" role="alert">
        <h1 className="text-3xl font-bold text-navy mb-4">Practice Mode</h1>
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  if (!episode || !line) {
    return (
      <div className="card text-center py-12">
        <h1 className="text-3xl font-bold text-navy mb-4">Practice Mode</h1>
        <p className="text-gray-600">
          {episode ? 'This episode has no dialogue lines to practice.' : 'Loading practice…'}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <header>
        <p className="retro-caps text-sm text-[rgba(20,50,86,0.65)]">{episode.title}</p>
        <h1 className="retro-headline text-5xl text-navy">Practice Mode</h1>
        <p className="text-[rgba(20,50,86,0.72)]">
          Listen, speak, and compare. Your recording stays in this browser tab.
        </p>
      </header>

      <section className="retro-paper-panel border-2 border-[rgba(20,50,86,0.14)] p-5 sm:p-7 space-y-6">
        <div className="flex justify-between text-sm retro-caps text-[rgba(20,50,86,0.64)]">
          <span>{speaker?.name ?? 'Speaker'}</span>
          <span>
            {lineIndex + 1} / {lines.length}
          </span>
        </div>

        <div className="min-h-36 flex flex-col justify-center text-center gap-3">
          <p className="text-3xl sm:text-5xl font-black text-navy leading-tight">{line.text}</p>
          {line.metadata?.japanese?.kana && (
            <p className="text-xl text-[rgba(20,50,86,0.62)]">{line.metadata.japanese.kana}</p>
          )}
          {showTranslation && (
            <p className="text-xl text-[rgba(20,50,86,0.78)]">{line.translation}</p>
          )}
        </div>

        {error && <p className="text-red-700 text-center">{error}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button type="button" className="btn-secondary" onClick={() => playLine(line)}>
            <Play className="w-4 h-4" aria-hidden="true" /> Hear line
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setShowTranslation((value) => !value)}
          >
            {showTranslation ? (
              <EyeOff className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Eye className="w-4 h-4" aria-hidden="true" />
            )}
            {showTranslation ? 'Hide meaning' : 'Show meaning'}
          </button>
          <button
            type="button"
            className={recording ? 'btn-danger' : 'btn-primary'}
            onClick={recording ? stopRecording : startRecording}
          >
            {recording ? (
              <Square className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Mic className="w-4 h-4" aria-hidden="true" />
            )}
            {recording ? 'Stop recording' : 'Record myself'}
          </button>
        </div>

        {recordingURL && (
          <div className="p-4 bg-[rgba(20,141,189,0.12)]">
            <p className="retro-caps text-sm mb-2">Your take</p>
            <audio controls src={recordingURL} className="w-full">
              <track kind="captions" />
            </audio>
          </div>
        )}

        <div className="flex justify-between">
          <button
            type="button"
            className="btn-secondary"
            disabled={lineIndex === 0}
            onClick={() => resetLine(lineIndex - 1)}
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Previous
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={lineIndex === lines.length - 1}
            onClick={() => resetLine(lineIndex + 1)}
          >
            Next <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </section>
      <audio ref={audioRef} className="hidden" data-testid="practice-source-audio">
        <track kind="captions" />
      </audio>
    </div>
  );
};

export default PracticePage;
