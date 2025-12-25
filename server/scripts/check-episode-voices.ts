/**
 * Check episode speaker voices
 */

import { prisma } from '../src/db/client.js';

const episodeId = process.argv[2];

if (!episodeId) {
  console.error('Usage: check-episode-voices.ts <episodeId>');
  process.exit(1);
}

async function checkVoices() {
  try {
    console.log(`🔍 Checking episode ${episodeId}...\n`);

    const episode = await prisma.episode.findUnique({
      where: { id: episodeId },
      include: {
        dialogue: {
          include: {
            speakers: true,
            sentences: {
              orderBy: { order: 'asc' },
              take: 5,
            },
          },
        },
      },
    });

    if (!episode) {
      console.log('❌ Episode not found');
      return;
    }

    console.log(`📖 Episode: "${episode.title}"`);
    console.log(`   Language: ${episode.targetLanguage}`);
    console.log(`   Audio URLs:`);
    console.log(`     0.7x: ${episode.audioUrl_0_7 ? '✅' : '❌'}`);
    console.log(`     0.85x: ${episode.audioUrl_0_85 ? '✅' : '❌'}`);
    console.log(`     1.0x: ${episode.audioUrl_1_0 ? '✅' : '❌'}`);
    console.log('');

    if (episode.dialogue?.speakers) {
      console.log('🎭 Speakers:');
      episode.dialogue.speakers.forEach((speaker, i) => {
        console.log(`\n${i + 1}. ${speaker.name}`);
        console.log(`   Voice ID: ${speaker.voiceId}`);
        console.log(`   Avatar: ${speaker.avatarFilename || 'N/A'}`);

        // Parse voice to extract gender
        const match = speaker.voiceId.match(/Wavenet-([A-Z])|Neural2-([A-Z])/);
        if (match) {
          const variant = match[1] || match[2];
          const isJapanese = speaker.voiceId.startsWith('ja-JP');
          if (isJapanese) {
            const gender = variant === 'A' || variant === 'B' ? 'female' : 'male';
            console.log(`   Gender (from voice): ${gender} (Wavenet/Neural2 ${variant})`);
          }
        }
      });

      // Check if voices are the same
      const voiceIds = episode.dialogue.speakers.map((s) => s.voiceId);
      if (voiceIds.length > 1 && new Set(voiceIds).size === 1) {
        console.log('\n⚠️  WARNING: All speakers have THE SAME voice ID!');
      } else if (voiceIds.length > 1) {
        console.log('\n✅ Speakers have different voices');
      }
    }

    if (episode.dialogue?.sentences && episode.dialogue.sentences.length > 0) {
      console.log('\n📝 Sample sentences:');
      episode.dialogue.sentences.slice(0, 3).forEach((s, i) => {
        const speaker = episode.dialogue?.speakers.find((sp) => sp.id === s.speakerId);
        console.log(`\n${i + 1}. "${s.text.substring(0, 50)}..."`);
        console.log(`   Speaker: ${speaker?.name || 'Unknown'} (${speaker?.voiceId || 'N/A'})`);
      });
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkVoices();
