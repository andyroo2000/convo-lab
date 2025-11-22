/**
 * Quick check of production database
 * Run this with production DATABASE_URL to see metadata status
 */

import { prisma } from '../src/db/client.js';

async function quickCheck() {
  console.log('🔍 Quick production check...\n');

  try {
    // Get first dialogue with sentences
    const episode = await prisma.episode.findFirst({
      where: {
        dialogue: { isNot: null }
      },
      include: {
        dialogue: {
          include: {
            sentences: {
              take: 3,
              orderBy: { order: 'asc' }
            }
          }
        }
      }
    });

    if (!episode || !episode.dialogue) {
      console.log('❌ No dialogues found in database');
      return;
    }

    console.log(`📖 Episode: "${episode.title}"`);
    console.log(`   Language: ${episode.targetLanguage}`);
    console.log(`   Sentences: ${episode.dialogue.sentences.length}\n`);

    console.log('📝 Sample sentences:\n');
    episode.dialogue.sentences.forEach((s, i) => {
      console.log(`${i + 1}. Text: "${s.text.substring(0, 50)}${s.text.length > 50 ? '...' : ''}"`);

      const metadataStr = JSON.stringify(s.metadata);
      const isEmpty = metadataStr === '{}' || metadataStr === 'null';

      if (isEmpty) {
        console.log(`   Metadata: ❌ EMPTY - ${metadataStr}`);
      } else {
        console.log(`   Metadata: ✅ POPULATED`);
        console.log(`   ${metadataStr.substring(0, 100)}...`);
      }
      console.log('');
    });

    // Count totals
    const total = await prisma.sentence.count();
    const empty = await prisma.sentence.count({
      where: {
        OR: [
          { metadata: { equals: {} } },
          { metadata: { equals: null } }
        ]
      }
    });

    console.log('━'.repeat(60));
    console.log(`📊 Database Summary:`);
    console.log(`   Total sentences: ${total}`);
    console.log(`   Empty metadata: ${empty}`);
    console.log(`   With metadata: ${total - empty}`);
    console.log('');

    if (empty === total) {
      console.log('⚠️  ALL sentences have empty metadata!');
      console.log('   → You need to run the migration: npm run backfill:metadata\n');
    } else if (empty > 0) {
      console.log(`⚠️  ${empty} sentences still need backfilling`);
      console.log('   → Run: npm run backfill:metadata\n');
    } else {
      console.log('✅ All sentences have metadata!\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

quickCheck();
