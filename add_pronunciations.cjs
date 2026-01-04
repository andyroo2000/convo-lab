const fs = require('fs');
const path = require('path');

// Simple French pronunciation approximation
function generatePronunciation(word) {
  let pron = word.toLowerCase();

  // Remove accent marks for base pronunciation
  pron = pron
    .replace(/[àâä]/g, 'ah')
    .replace(/[éèêë]/g, 'ay')
    .replace(/[îï]/g, 'ee')
    .replace(/[ôö]/g, 'oh')
    .replace(/[ùûü]/g, 'oo')
    .replace(/ç/g, 's')
    .replace(/œ/g, 'uh');

  // French digraphs and patterns
  pron = pron
    .replace(/tion$/, 'syon')
    .replace(/sion$/, 'zyon')
    .replace(/ment$/, 'mon')
    .replace(/eur$/, 'uhr')
    .replace(/eau/g, 'oh')
    .replace(/au/g, 'oh')
    .replace(/ou/g, 'oo')
    .replace(/eu/g, 'uh')
    .replace(/ai/g, 'eh')
    .replace(/ei/g, 'eh')
    .replace(/oi/g, 'wah')
    .replace(/ui/g, 'wee')
    .replace(/qu/g, 'k')
    .replace(/ch/g, 'sh')
    .replace(/ph/g, 'f')
    .replace(/gn/g, 'nyuh')
    .replace(/ill/g, 'ee')
    .replace(/an/g, 'on')
    .replace(/en/g, 'on')
    .replace(/in/g, 'an')
    .replace(/on/g, 'on')
    .replace(/un/g, 'uhn')
    .replace(/j/g, 'zh')
    .replace(/([aeiouy])r$/g, '$1'); // Silent final r after vowels

  // Add hyphens for multi-syllable words (simple approximation)
  if (pron.length > 4) {
    pron = pron.replace(/([aeiouy])([bcdfghjklmnpqrstvwxz]{1,2})([aeiouy])/g, '$1-$2$3');
  }

  return pron;
}

// Process each file
const outputDir = '/Users/andrewlandry/source/convo-lab/server/src/data/vocabulary/fr';
const levels = ['B2', 'C1', 'C2'];

console.log('Adding pronunciation guides to existing vocabulary files...\n');

levels.forEach(level => {
  const filePath = path.join(outputDir, `${level}.json`);

  console.log(`Processing ${level}...`);

  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    let updated = 0;
    let alreadyHad = 0;

    data.vocabulary.forEach(entry => {
      if (!entry.reading || entry.reading === 'undefined') {
        entry.reading = generatePronunciation(entry.word);
        updated++;
      } else {
        alreadyHad++;
      }
    });

    // Write back to file
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    console.log(`  ✓ Updated ${updated} entries, ${alreadyHad} already had pronunciations`);
    console.log(`  Total: ${data.vocabulary.length} words\n`);

  } catch (error) {
    console.error(`  ✗ Error processing ${level}: ${error.message}\n`);
  }
});

console.log('Done!');
