import { Queue } from 'bullmq';
import Redis from 'ioredis';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Load production environment FIRST before importing prisma
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../', '.env.production'), override: true });

// Import prisma AFTER env is loaded
const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();

// Redis connection for queue
const redis = new Redis({
  host: process.env.REDIS_HOST!,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD!,
  maxRetriesPerRequest: null,
});

const dialogueQueue = new Queue('dialogue-generation', { connection: redis });

async function createDialogForYuriy() {
  try {
    console.log('🔍 Finding Yuriy...\n');

    // Find Yuriy's user
    const user = await prisma.user.findUnique({
      where: { email: 'nemtsov@gmail.com' },
      select: {
        id: true,
        email: true,
        name: true,
        preferredStudyLanguage: true,
        preferredNativeLanguage: true,
        proficiencyLevel: true,
      }
    });

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log(`✅ Found user: ${user.email} (${user.name})`);
    console.log(`   Study Language: ${user.preferredStudyLanguage}`);
    console.log(`   Native Language: ${user.preferredNativeLanguage}`);
    console.log(`   Proficiency: ${user.proficiencyLevel}\n`);

    // Create the episode
    console.log('📝 Creating episode...\n');

    const episode = await prisma.episode.create({
      data: {
        userId: user.id,
        title: 'Conversation with flight attendants on the way to Japan',
        sourceText: 'Casual conversations with flight attendants on the way to Japan',
        targetLanguage: user.preferredStudyLanguage,
        nativeLanguage: user.preferredNativeLanguage,
        audioSpeed: 'medium',
        status: 'draft',
      },
    });

    console.log(`✅ Episode created: ${episode.id}`);
    console.log(`   Title: "${episode.title}"\n`);

    // Define speakers for a Japanese dialogue
    // For Japanese, we'll use Google TTS voices
    const speakers = [
      {
        name: 'Flight Attendant',
        voiceId: 'ja-JP-Neural2-B', // Female Japanese voice
        voiceProvider: 'google',
        proficiency: 'intermediate', // Flight attendant speaks clearly
        tone: 'polite',
        gender: 'female',
      },
      {
        name: 'You',
        voiceId: 'ja-JP-Neural2-C', // Male Japanese voice
        voiceProvider: 'google',
        proficiency: 'beginner', // User is learning
        tone: 'casual',
        gender: 'male',
      }
    ];

    console.log('🎭 Speakers defined:');
    speakers.forEach(s => {
      console.log(`   - ${s.name} (${s.proficiency}, ${s.tone}) - Voice: ${s.voiceId}`);
    });
    console.log();

    // Add job to dialogue generation queue
    console.log('⏰ Adding job to dialogue generation queue...\n');

    const job = await dialogueQueue.add('generate-dialogue', {
      userId: user.id,
      episodeId: episode.id,
      speakers,
      variationCount: 3,
      dialogueLength: 8, // A bit longer for a conversation scenario
    });

    console.log(`✅ Job added to queue: ${job.id}\n`);

    // Log the generation
    await prisma.generationLog.create({
      data: {
        userId: user.id,
        contentType: 'dialogue',
        contentId: episode.id,
      }
    });

    console.log('✅ Generation logged for quota tracking\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Dialog creation initiated successfully!');
    console.log('\nDetails:');
    console.log(`   Episode ID: ${episode.id}`);
    console.log(`   Job ID: ${job.id}`);
    console.log(`   Status: Queued for processing`);
    console.log('\n⏳ The dialogue should be generated within a few minutes.');
    console.log('   Workers will process the queue and generate the content.');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await dialogueQueue.close();
    await redis.quit();
    await prisma.$disconnect();
  }
}

createDialogForYuriy();
