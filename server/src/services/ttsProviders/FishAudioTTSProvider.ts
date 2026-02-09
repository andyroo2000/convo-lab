import { FishAudioClient, type Backends } from 'fish-audio';

const FISH_AUDIO_MAX_CHARS = 15000;
// Default to s1 (flagship model with best quality); override via FISH_AUDIO_BACKEND if needed.
const FISH_AUDIO_MODEL = process.env.FISH_AUDIO_BACKEND || 's1';

let client: FishAudioClient | null = null;

function getClient(): FishAudioClient {
  if (client) return client;

  const apiKey = process.env.FISH_AUDIO_API_KEY;
  if (!apiKey) {
    throw new Error('Missing FISH_AUDIO_API_KEY environment variable');
  }

  client = new FishAudioClient({ apiKey });
  return client;
}

/**
 * Check whether Fish Audio is available (API key is configured).
 * Used by routing logic to fall back to other providers when not configured.
 */
export function isFishAudioAvailable(): boolean {
  return !!process.env.FISH_AUDIO_API_KEY;
}

/**
 * Strip the "fishaudio:" prefix from a voice ID to get the Fish Audio model UUID.
 */
export function resolveFishAudioVoiceId(voiceId: string): string {
  return voiceId.replace(/^fishaudio:/, '');
}

/**
 * Synthesize speech using Fish Audio TTS.
 *
 * Returns an MP3 audio buffer. Speed is handled natively by the API
 * via the prosody.speed parameter (no ffmpeg post-processing needed).
 */
export async function synthesizeFishAudioSpeech(options: {
  referenceId: string;
  text: string;
  speed?: number;
  normalize?: boolean;
}): Promise<Buffer> {
  const { referenceId, text, speed = 1.0, normalize } = options;

  if (text.length > FISH_AUDIO_MAX_CHARS) {
    throw new Error(
      `Fish Audio text exceeds ${FISH_AUDIO_MAX_CHARS} char limit: ${text.length} chars`
    );
  }

  const fishClient = getClient();
  const request: {
    text: string;
    reference_id: string;
    format: 'mp3';
    mp3_bitrate: 128;
    sample_rate: number;
    prosody: { speed: number; volume: number };
    normalize?: boolean;
  } = {
    text,
    reference_id: referenceId,
    format: 'mp3' as const,
    mp3_bitrate: 128 as const,
    sample_rate: 44100,
    prosody: { speed, volume: 0 },
  };

  if (typeof normalize === 'boolean') {
    request.normalize = normalize;
  }

  const audio = await fishClient.textToSpeech.convert(request, FISH_AUDIO_MODEL as Backends);

  // The SDK returns a ReadableStream<Uint8Array> - collect chunks into a Buffer
  try {
    const chunks: Uint8Array[] = [];
    const reader = audio.getReader();

    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (done || !result.value) break;
      chunks.push(result.value);
    }

    return Buffer.concat(chunks);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Fish Audio stream read failed for ref=${referenceId}: ${message}`);
  }
}
