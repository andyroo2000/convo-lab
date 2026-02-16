import { v1beta1, protos } from '@google-cloud/text-to-speech';

// v1beta1 TimepointType enum value for SSML marks
const { TimepointType } = protos.google.cloud.texttospeech.v1beta1.SynthesizeSpeechRequest;
const { SSML_MARK } = TimepointType;

/**
 * Result from synthesize with timepoints
 */
export interface SynthesizeWithTimepointsResult {
  audioBuffer: Buffer;
  timepoints: Array<{
    markName: string;
    timeSeconds: number;
  }>;
}

/**
 * Options for batched TTS synthesis
 */
export interface TTSBatchOptions {
  ssml: string;
  voiceId: string;
  languageCode: string;
  speed?: number;
  pitch?: number;
}

/**
 * Google Cloud Text-to-Speech v1beta1 provider with SSML mark timepointing
 *
 * Uses the beta API to get precise timestamps for SSML <mark> tags,
 * enabling audio splitting at exact boundaries.
 */
export class GoogleTTSBetaProvider {
  private client: v1beta1.TextToSpeechClient;

  constructor() {
    this.client = new v1beta1.TextToSpeechClient({
      apiEndpoint: 'us-central1-texttospeech.googleapis.com',
    });
  }

  getName(): string {
    return 'Google Cloud TTS (v1beta1 with timepoints)';
  }

  /**
   * Synthesize speech with SSML mark timepointing
   *
   * @param options - TTS options including SSML with <mark> tags
   * @returns Audio buffer and timepoints for each mark
   */
  async synthesizeSpeechWithTimepoints(
    options: TTSBatchOptions
  ): Promise<SynthesizeWithTimepointsResult> {
    const { ssml, voiceId, languageCode, speed = 1.0, pitch = 0 } = options;

    // Convert Hz pitch to semitones (same as GoogleTTSProvider)
    const pitchSemitones = pitch / 3.0;

    // eslint-disable-next-line no-console -- useful diagnostics for production TTS batch debugging
    console.log(`[TTS BATCH] Synthesizing with timepoints: voice=${voiceId}, speed=${speed}`);
    // eslint-disable-next-line no-console -- useful diagnostics for production TTS batch debugging
    console.log(`[TTS BATCH] SSML preview: ${ssml.substring(0, 200)}...`);

    try {
      const request = {
        input: { ssml },
        voice: {
          languageCode,
          name: voiceId,
        },
        audioConfig: {
          audioEncoding: 'MP3' as const,
          speakingRate: speed,
          pitch: pitchSemitones,
        },
        // Enable SSML mark timepointing - this is the key v1beta1 feature
        // SSML_MARK = 1 in the TimepointType enum
        enableTimePointing: [SSML_MARK],
      };

      // eslint-disable-next-line no-console -- useful diagnostics for production TTS batch debugging
      console.log(`[TTS BATCH] Request:`, JSON.stringify(request, null, 2));

      const [response] = await this.client.synthesizeSpeech(request);

      if (!response.audioContent) {
        throw new Error('No audio content received from Google Cloud TTS v1beta1');
      }

      // Extract timepoints from response
      const timepoints = (response.timepoints || []).map(
        (tp: { markName?: string | null; timeSeconds?: number | null }) => ({
          markName: tp.markName || '',
          timeSeconds: tp.timeSeconds || 0,
        })
      );

      // Validate we got timepoints back
      if (timepoints.length === 0) {
        throw new Error(
          'v1beta1 API did not return timepoints. ' +
            'Ensure SSML contains <mark> tags and enableTimePointing is set correctly.'
        );
      }

      // eslint-disable-next-line no-console -- useful diagnostics for production TTS batch debugging
      console.log(`[TTS BATCH] Got ${timepoints.length} timepoints from API`);

      return {
        audioBuffer: Buffer.from(response.audioContent as Uint8Array),
        timepoints,
      };
    } catch (error) {
      console.error('[TTS BATCH] Google Cloud TTS v1beta1 error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to synthesize speech with timepoints: ${errorMsg}`);
    }
  }

  /**
   * Extract language code from voice ID
   * e.g., "ja-JP-Neural2-B" -> "ja-JP"
   */
  extractLanguageCode(voiceId: string): string {
    const match = voiceId.match(/^([a-z]{2}-[A-Z]{2})/);
    return match ? match[1] : 'en-US';
  }
}

// Singleton instance
let betaProvider: GoogleTTSBetaProvider | null = null;

export function getGoogleTTSBetaProvider(): GoogleTTSBetaProvider {
  if (!betaProvider) {
    betaProvider = new GoogleTTSBetaProvider();
  }
  return betaProvider;
}
