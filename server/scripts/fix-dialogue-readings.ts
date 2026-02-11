/**
 * Fix dialogue sentence metadata by regenerating readings with Gemini.
 * Usage: npx tsx server/scripts/fix-dialogue-readings.ts <dialogueId>
 */
import { PrismaClient, Prisma } from '@prisma/client';
import { generateWithGemini } from '../src/services/geminiClient.js';
import { stripFuriganaToKana } from '../src/services/pronunciation/furiganaUtils.js';

const prisma = new PrismaClient();

async function main() {
  const dialogueId = process.argv[2];
  if (!dialogueId) {
    console.error('Usage: npx tsx server/scripts/fix-dialogue-readings.ts <dialogueId>');
    process.exit(1);
  }

  const sentences = await prisma.sentence.findMany({
    where: { dialogueId },
    orderBy: { order: 'asc' },
    select: { id: true, text: true, metadata: true },
  });

  if (sentences.length === 0) {
    console.error('No sentences found for dialogue:', dialogueId);
    process.exit(1);
  }

  console.log(`Found ${sentences.length} sentences. Generating correct readings with Gemini...`);

  // Build a batch prompt for all sentences
  const sentenceList = sentences.map((s, i) => `${i + 1}. ${s.text}`).join('\n');

  const prompt = `Convert each Japanese sentence to bracket-notation furigana.

Rules:
- Each kanji word is immediately followed by [hiragana reading]
- Only kanji characters get brackets; hiragana, katakana, and punctuation are left as-is
- IMPORTANT: Use the correct CONTEXTUAL reading, not just the default reading
  - この前 → この前[まえ] (NOT 前[ぜん])
  - 何を → 何[なに]を (NOT 何[なん]を when meaning "what" as object)
  - 食べた → 食[た]べた
  - 美味しい → 美味[おい]しい

Return a JSON array with one bracket-notation string per sentence, in the same order.

Sentences:
${sentenceList}

Return ONLY the JSON array, no explanation. Example format:
["この前[まえ]北海道[ほっかいどう]に行[い]った", "うん、そうだよ"]`;

  const response = await generateWithGemini(prompt);
  let jsonText = response.trim();
  jsonText = jsonText.replace(/^```(?:json)?[\r\n]*/, '');
  jsonText = jsonText.replace(/[\r\n]*```\s*$/, '');
  jsonText = jsonText.trim();

  const readings: string[] = JSON.parse(jsonText);

  if (readings.length !== sentences.length) {
    console.error(`Mismatch: got ${readings.length} readings for ${sentences.length} sentences`);
    process.exit(1);
  }

  // Update each sentence's metadata
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const furigana = readings[i];
    const kana = stripFuriganaToKana(furigana);

    const oldMeta = sentence.metadata as Record<string, unknown> || {};
    const newMeta = {
      ...oldMeta,
      japanese: {
        kanji: sentence.text,
        kana,
        furigana,
      },
    };

    await prisma.sentence.update({
      where: { id: sentence.id },
      data: { metadata: newMeta as Prisma.JsonValue },
    });

    console.log(`  [${i + 1}/${sentences.length}] ${sentence.text}`);
    console.log(`    furigana: ${furigana}`);
    console.log(`    kana:     ${kana}`);
  }

  console.log('\nDone! All sentence metadata updated.');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
