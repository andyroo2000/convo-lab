import { useEffect, useState, type SyntheticEvent } from 'react';
import useJournalSpacebar from './useJournalSpacebar';
import focusJournalAudio from './journalPlayback';
import { claimJournalAudio, isCurrentJournalAudio } from './journalAudioIntent';
import { useJournalPlayback } from './useJournalPlayback';
import useTimedRecording, { type RecordingLoader } from './useTimedRecording';

export default function useJournalPlayer(load: RecordingLoader) {
  const playback = useJournalPlayback();
  const recording = useTimedRecording(load);
  useJournalSpacebar(playback.player);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const { player, setSentences, setPosition, setEngaged } = playback;
  useEffect(() => {
    setSentences(recording.recording?.data.sentences ?? []);
    setPosition(0);
    setEngaged(false);
    const audio = player.current;
    return () => {
      audio?.pause();
    };
  }, [recording.recording, player, setSentences, setPosition, setEngaged]);
  async function play() {
    try {
      await player.current?.play();
    } catch {
      recording.setError('Audio could not be played. Try again.');
    }
  }
  function restartIfFinished() {
    if (duration <= 0 || playback.position < duration) return;
    const audio = player.current;
    if (audio) audio.currentTime = 0;
    setPosition(0);
  }
  const toggle = () => {
    if (!recording.recording) {
      recording.prepare().catch(() => undefined);
      return;
    }
    if (playing) {
      player.current?.pause();
      return;
    }
    claimJournalAudio();
    restartIfFinished();
    play().catch(() => undefined);
  };
  const media = {
    onLoadedMetadata() {
      const value = player.current?.duration ?? 0;
      setDuration(Number.isFinite(value) ? value : 0);
      if (isCurrentJournalAudio(recording.recording?.intent ?? -1)) play().catch(() => undefined);
    },
    onTimeUpdate() {
      setPosition(player.current?.currentTime ?? 0);
    },
    onPlay() {
      if (player.current) focusJournalAudio(player.current);
      setPlaying(true);
      setEngaged(true);
    },
    onPause() {
      setPlaying(false);
      setEngaged(false);
    },
    onEnded(event: SyntheticEvent<HTMLAudioElement>) {
      setPlaying(false);
      setEngaged(false);
      const finalDuration = event.currentTarget.duration;
      if (Number.isFinite(finalDuration) && finalDuration > 0) {
        setDuration(finalDuration);
        setPosition(finalDuration);
      }
    },
    onError() {
      recording.setError('Audio could not be played. Try again.');
    },
  };
  return { ...recording, playback, playing, duration, toggle, media };
}
