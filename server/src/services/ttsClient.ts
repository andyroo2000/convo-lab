import { getTTSProvider } from './ttsProviders/TTSProvider.js';

export interface TTSOptions {
  text: string;
  voiceId: string;
  languageCode: string;
  speed?: number;
  pitch?: number;
  useSSML?: boolean;
  useDraftMode?: boolean; // NEW: Use Edge TTS instead of Google Cloud TTS
}

export async function synthesizeSpeech(options: TTSOptions): Promise<Buffer> {
  const {
    text,
    voiceId,
    languageCode,
    speed = 1.0,
    useSSML = false,
    useDraftMode = false,
  } = options;

  try {
    // Get the appropriate TTS provider based on draft mode setting
    const provider = await getTTSProvider(useDraftMode);

    console.log(`[TTS] Using provider: ${provider.getName()} for voice: ${voiceId}`);

    // Synthesize speech using the selected provider
    const audioBuffer = await provider.synthesizeSpeech({
      text,
      voiceId,
      languageCode,
      speed,
      ssml: useSSML,
    });

    return audioBuffer;
  } catch (error) {
    console.error('TTS error:', error);
    throw new Error('Failed to synthesize speech');
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
export async function generateSilence(durationSeconds: number, useDraftMode: boolean = false): Promise<Buffer> {
  if (useDraftMode) {
    // Edge TTS doesn't handle SSML breaks well, so generate actual silent audio
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const fs = await import('fs/promises');
    const path = await import('path');
    const os = await import('os');

    const execAsync = promisify(exec);

    // Create temp output file
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const outputFile = path.join(tempDir, `silence-${timestamp}-${randomId}.mp3`);

    try {
      // Generate silent MP3 using ffmpeg
      // -f lavfi: use libavfilter virtual input device
      // -i anullsrc: generate silent audio
      // -t: duration in seconds
      const command = `ffmpeg -f lavfi -i anullsrc=r=44100:cl=stereo -t ${durationSeconds} -q:a 9 -acodec libmp3lame ${outputFile}`;

      await execAsync(command, { timeout: 10000 });

      // Read the generated silence file
      const silenceBuffer = await fs.readFile(outputFile);

      // Clean up
      await fs.unlink(outputFile).catch(() => {});

      return silenceBuffer;
    } catch (error) {
      // Clean up on error
      try {
        await fs.unlink(outputFile);
      } catch (e) {
        // Ignore cleanup errors
      }
      console.error('Failed to generate silence with ffmpeg:', error);
      throw new Error(`Failed to generate silence: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  } else {
    // Google TTS handles SSML breaks well
    const ssml = `<speak><break time="${durationSeconds}s"/></speak>`;

    return synthesizeSpeech({
      text: ssml,
      voiceId: 'en-US-Neural2-D', // Voice doesn't matter for silence
      languageCode: 'en-US',
      useSSML: true,
      useDraftMode: false,
    });
  }
}
