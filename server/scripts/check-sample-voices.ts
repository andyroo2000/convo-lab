import { prisma } from '../src/db/client.js';

async function checkVoices() {
  const episodes = await prisma.episode.findMany({
    where: {
      isSampleContent: true,
      targetLanguage: 'ja',
    },
    include: {
      dialogue: {
        include: {
          speakers: {
            select: {
              name: true,
              voiceId: true,
              voiceProvider: true,
            },
          },
        },
      },
    },
    take: 3,
  });

  console.log('\n📢 Sample Dialogue Voices (Japanese):\n');
  episodes.forEach((ep, idx) => {
    console.log(`${idx + 1}. ${ep.title}`);
    if (ep.dialogue?.speakers) {
      ep.dialogue.speakers.forEach((s) => {
        console.log(`   ${s.name}: ${s.voiceId} (${s.voiceProvider || 'not set'})`);
      });
    }
    console.log('');
  });

  await prisma.$disconnect();
}

checkVoices();
