import type { DailyAudioPractice } from '../types';

export default function playableDrill(practice: DailyAudioPractice) {
  return practice.tracks.find(
    (track) => track.mode === 'drill' && track.status === 'ready' && track.audioUrl
  );
}
