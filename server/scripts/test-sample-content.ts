/**
 * Test sample content integration
 *
 * This script tests:
 * 1. Sample episodes exist in database
 * 2. Sample episodes have all audio URLs
 * 3. Sample content can be queried and filtered
 */

import { prisma } from '../src/db/client.js';

async function testSampleContent() {
  console.log('\n🧪 Testing Sample Content Integration\n');

  // 1. Check sample episodes exist
  const sampleEpisodes = await prisma.episode.findMany({
    where: { isSampleContent: true },
    include: {
      dialogue: {
        include: {
          speakers: true,
          sentences: true,
        },
      },
    },
  });

  console.log(`✅ Found ${sampleEpisodes.length} sample episodes`);

  // 2. Verify audio URLs exist
  for (const episode of sampleEpisodes) {
    const hasAllSpeeds = Boolean(
      episode.audioUrl_0_7 && episode.audioUrl_0_85 && episode.audioUrl_1_0
    );

    console.log(`\n📝 ${episode.title}`);
    console.log(`   Status: ${episode.status}`);
    console.log(`   Audio (0.7x): ${episode.audioUrl_0_7 ? '✅' : '❌'}`);
    console.log(`   Audio (0.85x): ${episode.audioUrl_0_85 ? '✅' : '❌'}`);
    console.log(`   Audio (1.0x): ${episode.audioUrl_1_0 ? '✅' : '❌'}`);
    console.log(`   Sentences: ${episode.dialogue?.sentences.length || 0}`);
    console.log(`   Speakers: ${episode.dialogue?.speakers.length || 0}`);

    if (!hasAllSpeeds) {
      console.log(`   ⚠️  Missing some audio files!`);
    }
  }

  // 3. Test querying sample content by language
  const japaneseSamples = await prisma.episode.findMany({
    where: {
      isSampleContent: true,
      targetLanguage: 'ja',
    },
  });

  console.log(`\n✅ Found ${japaneseSamples.length} Japanese sample episodes`);

  // 4. Verify sample content is marked correctly
  const totalEpisodes = await prisma.episode.count();
  const sampleCount = await prisma.episode.count({
    where: { isSampleContent: true },
  });

  console.log(`\n📊 Database Stats:`);
  console.log(`   Total episodes: ${totalEpisodes}`);
  console.log(`   Sample episodes: ${sampleCount}`);
  console.log(`   User episodes: ${totalEpisodes - sampleCount}`);

  console.log('\n✨ Sample content test complete!\n');

  await prisma.$disconnect();
}

testSampleContent();
