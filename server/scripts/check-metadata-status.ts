/**
 * Check metadata status in the database
 *
 * Quick diagnostic to see how many sentences need backfilling
 */

import { prisma } from '../src/db/client.js';

async function checkMetadataStatus() {
  console.log('🔍 Checking sentence metadata status...\n');

  try {
    // Total sentences
    const totalSentences = await prisma.sentence.count();
    console.log(`📊 Total sentences: ${totalSentences}`);

    // Sentences with empty metadata
    const emptyMetadata = await prisma.sentence.count({
      where: {
        OR: [{ metadata: { equals: {} } }, { metadata: { equals: null } }],
      },
    });
    console.log(`❌ Sentences with empty metadata: ${emptyMetadata}`);

    // Sentences with metadata
    const withMetadata = totalSentences - emptyMetadata;
    console.log(`✅ Sentences with metadata: ${withMetadata}\n`);

    // Get sample of empty metadata sentences by language
    const sampleEmpty = await prisma.sentence.findMany({
      where: {
        OR: [{ metadata: { equals: {} } }, { metadata: { equals: null } }],
      },
      include: {
        dialogue: {
          include: {
            episode: {
              select: {
                id: true,
                title: true,
                targetLanguage: true,
              },
            },
          },
        },
      },
      take: 5,
    });

    if (sampleEmpty.length > 0) {
      console.log('📝 Sample sentences needing backfill:');
      sampleEmpty.forEach((sentence, i) => {
        const episode = sentence.dialogue.episode;
        console.log(`\n${i + 1}. Episode: "${episode.title}" (${episode.targetLanguage})`);
        console.log(`   Text: ${sentence.text.substring(0, 50)}...`);
        console.log(`   Metadata: ${JSON.stringify(sentence.metadata)}`);
      });
    }

    // Get sample of sentences with metadata
    const sampleWithMetadata = await prisma.sentence.findMany({
      where: {
        NOT: {
          OR: [{ metadata: { equals: {} } }, { metadata: { equals: null } }],
        },
      },
      include: {
        dialogue: {
          include: {
            episode: {
              select: {
                id: true,
                title: true,
                targetLanguage: true,
              },
            },
          },
        },
      },
      take: 3,
    });

    if (sampleWithMetadata.length > 0) {
      console.log('\n\n✅ Sample sentences with metadata:');
      sampleWithMetadata.forEach((sentence, i) => {
        const episode = sentence.dialogue.episode;
        console.log(`\n${i + 1}. Episode: "${episode.title}" (${episode.targetLanguage})`);
        console.log(`   Text: ${sentence.text.substring(0, 50)}...`);
        console.log(`   Metadata: ${JSON.stringify(sentence.metadata).substring(0, 100)}...`);
      });
    }

    console.log('\n' + '━'.repeat(60));
    if (emptyMetadata === 0) {
      console.log('✅ All sentences have metadata! No backfill needed.');
    } else {
      console.log(`⚠️  ${emptyMetadata} sentences are missing metadata.`);
      console.log('\nRegenerate affected Japanese dialogues to rebuild LLM reading metadata.');
    }
    console.log('');
  } catch (error) {
    console.error('❌ Error checking metadata:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkMetadataStatus()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
