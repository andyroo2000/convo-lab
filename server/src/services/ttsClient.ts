import textToSpeech from '@google-cloud/text-to-speech';
import { protos } from '@google-cloud/text-to-speech';

const client = new textToSpeech.TextToSpeechClient();

type IAudioConfig = protos.google.cloud.texttospeech.v1.IAudioConfig;
type ISynthesisInput = protos.google.cloud.texttospeech.v1.ISynthesisInput;
type IVoiceSelectionParams = protos.google.cloud.texttospeech.v1.IVoiceSelectionParams;

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
    const request = {
      input: (useSSML
        ? { ssml: text }
        : { text }) as ISynthesisInput,
      voice: {
        languageCode,
        name: voiceId,
      } as IVoiceSelectionParams,
      audioConfig: {
        audioEncoding: 'MP3' as const,
        speakingRate: speed,
        pitch,
        effectsProfileId: ['headphone-class-device'],
      } as IAudioConfig,
    };

    const [response] = await client.synthesizeSpeech(request);

    if (!response.audioContent) {
      throw new Error('No audio content received from TTS');
    }

    return Buffer.from(response.audioContent as Uint8Array);
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
