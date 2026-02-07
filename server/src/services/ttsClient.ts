import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

import { getTTSProvider } from './ttsProviders/TTSProvider.js';

const execFileAsync = promisify(execFile);

export interface TTSOptions {
  text: string;
  voiceId: string;
  languageCode: string;
  speed?: number;
  pitch?: number;
  useSSML?: boolean;
}

export async function synthesizeSpeech(options: TTSOptions): Promise<Buffer> {
  const { text, voiceId, languageCode, speed = 1.0, pitch = 0, useSSML = false } = options;

  try {
    // Get the Google TTS provider
    const provider = await getTTSProvider();

    // eslint-disable-next-line no-console
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
      console.error(
        `[TTS] Empty audio buffer returned for voice: ${voiceId}, text: "${text.substring(0, 50)}..."`
      );
      throw new Error('TTS returned empty audio buffer');
    }

    // eslint-disable-next-line no-console
    console.log(`[TTS] Generated ${audioBuffer.length} bytes for voice: ${voiceId}`);
    return audioBuffer;
  } catch (error) {
    console.error('TTS error:', error);
    // Preserve the original error message for better debugging
    const errorMsg = error instanceof Error ? error.message : 'Unknown TTS error';
    throw new Error(`Failed to synthesize speech: ${errorMsg}`);
  }
}

export function createSSMLWithPauses(text: string, pauseDuration: string = '1s'): string {
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
 * Uses ffmpeg locally to produce silence with the same encoding parameters as
 * ElevenLabs (44100 Hz, stereo, 128 kbps MP3) so concat has no format mismatch.
 */
export async function generateSilence(durationSeconds: number): Promise<Buffer> {
  const tmpDir = os.tmpdir();
  const silencePath = path.join(
    tmpDir,
    `silence-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`
  );
  try {
    await execFileAsync('ffmpeg', [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'anullsrc=r=44100:cl=stereo',
      '-ac',
      '2',
      '-ar',
      '44100',
      '-t',
      String(durationSeconds),
      '-c:a',
      'libmp3lame',
      '-b:a',
      '128k',
      silencePath,
    ]);
    return await fs.readFile(silencePath);
  } finally {
    await fs.unlink(silencePath).catch(() => {});
  }
}
