import { getTTSProvider } from './ttsProviders/TTSProvider.js';

export interface TTSOptions {
  text: string;
  voiceId: string;
  languageCode: string;
  speed?: number;
  pitch?: number;
  useSSML?: boolean;
}

export async function synthesizeSpeech(options: TTSOptions): Promise<Buffer> {
  const {
    text,
    voiceId,
    languageCode,
    speed = 1.0,
    pitch = 0,
    useSSML = false,
  } = options;

  try {
    // Get the Google TTS provider
    const provider = await getTTSProvider();

    console.log(`[TTS] Using provider: ${provider.getName()} for voice: ${voiceId}`);

    // Synthesize speech using the selected provider
    const audioBuffer = await provider.synthesizeSpeech({
      text,
      voiceId,
      languageCode,
      speed,
      pitch,
      ssml: useSSML,
    });

    // Validate the audio buffer
    if (!audioBuffer || audioBuffer.length === 0) {
      console.error(`[TTS] Empty audio buffer returned for voice: ${voiceId}, text: "${text.substring(0, 50)}..."`);
      throw new Error('TTS returned empty audio buffer');
    }

    console.log(`[TTS] Generated ${audioBuffer.length} bytes for voice: ${voiceId}`);
    return audioBuffer;
  } catch (error) {
    console.error('TTS error:', error);
    // Preserve the original error message for better debugging
    const errorMsg = error instanceof Error ? error.message : 'Unknown TTS error';
    throw new Error(`Failed to synthesize speech: ${errorMsg}`);
  }
}

export function createSSMLWithPauses(
  text: string,
  pauseDuration: string = '1s'
): string {
  // Add SSML pauses after each sentence
  return `<speak>${text}<break time="${pauseDuration}"/></speak>`;
}

export function createSSMLSlow(text: string, rate: number = 0.75): string {
  // Slow down speech using SSML
  return `<speak><prosody rate="${rate}">${text}</prosody></speak>`;
}

/**
 * Creates SSML for lesson narration with appropriate pauses
 */
export function createLessonSSML(text: string, pauseAfter: number = 0.5): string {
  return `<speak>${text}<break time="${pauseAfter}s"/></speak>`;
}

/**
 * Creates SSML for anticipation drills (prompt + longer pause for learner response)
 */
export function createAnticipationPromptSSML(text: string): string {
  // Longer pause (3s) for learner to think and respond
  return `<speak>${text}<break time="3s"/></speak>`;
}

/**
 * Generate silence audio buffer (for pause units)
 */
export async function generateSilence(durationSeconds: number): Promise<Buffer> {
  // Google TTS handles SSML breaks well
  const ssml = `<speak><break time="${durationSeconds}s"/></speak>`;

  return synthesizeSpeech({
    text: ssml,
    voiceId: 'en-US-Neural2-D', // Voice doesn't matter for silence
    languageCode: 'en-US',
    useSSML: true,
  });
}
