import { TTS_VOICES, DEFAULT_NARRATOR_VOICES } from '../../shared/src/constants.js';
import { synthesizeSpeech } from '../src/services/ttsClient.js';

/**
 * Validates all TTS voices by attempting to generate a short test sentence
 * This ensures all voice IDs in our configuration are valid and working
 *
 * Usage: npx tsx server/scripts/validate-voices.ts
 */

interface VoiceTestResult {
  voiceId: string;
  gender: string;
  description: string;
  language: string;
  status: 'success' | 'failed';
  error?: string;
  duration?: number; // in milliseconds
}

const TEST_SENTENCES = {
  en: 'Hello, this is a test.',
  ja: 'こんにちは、これはテストです。',
  zh: '你好，这是一个测试。',
};

async function testVoice(
  voiceId: string,
  languageCode: string,
  testText: string,
  gender: string,
  description: string,
  language: string
): Promise<VoiceTestResult> {
  const startTime = Date.now();

  try {
    console.log(`Testing ${voiceId}...`);

    // Attempt to synthesize speech with NO fallback
    await synthesizeSpeech({
      text: testText,
      voiceId: voiceId,
      languageCode: languageCode,
      speed: 1.0,
      useSSML: false,
    });

    const duration = Date.now() - startTime;

    return {
      voiceId,
      gender,
      description,
      language,
      status: 'success',
      duration,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    return {
      voiceId,
      gender,
      description,
      language,
      status: 'failed',
      error: errorMsg,
    };
  }
}

async function validateAllVoices() {
  console.log('🎤 Validating all TTS voices...\n');
  console.log('This will test each voice by generating a short sentence.');
  console.log('Expected time: ~30-60 seconds\n');

  const allResults: VoiceTestResult[] = [];

  // Test dialogue voices from TTS_VOICES
  for (const [langKey, config] of Object.entries(TTS_VOICES)) {
    const languageCode = config.languageCode;
    const testText = TEST_SENTENCES[langKey as keyof typeof TEST_SENTENCES] || 'Test';

    console.log(`\n=== Testing ${langKey.toUpperCase()} Voices (${config.voices.length} voices) ===`);

    for (const voice of config.voices) {
      const result = await testVoice(
        voice.id,
        languageCode,
        testText,
        voice.gender,
        voice.description,
        langKey
      );

      allResults.push(result);

      // Show result immediately
      if (result.status === 'success') {
        console.log(`  ✅ ${voice.id} - ${result.duration}ms`);
      } else {
        console.log(`  ❌ ${voice.id} - ERROR: ${result.error}`);
      }
    }
  }

  // Test narrator voices
  console.log('\n=== Testing Narrator Voices ===');
  for (const [langKey, voiceId] of Object.entries(DEFAULT_NARRATOR_VOICES)) {
    const config = TTS_VOICES[langKey as keyof typeof TTS_VOICES];
    if (!config) continue;

    const languageCode = config.languageCode;
    const testText = TEST_SENTENCES[langKey as keyof typeof TEST_SENTENCES] || 'Test';

    // Check if this voice is already tested
    const alreadyTested = allResults.find(r => r.voiceId === voiceId);
    if (alreadyTested) {
      console.log(`  ✅ ${voiceId} (already tested as dialogue voice)`);
      continue;
    }

    const result = await testVoice(
      voiceId,
      languageCode,
      testText,
      'unknown',
      'Default narrator',
      langKey
    );

    allResults.push(result);

    if (result.status === 'success') {
      console.log(`  ✅ ${voiceId} - ${result.duration}ms`);
    } else {
      console.log(`  ❌ ${voiceId} - ERROR: ${result.error}`);
    }
  }

  // Summary
  console.log('\n\n' + '='.repeat(70));
  console.log('📊 VALIDATION SUMMARY');
  console.log('='.repeat(70));

  const totalVoices = allResults.length;
  const successCount = allResults.filter(r => r.status === 'success').length;
  const failedCount = allResults.filter(r => r.status === 'failed').length;

  console.log(`Total voices tested: ${totalVoices}`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failedCount}`);

  if (failedCount > 0) {
    console.log('\n❌ FAILED VOICES:');
    console.log('-'.repeat(70));
    const failed = allResults.filter(r => r.status === 'failed');
    failed.forEach(result => {
      console.log(`\n${result.voiceId}`);
      console.log(`  Language: ${result.language}`);
      console.log(`  Description: ${result.description}`);
      console.log(`  Error: ${result.error}`);
    });
  }

  // Performance stats
  if (successCount > 0) {
    const durations = allResults
      .filter(r => r.status === 'success' && r.duration)
      .map(r => r.duration!);

    const avgDuration = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);

    console.log('\n⏱️  PERFORMANCE:');
    console.log(`  Average response time: ${avgDuration}ms`);
    console.log(`  Fastest: ${minDuration}ms`);
    console.log(`  Slowest: ${maxDuration}ms`);
  }

  console.log('\n' + '='.repeat(70));

  if (failedCount === 0) {
    console.log('✅ All voices are valid and working!');
    process.exit(0);
  } else {
    console.log(`⚠️  ${failedCount} voice(s) failed validation. Please review and fix.`);
    process.exit(1);
  }
}

// Run validation
validateAllVoices().catch(error => {
  console.error('Fatal error during validation:', error);
  process.exit(1);
});
