import type { AudioSpeed, Episode } from '../types';

export function hasAllPlaybackSpeeds(episode: Episode): boolean {
  return [episode.audioUrl_0_7, episode.audioUrl_0_85, episode.audioUrl_1_0].every(Boolean);
}

export function getPlaybackAudioUrl(
  episode: Episode,
  selectedSpeed: AudioSpeed
): string | undefined {
  if (!hasAllPlaybackSpeeds(episode)) return episode.audioUrl;

  const audioUrlBySpeed: Record<AudioSpeed, string | undefined> = {
    slow: episode.audioUrl_0_7,
    medium: episode.audioUrl_0_85,
    normal: episode.audioUrl_1_0,
  };
  return audioUrlBySpeed[selectedSpeed];
}
