import { TextToSpeechClient, protos } from '@google-cloud/text-to-speech';
import { TTSProvider, TTSOptions } from './TTSProvider.js';

type IAudioConfig = protos.google.cloud.texttospeech.v1.IAudioConfig;
type ISynthesisInput = protos.google.cloud.texttospeech.v1.ISynthesisInput;
type IVoiceSelectionParams = protos.google.cloud.texttospeech.v1.IVoiceSelectionParams;

/**
 * Google Cloud Text-to-Speech provider
 * Production-quality TTS with high fidelity voices
 */
export class GoogleTTSProvider implements TTSProvider {
  private client: TextToSpeechClient;

  constructor() {
    this.client = new TextToSpeechClient();
  }

  getName(): string {
    return 'Google Cloud TTS';
  }

  async synthesizeSpeech(options: TTSOptions): Promise<Buffer> {
    const {
      text,
      voiceId,
      languageCode,
      speed = 1.0,
      ssml = false,
    } = options;

    // Extract language code from voice ID if not provided
    const lang = languageCode || this.extractLanguageCode(voiceId);

    try {
      const request = {
        input: (ssml
          ? { ssml: text }
          : { text }) as ISynthesisInput,
        voice: {
          languageCode: lang,
          name: voiceId,
        } as IVoiceSelectionParams,
        audioConfig: {
          audioEncoding: 'MP3' as const,
          speakingRate: speed,
          pitch: 0,
          effectsProfileId: ['headphone-class-device'],
        } as IAudioConfig,
      };

      const [response] = await this.client.synthesizeSpeech(request);

      if (!response.audioContent) {
        throw new Error('No audio content received from Google Cloud TTS');
      }

      return Buffer.from(response.audioContent as Uint8Array);
    } catch (error) {
      console.error('Google Cloud TTS error:', error);
      throw new Error('Failed to synthesize speech with Google Cloud TTS');
    }
  }

  /**
   * Extract language code from voice ID
   * e.g., "ja-JP-Neural2-B" -> "ja-JP"
   */
  private extractLanguageCode(voiceId: string): string {
    const match = voiceId.match(/^([a-z]{2}-[A-Z]{2})/);
    return match ? match[1] : 'en-US';
  }
}
