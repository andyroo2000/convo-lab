import dotenv from 'dotenv';
import { getPollyTTSProvider } from './src/services/ttsProviders/PollyTTSProvider.js';
import { promises as fs } from 'fs';
import path from 'path';

// Load environment variables from .env file
dotenv.config();

/**
 * Manual test script for Japanese Polly voices
 * Tests each voice individually to ensure no fallbacks or swallowed errors
 */

const JAPANESE_POLLY_VOICES = [
  { id: 'Takumi', gender: 'male', description: 'Takumi - Natural and smooth' },
  { id: 'Kazuha', gender: 'female', description: 'Kazuha - Friendly and clear' },
  { id: 'Tomoko', gender: 'female', description: 'Tomoko - Natural and pleasant' },
];

const TEST_TEXT = 'こんにちは。今日はいい天気ですね。'; // "Hello. Nice weather today, isn't it?"

async function testPollyVoice(voiceId: string, description: string) {
  console.log(`\n=== Testing ${voiceId} (${description}) ===`);

  try {
    const provider = getPollyTTSProvider();

    // Build simple SSML with one mark
    const ssml = `<speak><mark name="test_mark"/>${TEST_TEXT}</speak>`;

    console.log(`Requesting synthesis for voice: ${voiceId}`);
    console.log(`SSML: ${ssml}`);

    const result = await provider.synthesizeSpeechWithTimepoints({
      ssml,
      voiceId,
      languageCode: 'ja-JP',
      speed: 1.0,
      pitch: 0,
    });

    // Verify we got audio
    if (!result.audioBuffer || result.audioBuffer.length === 0) {
      throw new Error(`❌ FAILED: No audio received for voice ${voiceId}`);
    }

    console.log(`✅ Audio received: ${result.audioBuffer.length} bytes`);

    // Verify we got timepoints
    if (!result.timepoints || result.timepoints.length === 0) {
      throw new Error(`❌ FAILED: No timepoints received for voice ${voiceId}`);
    }

    console.log(`✅ Timepoints received: ${result.timepoints.length}`);
    console.log(`   First timepoint: ${JSON.stringify(result.timepoints[0])}`);

    // Save audio file
    const tempDir = path.join(process.cwd(), 'tmp', 'polly-voice-test');
    await fs.mkdir(tempDir, { recursive: true });

    const filename = `${voiceId.toLowerCase()}-test.mp3`;
    const filepath = path.join(tempDir, filename);
    await fs.writeFile(filepath, result.audioBuffer);

    console.log(`✅ Audio saved to: ${filepath}`);
    console.log(`✅ SUCCESS: ${voiceId} is working correctly!`);

    return {
      voiceId,
      success: true,
      audioSize: result.audioBuffer.length,
      timepointsCount: result.timepoints.length,
      filepath,
    };
  } catch (error) {
    console.error(`❌ FAILED: Error testing voice ${voiceId}`);
    console.error(`Error details:`, error);

    // Re-throw to ensure script fails if any voice fails
    throw error;
  }
}

async function main() {
  console.log('🎤 Testing Japanese Polly Voices');
  console.log('================================');
  console.log(`Test text: ${TEST_TEXT}`);

  const results = [];

  // Test each voice sequentially to see clear output
  for (const voice of JAPANESE_POLLY_VOICES) {
    const result = await testPollyVoice(voice.id, voice.description);
    results.push(result);
  }

  console.log('\n=== Test Summary ===');
  console.log(`Total voices tested: ${results.length}`);
  console.log(`All voices successful: ✅`);

  console.log('\n📁 Audio files saved to:');
  for (const result of results) {
    console.log(`   - ${result.filepath} (${result.audioSize} bytes)`);
  }

  console.log('\n✅ All Japanese Polly voices are working correctly!');
  console.log('You can listen to the test audio files in the tmp/polly-voice-test directory.');
}

main()
  .then(() => {
    console.log('\n✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed with error:', error);
    process.exit(1);
  });
