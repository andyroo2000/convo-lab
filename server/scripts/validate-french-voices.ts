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

async function testPollyVoice(voiceId: string, languageCode: string): Promise<{ success: boolean; error?: string; audioSize?: number; engine?: string }> {
  // Try neural first, then fall back to standard
  const engines = ['neural', 'standard'];

  for (const engine of engines) {
    try {
      const testText = languageCode === 'fr-FR'
        ? 'Bonjour, je suis un test de la voix française.'
        : 'Hello, this is a voice test.';

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

async function validateFrenchVoices() {
  console.log('🎤 French Voice Validation Script');
  console.log('=====================================\n');

  const frenchConfig = TTS_VOICES['fr' as keyof typeof TTS_VOICES];

  if (!frenchConfig) {
    console.error('❌ No French voice configuration found!');
    return;
  }

  console.log(`Language Code: ${frenchConfig.languageCode}`);
  console.log(`Total Voices: ${frenchConfig.voices.length}\n`);

  const results: VoiceTestResult[] = [];
  let successCount = 0;
  let failCount = 0;

  for (const voice of frenchConfig.voices) {
    console.log(`Testing: ${voice.id} (${voice.gender}) - ${voice.description}`);

    const testResult = await testPollyVoice(voice.id, frenchConfig.languageCode);

    const result: VoiceTestResult = {
      voiceId: voice.id,
      gender: voice.gender,
      description: voice.description,
      success: testResult.success,
      error: testResult.error,
      audioSize: testResult.audioSize,
      engine: testResult.engine,
    };

    results.push(result);

    if (testResult.success) {
      const engineBadge = testResult.engine === 'neural' ? '🎯' : '⚠️ ';
      console.log(`  ✅ SUCCESS - Generated ${(testResult.audioSize! / 1024).toFixed(1)}KB of audio [${engineBadge} ${testResult.engine?.toUpperCase()}]`);
      successCount++;
    } else {
      console.log(`  ❌ FAILED - ${testResult.error}`);
      failCount++;
    }

    console.log('');

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('=====================================');
  console.log('📊 Summary:');
  console.log(`  ✅ Passed: ${successCount}`);
  console.log(`  ❌ Failed: ${failCount}`);
  console.log(`  Total:  ${results.length}\n`);

  if (failCount > 0) {
    console.log('❌ Failed Voices:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.voiceId} (${r.gender}): ${r.error}`);
    });
    console.log('');
  }

  const neuralVoices = results.filter(r => r.success && r.engine === 'neural');
  const standardVoices = results.filter(r => r.success && r.engine === 'standard');

  console.log(`\n🎯 Neural Voices (support Speech Marks for batching): ${neuralVoices.length}`);
  neuralVoices.forEach(v => console.log(`  - ${v.voiceId} (${v.gender})`));

  if (standardVoices.length > 0) {
    console.log(`\n⚠️  Standard Voices (NO Speech Marks support): ${standardVoices.length}`);
    standardVoices.forEach(v => console.log(`  - ${v.voiceId} (${v.gender})`));
  }

  if (successCount === results.length) {
    console.log('\n🎉 All French voices are valid and working!');
  } else {
    console.log('\n⚠️  Some voices failed validation. Please check the configuration.');
    process.exit(1);
  }
}

validateFrenchVoices().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
