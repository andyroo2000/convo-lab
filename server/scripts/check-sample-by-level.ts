import { prisma } from '../src/db/client.js';

async function checkSampleByLevel() {
  const episodes = await prisma.episode.findMany({
    where: { isSampleContent: true },
    include: {
      dialogue: {
        include: {
          speakers: {
            select: {
              proficiency: true,
            },
            take: 1,
          },
        },
      },
    },
  });

  const byLanguageLevel: Record<string, { language: string; level: string; count: number; titles: string[] }> = {};

  for (const ep of episodes) {
    const lang = ep.targetLanguage;
    const level = ep.dialogue?.speakers[0]?.proficiency || 'unknown';
    const key = `${lang}_${level}`;

    if (!byLanguageLevel[key]) {
      byLanguageLevel[key] = { language: lang, level, count: 0, titles: [] };
    }
    byLanguageLevel[key].count++;
    if (byLanguageLevel[key].titles.length < 3) {
      byLanguageLevel[key].titles.push(ep.title);
    }
  }

  console.log('\n📊 Sample Content by Language & Level:\n');
  Object.entries(byLanguageLevel)
    .sort()
    .forEach(([_key, data]) => {
      console.log(`${data.language.toUpperCase()} - ${data.level}: ${data.count} dialogues`);
      console.log(`  Examples: ${data.titles.join(', ')}`);
      console.log('');
    });

  console.log(`\nTotal: ${episodes.length} sample dialogues across ${Object.keys(byLanguageLevel).length} language/level combinations\n`);

  await prisma.$disconnect();
}

checkSampleByLevel();
