/**
 * Voice ID mappings between Google Cloud TTS and Edge TTS
 * Maps Google Cloud voice IDs to their Edge TTS equivalents
 */

export const GOOGLE_TO_EDGE_VOICE_MAPPING: Record<string, string> = {
  // English voices (L1 - Narrator)
  'en-US-Journey-D': 'en-US-AndrewNeural', // Male, confident, warm (closest to Journey)
  'en-US-Neural2-D': 'en-US-AndrewNeural',
  'en-US-Neural2-A': 'en-US-JennyNeural', // Female alternative

  // Japanese voices (L2 - Dialogue speakers)
  'ja-JP-Neural2-B': 'ja-JP-NanamiNeural',  // Female, bright, cheerful
  'ja-JP-Neural2-C': 'ja-JP-DaichiNeural',  // Male (changed from KeitaNeural - sounded like child)
  'ja-JP-Neural2-D': 'ja-JP-DaichiNeural',  // Male (changed from AoiNeural which was female)
  'ja-JP-Wavenet-A': 'ja-JP-NanamiNeural',  // Fallback for older Wavenet voices
  'ja-JP-Wavenet-B': 'ja-JP-DaichiNeural',  // Male (changed from KeitaNeural - sounded like child)
  'ja-JP-Wavenet-C': 'ja-JP-DaichiNeural',  // Male
  'ja-JP-Wavenet-D': 'ja-JP-ShioriNeural',  // Female
};

/**
 * Default Edge TTS voice for a given language code
 * Used as fallback if specific voice mapping not found
 */
export const DEFAULT_EDGE_VOICES: Record<string, string> = {
  'en': 'en-US-AndrewNeural',
  'en-US': 'en-US-AndrewNeural',
  'ja': 'ja-JP-NanamiNeural',
  'ja-JP': 'ja-JP-NanamiNeural',
  'zh': 'zh-CN-XiaoxiaoNeural',
  'zh-CN': 'zh-CN-XiaoxiaoNeural',
  'es': 'es-ES-AlvaroNeural',
  'es-ES': 'es-ES-AlvaroNeural',
  'fr': 'fr-FR-DeniseNeural',
  'fr-FR': 'fr-FR-DeniseNeural',
};

/**
 * Get the Edge TTS voice ID for a given Google Cloud TTS voice ID
 * @param googleVoiceId The Google Cloud TTS voice ID
 * @param languageCode Fallback language code if voice mapping not found
 * @returns Edge TTS voice ID
 */
export function getEdgeVoiceId(googleVoiceId: string, languageCode?: string): string {
  // Try direct mapping first
  const edgeVoiceId = GOOGLE_TO_EDGE_VOICE_MAPPING[googleVoiceId];
  if (edgeVoiceId) {
    return edgeVoiceId;
  }

  // Try extracting language code from Google voice ID (e.g., "ja-JP-Neural2-B" -> "ja-JP")
  const langMatch = googleVoiceId.match(/^([a-z]{2}-[A-Z]{2})/);
  if (langMatch && DEFAULT_EDGE_VOICES[langMatch[1]]) {
    console.warn(`No direct voice mapping found for ${googleVoiceId}, using default for ${langMatch[1]}`);
    return DEFAULT_EDGE_VOICES[langMatch[1]];
  }

  // Use fallback language code if provided
  if (languageCode && DEFAULT_EDGE_VOICES[languageCode]) {
    console.warn(`No voice mapping found for ${googleVoiceId}, using default for ${languageCode}`);
    return DEFAULT_EDGE_VOICES[languageCode];
  }

  // Last resort: return English
  console.error(`No voice mapping found for ${googleVoiceId}, falling back to en-US-AndrewNeural`);
  return 'en-US-AndrewNeural';
}
