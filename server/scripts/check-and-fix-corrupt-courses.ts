import { PrismaClient } from '@prisma/client';
import { courseQueue } from '../src/jobs/courseQueue.js';

const prisma = new PrismaClient();

async function main() {
  const courses = await prisma.course.findMany({
    where: {
      isSampleContent: true,
      OR: [
        { status: 'error' },
        { status: 'draft' }
      ]
    },
    select: {
      id: true,
      title: true,
      targetLanguage: true,
      jlptLevel: true,
      status: true,
      scriptJson: true,
    }
  });

  console.log('Found ' + courses.length + ' courses needing retry\n');

  for (const course of courses) {
    const level = course.jlptLevel || 'unknown';
    const label = course.targetLanguage.toUpperCase() + ' ' + level;
    
    // Check for corrupt voice data in script
    let hasCorruptVoices = false;
    if (course.scriptJson) {
      const units = course.scriptJson as any[];
      const voiceIds = units
        .filter(u => u.voiceId)
        .map(u => u.voiceId);
      
      // Check for language mismatch (e.g., non-Japanese voices in a Japanese course)
      const hasJapaneseVoices = voiceIds.some((v: string) => v.includes('ja-'));
      
      if (course.targetLanguage === 'ja' && !hasJapaneseVoices) {
        hasCorruptVoices = true;
        console.log(label + ' - Japanese course with no Japanese voices');
      }
    }
    
    // Delete corrupt data
    if (hasCorruptVoices) {
      await prisma.courseCoreItem.deleteMany({
        where: { courseId: course.id }
      });
      
      await prisma.course.update({
        where: { id: course.id },
        data: {
          status: 'draft',
          audioUrl: null,
          scriptJson: null,
          approxDurationSeconds: null,
          timingData: null,
        }
      });
      
      console.log(label + ' - cleaned corrupt data');
    }
    
    // Queue for regeneration
    const job = await courseQueue.add('generate', { courseId: course.id });
    console.log(label + ' - queued Job #' + job.id);
  }
  
  await prisma.$disconnect();
}

main().catch(console.error).finally(() => process.exit(0));
