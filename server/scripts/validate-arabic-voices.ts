import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { TTS_VOICES } from '../../shared/src/constants-new.js';

const pollyClient = new PollyClient({ region: 'us-east-1' });

interface VoiceTestResult {
  voiceId: string;
  gender: string;
  description: string;
  success: boolean;
  error?: string;
  audioSize?: number;
  engine?: string;
}

async function testPollyVoice(
  voiceId: string,
  languageCode: string
): Promise<{ success: boolean; error?: string; audioSize?: number; engine?: string }> {
  // Try neural first, then fall back to standard
  const engines = ['neural', 'standard'];

  for (const engine of engines) {
    try {
      const testText =
        languageCode === 'arb' ? 'مرحبا، هذا اختبار للصوت العربي' : 'Hello, this is a voice test.';

      const command = new SynthesizeSpeechCommand({
        Text: testText,
        OutputFormat: 'mp3',
        VoiceId: voiceId,
        Engine: engine as 'neural' | 'standard',
        TextType: 'text',
      });

      const response = await pollyClient.send(command);

      // Get audio size
      const audioStream = response.AudioStream;
      if (audioStream) {
        const chunks: any[] = [];
        for await (const chunk of audioStream) {
          chunks.push(chunk);
        }
        const audioBuffer = Buffer.concat(chunks);
        return { success: true, audioSize: audioBuffer.length, engine };
      }
    } catch (error: any) {
      // If neural fails, try next engine
      if (engine === 'neural') {
        continue;
      }
      return { success: false, error: error.message };
    }
  }

  return { success: false, error: 'No audio stream returned' };
}

async function validateArabicVoices() {
  console.log('🎤 Arabic Voice Validation Script');
  console.log('=====================================\n');

  const arabicVoices = TTS_VOICES.ar;

  if (!arabicVoices || arabicVoices.voices.length === 0) {
    console.log('❌ No Arabic voices found in TTS_VOICES configuration');
    process.exit(1);
  }

  console.log(`Testing ${arabicVoices.voices.length} Arabic voices...\n`);

  const results: VoiceTestResult[] = [];

  for (const voice of arabicVoices.voices) {
    process.stdout.write(`Testing ${voice.id} (${voice.gender})... `);

    const result = await testPollyVoice(voice.id, arabicVoices.languageCode);

    results.push({
      voiceId: voice.id,
      gender: voice.gender,
      description: voice.description,
      success: result.success,
      error: result.error,
      audioSize: result.audioSize,
      engine: result.engine,
    });

    if (result.success) {
      console.log(`✅ Success (${result.engine} engine, ${result.audioSize} bytes)`);
    } else {
      console.log(`❌ Failed: ${result.error}`);
    }
  }

  console.log('\n=====================================');
  console.log('Summary:');
  console.log('=====================================\n');

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`✅ Successful: ${successful.length}/${results.length}`);
  console.log(`❌ Failed: ${failed.length}/${results.length}\n`);

  if (successful.length > 0) {
    console.log('Working voices:');
    successful.forEach((r) => {
      console.log(`  • ${r.voiceId} (${r.gender}) - ${r.description}`);
      console.log(`    Engine: ${r.engine}, Size: ${r.audioSize} bytes`);
    });
    console.log('');
  }

  if (failed.length > 0) {
    console.log('Failed voices:');
    failed.forEach((r) => {
      console.log(`  • ${r.voiceId} (${r.gender}): ${r.error}`);
    });
    console.log('');
  }

  // Check for Speech Marks support (neural voices only)
  const neuralVoices = successful.filter((r) => r.engine === 'neural');
  if (neuralVoices.length > 0) {
    console.log('ℹ️  Neural voices detected - these support Speech Marks for batched TTS');
    console.log('   Voice IDs:', neuralVoices.map((r) => r.voiceId).join(', '));
  } else {
    console.log('⚠️  No neural voices found - Speech Marks may not be supported');
  }

  console.log('\n=====================================\n');

  if (failed.length > 0) {
    process.exit(1);
  }
}

validateArabicVoices().catch(console.error);
