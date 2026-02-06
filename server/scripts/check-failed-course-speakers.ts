import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const targets = [
    { lang: 'ja', level: 'N4', field: 'jlptLevel' },
  ];

  for (const target of targets) {
    const where: any = {
      title: 'Travel & Transportation',
      targetLanguage: target.lang,
      isSampleContent: true,
    };
    where[target.field] = target.level;

    const course = await prisma.course.findFirst({
      where,
      include: {
        courseEpisodes: {
          include: {
            episode: {
              include: {
                dialogue: {
                  include: {
                    speakers: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!course) continue;

    const label = target.lang.toUpperCase() + ' ' + target.level;
    console.log('\n' + label + ' Course Episodes:');
    
    course.courseEpisodes.forEach((ce, idx) => {
      const ep = ce.episode;
      console.log('  ' + (idx + 1) + '. ' + ep.title + ' (lang: ' + ep.targetLanguage + ')');
      if (ep.dialogue) {
        ep.dialogue.speakers.forEach(s => {
          console.log('       ' + s.name + ': ' + s.voiceId + ' (' + s.voiceProvider + ')');
        });
      }
    });
  }

  await prisma.$disconnect();
}

main().catch(console.error).finally(() => process.exit(0));
