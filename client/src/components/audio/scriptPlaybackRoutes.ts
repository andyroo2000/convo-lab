import { LEARNING_OS_DIRECT_SCRIPT_API_ENABLED } from '../../config';
import type { AudioScriptRender, AudioScriptSegment } from '../../types';
import { createScriptApiContract } from '../../lib/scriptApi';
import { toAssetUrl } from '../study/studyCardUtils';
import { versionAudioUrl } from './scriptTrackTiming';

export function getSegmentImageUrl(
  segment: AudioScriptSegment | null,
  directLearningOs: boolean = LEARNING_OS_DIRECT_SCRIPT_API_ENABLED
): string | null {
  if (!segment) return null;
  const mediaId = segment.imageMedia?.id || segment.imageMediaId;
  if (directLearningOs && mediaId) {
    return toAssetUrl(createScriptApiContract(true).media(mediaId));
  }
  if (segment.imageMedia?.publicUrl) return toAssetUrl(segment.imageMedia.publicUrl);
  return mediaId ? toAssetUrl(createScriptApiContract(false).media(mediaId)) : null;
}

export function resolveScriptAudioUrl(
  episodeId: string,
  scriptRender: AudioScriptRender | null,
  directLearningOs: boolean = LEARNING_OS_DIRECT_SCRIPT_API_ENABLED
): string | null {
  if (!scriptRender?.audioUrl) return null;

  return versionAudioUrl(
    directLearningOs
      ? createScriptApiContract(true).audio(episodeId, scriptRender.id)
      : scriptRender.audioUrl,
    scriptRender.updatedAt?.toString()
  );
}
