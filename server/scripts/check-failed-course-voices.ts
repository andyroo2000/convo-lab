import { prisma } from '../src/db/client.js';

async function main() {
  const course = await prisma.course.findFirst({
    where: {
      title: 'Travel & Transportation',
      targetLanguage: 'ja',
      status: 'error',
    },
    select: {
      id: true,
      jlptLevel: true,
      courseEpisodes: {
        include: {
          episode: {
            select: {
              title: true,
              dialogue: {
                select: {
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
          },
        },
      },
    },
  });

  console.log('Failed Course Voice Configuration:');
  console.log(JSON.stringify(course, null, 2));

  await prisma.$disconnect();
}

main();
