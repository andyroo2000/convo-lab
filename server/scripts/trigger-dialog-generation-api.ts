import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

// Load production environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../', '.env.production'), override: true });

const episodeId = 'ab187492-32f5-4639-b056-2ba0fdcc0fb7';
const userEmail = 'nemtsov@gmail.com';

// Speakers configuration for a Japanese dialogue
const speakers = [
  {
    name: 'Flight Attendant',
    voiceId: 'ja-JP-Neural2-B',
    voiceProvider: 'google',
    proficiency: 'intermediate',
    tone: 'polite',
    gender: 'female',
  },
  {
    name: 'You',
    voiceId: 'ja-JP-Neural2-C',
    voiceProvider: 'google',
    proficiency: 'beginner',
    tone: 'casual',
    gender: 'male',
  }
];

async function triggerDialogueGeneration() {
  try {
    console.log('🔍 Triggering dialogue generation via production API...\n');
    console.log(`Episode ID: ${episodeId}`);
    console.log(`User: ${userEmail}\n`);

    // Get production API URL
    const apiUrl = process.env.CLIENT_URL || 'https://convo-lab.com';
    const endpoint = `${apiUrl}/api/dialogue/generate`;

    console.log(`📡 API Endpoint: ${endpoint}\n`);
    console.log('⚠️  Note: This requires authentication. You\'ll need to make this request');
    console.log('   with a valid user session token.\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📋 Request Details:\n');
    console.log('POST', endpoint);
    console.log('\nHeaders:');
    console.log('  Content-Type: application/json');
    console.log('  Cookie: <user-session-cookie>');
    console.log('\nBody:');
    console.log(JSON.stringify({
      episodeId,
      speakers,
      variationCount: 3,
      dialogueLength: 8
    }, null, 2));

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n💡 Since we can\'t authenticate from this script, you have two options:');
    console.log('\n1. Log into the production site as Yuriy and manually trigger dialogue generation');
    console.log('   from the UI (click "Generate Dialogue" on the episode)');
    console.log('\n2. Use the admin panel to trigger the generation');
    console.log('\n3. Or I can look for a different approach...');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

triggerDialogueGeneration();
