/**
 * Voice ID mappings between Google Cloud TTS and Edge TTS
 * Maps Google Cloud voice IDs to their Edge TTS equivalents
 */

export const GOOGLE_TO_EDGE_VOICE_MAPPING: Record<string, string> = {
  // English voices (L1 - Narrator) - Male
  'en-US-Journey-D': 'en-US-AndrewNeural',    // Male, warm and natural
  'en-US-Studio-M': 'en-US-BrianNeural',      // Male, clear and professional
  'en-US-Studio-O': 'en-US-EricNeural',       // Male, deep and authoritative
  'en-US-Wavenet-A': 'en-US-AndrewNeural',    // Male, professional
  'en-US-Wavenet-B': 'en-US-GuyNeural',       // Male, confident
  'en-US-Wavenet-D': 'en-US-BrianNeural',     // Male, clear
  'en-US-Wavenet-I': 'en-US-EricNeural',      // Male, formal
  'en-US-Neural2-A': 'en-US-AndrewNeural',    // Male, warm
  'en-US-Neural2-D': 'en-US-GuyNeural',       // Male, confident
  'en-US-Neural2-I': 'en-US-BrianNeural',     // Male, clear
  'en-US-Neural2-J': 'en-US-EricNeural',      // Male, authoritative

  // English voices (L1 - Narrator) - Female
  'en-US-Journey-F': 'en-US-JennyNeural',     // Female, pleasant
  'en-US-Wavenet-C': 'en-US-JennyNeural',     // Female, pleasant
  'en-US-Wavenet-E': 'en-US-AriaNeural',      // Female, confident
  'en-US-Wavenet-F': 'en-US-MichelleNeural',  // Female, warm
  'en-US-Wavenet-G': 'en-US-SaraNeural',      // Female, calm
  'en-US-Neural2-C': 'en-US-JennyNeural',     // Female, pleasant
  'en-US-Neural2-E': 'en-US-AriaNeural',      // Female, confident
  'en-US-Neural2-F': 'en-US-JennyNeural',     // Female, pleasant
  'en-US-Neural2-G': 'en-US-SaraNeural',      // Female, calm
  'en-US-Neural2-H': 'en-US-AriaNeural',      // Female, confident

  // Japanese voices (L2 - Dialogue speakers)
  // Female voices (adult)
  'ja-JP-Neural2-B': 'ja-JP-NanamiNeural',  // Female, bright, cheerful
  'ja-JP-Wavenet-A': 'ja-JP-NanamiNeural',  // Female, fallback
  'ja-JP-Wavenet-D': 'ja-JP-ShioriNeural',  // Female, calm
  'ja-JP-Studio-B': 'ja-JP-MayuNeural',     // Female, animated

  // Male voices (adult)
  'ja-JP-Neural2-C': 'ja-JP-DaichiNeural',  // Male (changed from KeitaNeural - sounded like child)
  'ja-JP-Neural2-D': 'ja-JP-MasaruMultilingualNeural',  // Male, warm
  'ja-JP-Wavenet-B': 'ja-JP-DaichiNeural',  // Male, fallback
  'ja-JP-Wavenet-C': 'ja-JP-NaokiNeural',   // Male, clear
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
