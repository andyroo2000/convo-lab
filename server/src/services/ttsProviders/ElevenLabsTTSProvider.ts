export interface ElevenLabsAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

export interface ElevenLabsTTSResponse {
  audio_base64: string;
  alignment?: ElevenLabsAlignment;
  normalized_alignment?: ElevenLabsAlignment;
}

const ELEVENLABS_BASE_URL = process.env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io/v1';
const ELEVENLABS_MODEL_ID = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
const ELEVENLABS_VOICE_CACHE_TTL_MS = 5 * 60 * 1000;

let cachedVoices: { fetchedAt: number; voices: Map<string, string> } | null = null;

function getApiKey(): string {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ELEVENLABS_API_KEY environment variable');
  }
  return apiKey;
}

function isLikelyElevenLabsId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function fetchElevenLabsVoices(): Promise<Map<string, string>> {
  const apiKey = getApiKey();
  const response = await fetch(`${ELEVENLABS_BASE_URL}/voices`, {
    headers: {
      'xi-api-key': apiKey,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`ElevenLabs voice list failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as { voices?: Array<{ voice_id: string; name: string }> };
  const voiceMap = new Map<string, string>();

  for (const voice of data.voices || []) {
    if (!voice?.voice_id || !voice?.name) continue;
    voiceMap.set(voice.name.toLowerCase(), voice.voice_id);
  }

  return voiceMap;
}

async function getVoiceCache(): Promise<Map<string, string>> {
  const now = Date.now();
  if (cachedVoices && now - cachedVoices.fetchedAt < ELEVENLABS_VOICE_CACHE_TTL_MS) {
    return cachedVoices.voices;
  }

  const voices = await fetchElevenLabsVoices();
  cachedVoices = { fetchedAt: now, voices };
  return voices;
}

export async function resolveElevenLabsVoiceId(voiceIdOrName: string): Promise<string> {
  const voices = await getVoiceCache();

  // Accept explicit voice IDs (ElevenLabs IDs are not UUIDs, so check the values we fetched).
  for (const voiceId of voices.values()) {
    if (voiceId === voiceIdOrName) {
      return voiceId;
    }
  }

  const normalized = voiceIdOrName.toLowerCase();
  const exact = voices.get(normalized);
  if (exact) {
    return exact;
  }

  // Fallback: match by prefix to handle configured shorthand names like "Spuds Oxley".
  for (const [name, voiceId] of voices.entries()) {
    if (name.startsWith(normalized)) {
      return voiceId;
    }
  }

  // Legacy UUID-like IDs (if any) still pass through.
  if (isLikelyElevenLabsId(voiceIdOrName)) {
    return voiceIdOrName;
  }

  throw new Error(`ElevenLabs voice not found: ${voiceIdOrName}`);
}

export async function synthesizeElevenLabsWithTimestamps(options: {
  voiceId: string;
  text: string;
  languageCode?: string;
  previousText?: string;
}): Promise<{ audioBuffer: Buffer; alignment: ElevenLabsAlignment }> {
  const apiKey = getApiKey();
  const response = await fetch(
    `${ELEVENLABS_BASE_URL}/text-to-speech/${options.voiceId}/with-timestamps`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        text: options.text,
        model_id: ELEVENLABS_MODEL_ID,
        language_code: options.languageCode,
        output_format: 'mp3_44100_128',
        apply_text_normalization: 'off',
        ...(options.previousText ? { previous_text: options.previousText } : {}),
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`ElevenLabs TTS failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as ElevenLabsTTSResponse;
  const alignment = data.alignment || data.normalized_alignment;

  if (!data.audio_base64 || !alignment) {
    throw new Error('ElevenLabs response missing audio or alignment data');
  }

  return {
    audioBuffer: Buffer.from(data.audio_base64, 'base64'),
    alignment,
  };
}
