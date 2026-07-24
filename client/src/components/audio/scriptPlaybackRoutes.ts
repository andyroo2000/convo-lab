import type { AudioScriptRender, AudioScriptSegment } from '../../types';
import { createScriptApiContract } from '../../lib/scriptApi';
import { versionAudioUrl } from './scriptTrackTiming';

export function getSegmentImageUrl(segment: AudioScriptSegment | null): string | null {
  if (!segment) return null;
  const mediaId = segment.imageMedia?.id || segment.imageMediaId;
  if (mediaId) {
    return createScriptApiContract().media(mediaId);
  }
  if (segment.imageMedia?.publicUrl) return segment.imageMedia.publicUrl;
  return null;
}

export function resolveScriptAudioUrl(
  episodeId: string,
  scriptRender: AudioScriptRender | null
): string | null {
  if (!scriptRender?.audioUrl) return null;

  return versionAudioUrl(
    createScriptApiContract().audio(episodeId, scriptRender.id),
    scriptRender.updatedAt?.toString()
  );
}

export function resolveScriptAudioUrls(
  episodeId: string,
  scriptRenders: AudioScriptRender[]
): string[] {
  return scriptRenders
    .map((scriptRender) => resolveScriptAudioUrl(episodeId, scriptRender))
    .filter((url): url is string => url !== null);
}
