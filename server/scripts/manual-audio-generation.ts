import { PrismaClient } from '@prisma/client';
import { generateAllSpeeds } from '../src/services/audioGenerator.js';

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  const dialogueId = process.argv[2];

  if (!dialogueId) {
    console.error('Usage: npx tsx manual-audio-generation.ts <dialogue-id>');
    process.exit(1);
  }

  console.log(`\n🎙️  Generating audio for dialogue: ${dialogueId}`);

  try {
    await generateAllSpeeds({ dialogueId });
    console.log('\n✅ Audio generation completed successfully!');
  } catch (error) {
    console.error('\n❌ Audio generation failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
