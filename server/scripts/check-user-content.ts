import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Load production environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../', '.env.production'), override: true });

const prisma = new PrismaClient();

async function checkUserContent() {
  const email = process.argv[2];

  if (!email) {
    console.error('❌ Please provide an email address');
    process.exit(1);
  }

  try {
    console.log(`🔍 Searching for user: ${email}\n`);

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        displayName: true,
        role: true,
        tier: true,
        createdAt: true,
        preferredStudyLanguage: true,
        preferredNativeLanguage: true,
        proficiencyLevel: true,
      }
    });

    if (!user) {
      console.log('❌ No user found with that email address.');
      return;
    }

    console.log('✅ User found:\n');
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name || 'None'}`);
    if (user.displayName) {
      console.log(`   Display Name: ${user.displayName}`);
    }
    console.log(`   Role: ${user.role} | Tier: ${user.tier}`);
    console.log(`   Study Language: ${user.preferredStudyLanguage}`);
    console.log(`   Native Language: ${user.preferredNativeLanguage}`);
    console.log(`   Proficiency: ${user.proficiencyLevel}`);
    console.log(`   Account Created: ${user.createdAt.toISOString()}`);
    console.log();

    // Check Episodes (Dialogs)
    const episodes = await prisma.episode.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        title: true,
        status: true,
        targetLanguage: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`📝 Episodes/Dialogs: ${episodes.length}`);
    if (episodes.length > 0) {
      episodes.forEach(ep => {
        console.log(`  - "${ep.title}"`);
        console.log(`    Status: ${ep.status}`);
        console.log(`    Language: ${ep.targetLanguage}`);
        console.log(`    Created: ${ep.createdAt.toISOString()}`);
        console.log(`    Updated: ${ep.updatedAt.toISOString()}`);
        console.log();
      });
    } else {
      console.log('  (none)\n');
    }

    // Check Courses
    const courses = await prisma.course.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        title: true,
        status: true,
        targetLanguage: true,
        createdAt: true,
        updatedAt: true,
        description: true,
        jlptLevel: true,
        hskLevel: true,
        cefrLevel: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`🎓 Audio Courses: ${courses.length}`);
    if (courses.length > 0) {
      courses.forEach(course => {
        console.log(`  - "${course.title}"`);
        console.log(`    Status: ${course.status}`);
        console.log(`    Language: ${course.targetLanguage}`);
        if (course.jlptLevel) console.log(`    JLPT Level: ${course.jlptLevel}`);
        if (course.hskLevel) console.log(`    HSK Level: ${course.hskLevel}`);
        if (course.cefrLevel) console.log(`    CEFR Level: ${course.cefrLevel}`);
        if (course.description) {
          console.log(`    Description: ${course.description.substring(0, 150)}${course.description.length > 150 ? '...' : ''}`);
        }
        console.log(`    Created: ${course.createdAt.toISOString()}`);
        console.log(`    Updated: ${course.updatedAt.toISOString()}`);
        console.log();
      });
    } else {
      console.log('  (none)\n');
    }

    // Check Narrow Listening Packs
    const narrowPacks = await prisma.narrowListeningPack.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        title: true,
        status: true,
        targetLanguage: true,
        topic: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`🎧 Narrow Listening Packs: ${narrowPacks.length}`);
    if (narrowPacks.length > 0) {
      narrowPacks.forEach(pack => {
        console.log(`  - "${pack.title}"`);
        console.log(`    Status: ${pack.status}`);
        console.log(`    Language: ${pack.targetLanguage}`);
        console.log(`    Topic: ${pack.topic.substring(0, 100)}${pack.topic.length > 100 ? '...' : ''}`);
        console.log(`    Created: ${pack.createdAt.toISOString()}`);
        console.log(`    Updated: ${pack.updatedAt.toISOString()}`);
        console.log();
      });
    } else {
      console.log('  (none)\n');
    }

    // Check Generation Logs
    const genLogs = await prisma.generationLog.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        contentType: true,
        contentId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`📋 Generation Log Entries: ${genLogs.length}`);
    if (genLogs.length > 0) {
      const logCounts = genLogs.reduce((acc, log) => {
        acc[log.contentType] = (acc[log.contentType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log('  Breakdown by content type:');
      Object.entries(logCounts).forEach(([type, count]) => {
        console.log(`    - ${type}: ${count}`);
      });

      console.log('\n  All attempts (most recent first):');
      genLogs.forEach(log => {
        const date = new Date(log.createdAt);
        const timeAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
        console.log(`    - ${log.contentType} (${timeAgo} days ago) - ${log.createdAt.toISOString()}`);
      });
    } else {
      console.log('  (none)');
    }
    console.log();

    // Summary
    const totalContent = episodes.length + courses.length + narrowPacks.length;
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 Summary for ${user.email}:`);
    console.log(`  Total content pieces: ${totalContent}`);
    console.log(`  Total generation attempts: ${genLogs.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserContent();
