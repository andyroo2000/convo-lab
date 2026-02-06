import { Readable } from 'stream';

import { Polly, SynthesizeSpeechCommand, VoiceId } from '@aws-sdk/client-polly';

export interface SynthesizeWithTimepointsResult {
  audioBuffer: Buffer;
  timepoints: Array<{
    markName: string;
    timeSeconds: number;
  }>;
}

export interface TTSBatchOptions {
  ssml: string;
  voiceId: string;
  languageCode: string;
  speed?: number;
  pitch?: number;
}

/**
 * Speech Mark from Amazon Polly
 * Polly returns newline-delimited JSON with this structure
 */
interface PollySpeechMark {
  type: 'ssml' | 'word' | 'sentence' | 'viseme';
  time: number; // milliseconds
  value: string; // mark name for type='ssml'
  start?: number;
  end?: number;
}

/**
 * Convert a stream to buffer
 */
async function streamToBuffer(
  stream: Readable | ReadableStream<Uint8Array> | Blob | undefined
): Promise<Buffer> {
  if (!stream) {
    return Buffer.alloc(0);
  }

  // Handle Blob
  if (stream instanceof Blob) {
    return Buffer.from(await stream.arrayBuffer());
  }

  // Handle ReadableStream (web streams)
  if (stream instanceof ReadableStream) {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];

    // Read all chunks without await-in-loop by using a recursive approach
    const readAllChunks = async (): Promise<void> => {
      const { done, value } = await reader.read();
      if (!done) {
        chunks.push(value);
        await readAllChunks();
      }
    };
    await readAllChunks();

    return Buffer.concat(chunks);
  }

  // Handle Node.js Readable stream
  if (stream instanceof Readable) {
    // Use event-based approach to avoid await-in-loop
    const chunks: Buffer[] = [];

    stream.on('data', (chunk: Buffer | Uint8Array) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    await new Promise<void>((resolve, reject) => {
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    return Buffer.concat(chunks);
  }

  throw new Error('Unsupported stream type');
}

/**
 * Amazon Polly TTS provider with Speech Marks support
 *
 * Uses AWS Polly Neural voices with Speech Marks (SSML type) to get
 * precise timestamps for SSML <mark> tags, enabling audio splitting
 * at exact boundaries.
 */
export class PollyTTSProvider {
  private polly: Polly;

  constructor() {
    // Initialize Polly client with AWS credentials from environment
    this.polly = new Polly({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }

  getName(): string {
    return 'Amazon Polly (Neural with Speech Marks)';
  }

  /**
   * Synthesize speech with SSML mark timepointing using Amazon Polly
   *
   * This requires TWO API calls:
   * 1. Synthesize audio with the SSML
   * 2. Get speech marks (timing data) for the same SSML
   *
   * @param options - TTS options including SSML with <mark> tags
   * @returns Audio buffer and timepoints for each mark
   */
  async synthesizeSpeechWithTimepoints(
    options: TTSBatchOptions
  ): Promise<SynthesizeWithTimepointsResult> {
    const { ssml, voiceId, speed = 1.0 } = options;

    // eslint-disable-next-line no-console
    console.log(`[TTS POLLY] Synthesizing with timepoints: voice=${voiceId}, speed=${speed}`);
    // eslint-disable-next-line no-console
    console.log(`[TTS POLLY] SSML preview: ${ssml.substring(0, 200)}...`);

    // Note: Polly handles speed via <prosody rate="X%"> in SSML,
    // not via API parameter like Google TTS
    // The SSML should already have speed baked in from batchedTTSClient

    try {
      // CALL 1: Synthesize audio
      // eslint-disable-next-line no-console
      console.log(`[TTS POLLY] Requesting audio synthesis...`);
      const audioCommand = new SynthesizeSpeechCommand({
        Text: ssml,
        OutputFormat: 'mp3',
        VoiceId: voiceId as VoiceId,
        Engine: 'neural',
        TextType: 'ssml',
      });

      const audioResponse = await this.polly.send(audioCommand);
      const audioBuffer = await streamToBuffer(audioResponse.AudioStream);

      if (audioBuffer.length === 0) {
        throw new Error('No audio content received from Amazon Polly');
      }

      // eslint-disable-next-line no-console
      console.log(`[TTS POLLY] Audio received: ${audioBuffer.length} bytes`);

      // CALL 2: Get speech marks (timing data)
      // eslint-disable-next-line no-console
      console.log(`[TTS POLLY] Requesting speech marks...`);
      const marksCommand = new SynthesizeSpeechCommand({
        Text: ssml,
        VoiceId: voiceId as VoiceId,
        Engine: 'neural',
        TextType: 'ssml',
        OutputFormat: 'json', // Special format for speech marks
        SpeechMarkTypes: ['ssml'], // Only SSML marks (not word/sentence/viseme)
      });

      const marksResponse = await this.polly.send(marksCommand);
      const marksBuffer = await streamToBuffer(marksResponse.AudioStream);

      if (marksBuffer.length === 0) {
        throw new Error('No speech marks received from Amazon Polly');
      }

      // Parse newline-delimited JSON
      const marksText = marksBuffer.toString('utf-8');
      const speechMarks: PollySpeechMark[] = marksText
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line))
        .filter((mark) => mark.type === 'ssml'); // Only SSML marks

      // eslint-disable-next-line no-console
      console.log(`[TTS POLLY] Got ${speechMarks.length} speech marks`);

      // Validate we got marks back
      if (speechMarks.length === 0) {
        throw new Error(
          'Polly Speech Marks API did not return any SSML marks. ' +
            'Ensure SSML contains <mark> tags.'
        );
      }

      // Convert to Google-compatible format
      const timepoints = speechMarks.map((mark) => ({
        markName: mark.value, // "text_0", "text_1", etc.
        timeSeconds: mark.time / 1000, // Convert ms to seconds
      }));

      // eslint-disable-next-line no-console
      console.log(`[TTS POLLY] Converted ${timepoints.length} timepoints`);

      return {
        audioBuffer,
        timepoints,
      };
    } catch (error) {
      console.error('[TTS POLLY] Amazon Polly error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to synthesize speech with Polly: ${errorMsg}`);
    }
  }
}

// Singleton instance
let pollyProvider: PollyTTSProvider | null = null;

export function getPollyTTSProvider(): PollyTTSProvider {
  if (!pollyProvider) {
    pollyProvider = new PollyTTSProvider();
  }
  return pollyProvider;
}
