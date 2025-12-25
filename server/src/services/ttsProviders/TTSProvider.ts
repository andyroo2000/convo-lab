/**
 * TTS Provider abstraction layer
 * Allows switching between different TTS providers (Google Cloud TTS, Edge TTS, etc.)
 */

import type { TTSProvider } from './types.js';

// Re-export types for backward compatibility
export type { TTSOptions, TTSProvider } from './types.js';

/**
 * Factory function to get the TTS provider
 * @returns GoogleTTSProvider instance
 */
export async function getTTSProvider(): Promise<TTSProvider> {
  // Lazy load Google TTS provider
  const { GoogleTTSProvider } = await import('./GoogleTTSProvider.js');
  return new GoogleTTSProvider();
}
