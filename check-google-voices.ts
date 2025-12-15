import { TextToSpeechClient } from '@google-cloud/text-to-speech';

const client = new TextToSpeechClient();

async function main() {
  try {
    const [result] = await client.listVoices({ languageCode: 'ja-JP' });
    const voices = result.voices || [];

    console.log('Japanese (ja-JP) voices from Google Cloud TTS:\n');

    const wavenetVoices = voices.filter(v => v.name?.includes('Wavenet'));
    const neural2Voices = voices.filter(v => v.name?.includes('Neural2'));

    console.log('=== Wavenet Voices ===');
    wavenetVoices.forEach(voice => {
      console.log(`${voice.name}: ${voice.ssmlGender}`);
    });

    console.log('\n=== Neural2 Voices ===');
    neural2Voices.forEach(voice => {
      console.log(`${voice.name}: ${voice.ssmlGender}`);
    });

  } catch (error) {
    console.error('Error:', error);
  }
}

main();
