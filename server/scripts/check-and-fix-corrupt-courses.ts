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
      cefrLevel: true,
      jlptLevel: true,
      status: true,
      scriptJson: true,
    }
  });

  console.log('Found ' + courses.length + ' courses needing retry\n');

  for (const course of courses) {
    const level = course.cefrLevel || course.jlptLevel || 'unknown';
    const label = course.targetLanguage.toUpperCase() + ' ' + level;
    
    // Check for corrupt voice data in script
    let hasCorruptVoices = false;
    if (course.scriptJson) {
      const units = course.scriptJson as any[];
      const voiceIds = units
        .filter(u => u.voiceId)
        .map(u => u.voiceId);
      
      // Check for language mismatch (e.g., Japanese voices in Spanish course)
      const hasJapaneseVoices = voiceIds.some((v: string) => v.includes('ja-'));
      const hasChineseVoices = voiceIds.some((v: string) => v.includes('zh-'));
      const hasSpanishVoices = voiceIds.some((v: string) => v.includes('es-'));
      const hasFrenchVoices = voiceIds.some((v: string) => v.includes('fr-'));
      const hasArabicVoices = voiceIds.some((v: string) => v.includes('ar-'));
      
      if (course.targetLanguage === 'ja' && !hasJapaneseVoices) {
        hasCorruptVoices = true;
        console.log(label + ' - Japanese course with no Japanese voices');
      }
      if (course.targetLanguage === 'zh' && !hasChineseVoices) {
        hasCorruptVoices = true;
        console.log(label + ' - Chinese course with no Chinese voices');
      }
      if (course.targetLanguage === 'es' && !hasSpanishVoices) {
        hasCorruptVoices = true;
        console.log(label + ' - Spanish course with no Spanish voices');
      }
      if (course.targetLanguage === 'fr' && !hasFrenchVoices) {
        hasCorruptVoices = true;
        console.log(label + ' - French course with no French voices');
      }
      if (course.targetLanguage === 'ar' && !hasArabicVoices) {
        hasCorruptVoices = true;
        console.log(label + ' - Arabic course with no Arabic voices');
      }
      
      // Check for Japanese voices in non-Japanese courses
      if (course.targetLanguage !== 'ja' && hasJapaneseVoices) {
        hasCorruptVoices = true;
        console.log(label + ' - has Japanese voices (corrupt!)');
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
