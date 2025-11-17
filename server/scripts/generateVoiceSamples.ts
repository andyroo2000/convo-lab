/**
 * Generate voice sample audio files for all Japanese TTS voices
 * Run with: npx tsx scripts/generateVoiceSamples.ts
 */
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

// Voice samples mapping
const VOICE_SAMPLES = [
  // Japanese dialogue voices
  { name: 'Nanami', language: 'ja', edgeId: 'ja-JP-NanamiNeural', text: 'こんにちは、私は七海です。一緒に頑張りましょう。やりましょう！' },
  { name: 'Shiori', language: 'ja', edgeId: 'ja-JP-ShioriNeural', text: 'こんにちは、私は詩織です。一緒に頑張りましょう。やりましょう！' },
  { name: 'Mayu', language: 'ja', edgeId: 'ja-JP-MayuNeural', text: 'こんにちは、私はまゆです。一緒に頑張りましょう。やりましょう！' },
  { name: 'Masaru', language: 'ja', edgeId: 'ja-JP-MasaruMultilingualNeural', text: 'こんにちは、私はまさるです。一緒に頑張りましょう。やりましょう！' },
  { name: 'Naoki', language: 'ja', edgeId: 'ja-JP-NaokiNeural', text: 'こんにちは、私は直樹です。一緒に頑張りましょう。やりましょう！' },
  { name: 'Daichi', language: 'ja', edgeId: 'ja-JP-DaichiNeural', text: 'こんにちは、私は大地です。一緒に頑張りましょう。やりましょう！' },

  // English narrator voices - Male
  { name: 'Andrew', language: 'en', edgeId: 'en-US-AndrewNeural', text: "Hi, my name is Andrew, and I'll be your narrator. I'll give you explanations and instructions in your native language." },
  { name: 'Brian', language: 'en', edgeId: 'en-US-BrianNeural', text: "Hi, my name is Brian, and I'll be your narrator. I'll give you explanations and instructions in your native language." },
  { name: 'Eric', language: 'en', edgeId: 'en-US-EricNeural', text: "Hi, my name is Eric, and I'll be your narrator. I'll give you explanations and instructions in your native language." },
  { name: 'Guy', language: 'en', edgeId: 'en-US-GuyNeural', text: "Hi, my name is Guy, and I'll be your narrator. I'll give you explanations and instructions in your native language." },

  // English narrator voices - Female
  { name: 'Jenny', language: 'en', edgeId: 'en-US-JennyNeural', text: "Hi, my name is Jenny, and I'll be your narrator. I'll give you explanations and instructions in your native language." },
  { name: 'Aria', language: 'en', edgeId: 'en-US-AriaNeural', text: "Hi, my name is Aria, and I'll be your narrator. I'll give you explanations and instructions in your native language." },
  { name: 'Sara', language: 'en', edgeId: 'en-US-SaraNeural', text: "Hi, my name is Sara, and I'll be your narrator. I'll give you explanations and instructions in your native language." },
  { name: 'Michelle', language: 'en', edgeId: 'en-US-MichelleNeural', text: "Hi, my name is Michelle, and I'll be your narrator. I'll give you explanations and instructions in your native language." },
];

async function generateVoiceSamples() {
  console.log('🎤 Generating voice samples for TTS voices...\n');

  // Output directory (client public folder)
  const outputDir = path.join(process.cwd(), '..', 'client', 'public', 'voice-samples');

  // Create output directory if it doesn't exist
  await fs.mkdir(outputDir, { recursive: true });
  console.log(`📁 Output directory: ${outputDir}\n`);

  for (const voice of VOICE_SAMPLES) {
    console.log(`Generating sample for ${voice.name} (${voice.edgeId})...`);

    try {
      // Create temp files
      const tempDir = os.tmpdir();
      const timestamp = Date.now();
      const inputFile = path.join(tempDir, `voice-sample-input-${timestamp}.txt`);
      const outputFile = path.join(outputDir, `${voice.name.toLowerCase()}.mp3`);

      // Write text to temp file
      await fs.writeFile(inputFile, voice.text, 'utf-8');

      // Build edge-tts command
      const command = [
        'edge-tts',
        `--voice ${voice.edgeId}`,
        `--file ${inputFile}`,
        `--write-media ${outputFile}`,
      ].join(' ');

      // Execute edge-tts
      await execAsync(command);

      // Cleanup temp file
      await fs.unlink(inputFile);

      console.log(`✅ Generated: ${voice.name.toLowerCase()}.mp3\n`);
    } catch (error) {
      console.error(`❌ Failed to generate sample for ${voice.name}:`, error);
    }
  }

  console.log('✨ Voice sample generation complete!');
  console.log(`\nSamples saved to: ${outputDir}`);
}

generateVoiceSamples().catch(console.error);
