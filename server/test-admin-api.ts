import { getAllSpeakerAvatars } from './src/services/avatarService.js';

async function testAdminAPI() {
  console.log('Testing getAllSpeakerAvatars...\n');

  const avatars = await getAllSpeakerAvatars();

  console.log(`Found ${avatars.length} total speaker avatars\n`);

  const arabicAvatars = avatars.filter(a => a.language === 'ar');
  console.log(`Arabic avatars: ${arabicAvatars.length}\n`);

  arabicAvatars.forEach(avatar => {
    console.log(`✓ ${avatar.filename}`);
    console.log(`  Language: ${avatar.language}`);
    console.log(`  Gender: ${avatar.gender}`);
    console.log(`  Tone: ${avatar.tone}`);
    console.log(`  Cropped URL: ${avatar.croppedUrl}`);
    console.log('');
  });

  process.exit(0);
}

testAdminAPI().catch(console.error);
