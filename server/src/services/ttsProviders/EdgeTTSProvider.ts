import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { TTSProvider, TTSOptions } from './TTSProvider.js';
import { getEdgeVoiceId } from '../../config/voiceMapping.js';

const execAsync = promisify(exec);

/**
 * Edge TTS provider (Microsoft Edge Read Aloud)
 * Free, high-quality TTS for draft mode
 */
export class EdgeTTSProvider implements TTSProvider {
  getName(): string {
    return 'Edge TTS (Draft Mode)';
  }

  async synthesizeSpeech(options: TTSOptions): Promise<Buffer> {
    const {
      text,
      voiceId,
      languageCode,
      speed = 1.0,
      ssml = false,
    } = options;

    // Map Google voice ID to Edge voice ID
    const edgeVoiceId = getEdgeVoiceId(voiceId, languageCode);

    // Convert speed to Edge TTS rate format
    // speed 1.0 -> +0%, 0.75 -> -25%, 1.25 -> +25%
    const ratePercent = Math.round((speed - 1.0) * 100);
    const rateParam = `${ratePercent >= 0 ? '+' : ''}${ratePercent}%`;

    // Create temporary files for input and output
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const inputFile = path.join(tempDir, `edge-tts-input-${timestamp}-${randomId}.txt`);
    const outputFile = path.join(tempDir, `edge-tts-output-${timestamp}-${randomId}.mp3`);

    try {
      // Strip SSML tags if present (Edge TTS CLI handles plain text better)
      const plainText = ssml ? this.stripSSML(text) : text;

      // Write input text to temp file
      await fs.writeFile(inputFile, plainText, 'utf-8');

      // Build edge-tts command
      const command = [
        'edge-tts',
        `--voice ${edgeVoiceId}`,
        `--rate=${rateParam}`,
        `--file ${inputFile}`,
        `--write-media ${outputFile}`,
      ].join(' ');

      console.log(`[EdgeTTS] Synthesizing with voice: ${edgeVoiceId}, rate: ${rateParam}`);

      // Execute edge-tts
      await execAsync(command, {
        timeout: 30000, // 30 second timeout
      });

      // Read the generated audio file
      const audioBuffer = await fs.readFile(outputFile);

      // Clean up temp files
      await Promise.all([
        fs.unlink(inputFile).catch(() => {}),
        fs.unlink(outputFile).catch(() => {}),
      ]);

      console.log(`[EdgeTTS] Successfully generated ${audioBuffer.length} bytes`);
      return audioBuffer;

    } catch (error) {
      // Clean up temp files on error
      await Promise.all([
        fs.unlink(inputFile).catch(() => {}),
        fs.unlink(outputFile).catch(() => {}),
      ]);

      console.error('Edge TTS error:', error);
      throw new Error(`Failed to synthesize speech with Edge TTS: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Strip SSML tags to convert to plain text
   * Edge TTS CLI works better with plain text
   */
  private stripSSML(ssml: string): string {
    return ssml
      .replace(/<speak>/g, '')
      .replace(/<\/speak>/g, '')
      .replace(/<break\s+time="[^"]*"\s*\/>/g, ' ') // Convert breaks to spaces
      .replace(/<prosody[^>]*>/g, '')
      .replace(/<\/prosody>/g, '')
      .replace(/<mark[^>]*\/>/g, '')
      .trim();
  }
}
