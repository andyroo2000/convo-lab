/**
 * TTS Provider abstraction layer
 * Allows switching between different TTS providers (Google Cloud TTS, Edge TTS, etc.)
 */

export interface TTSOptions {
  text: string;
  voiceId: string;
  languageCode?: string;
  speed?: number; // 0.75 = slow, 1.0 = normal, 1.25 = fast
  pitch?: number; // -50 to +50Hz, negative = deeper, positive = higher
  ssml?: boolean; // Whether text is SSML formatted
}

export interface TTSProvider {
  /**
   * Synthesize speech from text
   * @param options TTS options including text, voice, speed, etc.
   * @returns Audio buffer (MP3 format)
   */
  synthesizeSpeech(options: TTSOptions): Promise<Buffer>;

  /**
   * Get provider name for logging/debugging
   */
  getName(): string;
}

/**
 * Factory function to get the TTS provider
 * @returns GoogleTTSProvider instance
 */
export async function getTTSProvider(): Promise<TTSProvider> {
  // Lazy load Google TTS provider
  const { GoogleTTSProvider } = await import('./GoogleTTSProvider.js');
  return new GoogleTTSProvider();
}
