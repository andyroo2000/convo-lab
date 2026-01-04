const fs = require('fs');
const path = require('path');

// French pronunciation mapping helper
const getPronunciation = (word, pos) => {
  // This is a simplified pronunciation guide system
  // In production, this would use a comprehensive phonetic database

  const pronunciationMap = {
    // Common words with known pronunciations
    'être': 'eh-truh',
    'avoir': 'ah-vwahr',
    'faire': 'fehr',
    'aller': 'ah-lay',
    'pouvoir': 'poo-vwahr',
    'vouloir': 'voo-lwahr',
    'devoir': 'duh-vwahr',
    'savoir': 'sah-vwahr',
    'dire': 'deer',
    'voir': 'vwahr',
    'suivre': 'swee-vruh',
    'prendre': 'pron-druh',
    'venir': 'vuh-neer',
    'mettre': 'meh-truh',
    'partir': 'pahr-teer',
    'sortir': 'sor-teer',
    'dormir': 'dor-meer',
    'servir': 'sehr-veer',
    'sentir': 'son-teer',
    'ouvrir': 'oo-vreer',
    'offrir': 'o-freer',
    'découvrir': 'day-koo-vreer',
    'souffrir': 'soo-freer',
    'tenir': 'tuh-neer',
    'obtenir': 'ob-tuh-neer',
    'devenir': 'duh-vuh-neer',
    'revenir': 'ruh-vuh-neer',
    'se souvenir': 'suh soo-vuh-neer',
    'appartenir': 'ah-pahr-tuh-neer',
    'contenir': 'kon-tuh-neer',
    'maintenir': 'man-tuh-neer',
    'retenir': 'ruh-tuh-neer',
    'soutenir': 'soo-tuh-neer',
    'comprendre': 'kom-pron-druh',
    'apprendre': 'ah-pron-druh',
    'surprendre': 'soor-pron-druh',
    'reprendre': 'ruh-pron-druh',
    'entreprendre': 'on-truh-pron-druh',
    'connaître': 'ko-neh-truh',
    'reconnaître': 'ruh-ko-neh-truh',
    'paraître': 'pah-reh-truh',
    'apparaître': 'ah-pah-reh-truh',
    'disparaître': 'dees-pah-reh-truh',
    'conduire': 'kon-dweer',
    'produire': 'pro-dweer',
    'traduire': 'trah-dweer',
    'introduire': 'an-tro-dweer',
    'réduire': 'ray-dweer',
    'construire': 'kon-strweer',
    'détruire': 'day-trweer',
    'instruire': 'an-strweer',
    'écrire': 'ay-kreer',
    'décrire': 'day-kreer',
    'inscrire': 'an-skreer',
    'prescrire': 'preh-skreer',
    'lire': 'leer',
    'élire': 'ay-leer',
    'relire': 'ruh-leer',
    'boire': 'bwahr',
    'croire': 'krwahr',
    'vivre': 'vee-vruh',
    'survivre': 'soor-vee-vruh',
    'rire': 'reer',
    'sourire': 'soo-reer',
    'suffire': 'soo-feer',
    'plaire': 'plehr',
    'taire': 'tehr',
    'naître': 'neh-truh',
    'croître': 'krwah-truh',
    'battre': 'bah-truh',
    'combattre': 'kom-bah-truh',
    'abattre': 'ah-bah-truh',
    'rompre': 'rom-pruh',
    'corrompre': 'ko-rom-pruh',
    'interrompre': 'an-teh-rom-pruh',
    'vaincre': 'van-kruh',
    'convaincre': 'kon-van-kruh',
    'peindre': 'pan-druh',
    'craindre': 'kran-druh',
    'joindre': 'zhwan-druh',
    'rejoindre': 'ruh-zhwan-druh',
    'atteindre': 'ah-tan-druh',
    'éteindre': 'ay-tan-druh',
    'ceindre': 'san-druh',
    'feindre': 'fan-druh',
    'geindre': 'zhan-druh',
    'plaindre': 'plan-druh',
    'teindre': 'tan-druh',
    'résoudre': 'ray-zoo-druh',
    'dissoudre': 'dee-soo-druh',
    'absoudre': 'ab-soo-druh',
    'coudre': 'koo-druh',
    'moudre': 'moo-druh',
    'conclure': 'kon-kloor',
    'exclure': 'ex-kloor',
    'inclure': 'an-kloor'
  };

  // If exact match found, return it
  if (pronunciationMap[word.toLowerCase()]) {
    return pronunciationMap[word.toLowerCase()];
  }

  // Simple pronunciation rules for common patterns
  let pronunciation = word.toLowerCase();

  // Basic French pronunciation patterns
  pronunciation = pronunciation
    .replace(/tion$/, 'syon')
    .replace(/eur$/, 'uhr')
    .replace(/eau/g, 'oh')
    .replace(/au/g, 'oh')
    .replace(/ou/g, 'oo')
    .replace(/eu/g, 'uh')
    .replace(/œu/g, 'uh')
    .replace(/ai/g, 'eh')
    .replace(/ei/g, 'eh')
    .replace(/oi/g, 'wah')
    .replace(/oy/g, 'wah-yee')
    .replace(/ui/g, 'wee')
    .replace(/qu/g, 'k')
    .replace(/ch/g, 'sh')
    .replace(/ph/g, 'f')
    .replace(/gn/g, 'nyuh')
    .replace(/ill/g, 'ee-yuh')
    .replace(/eil/g, 'ay-yuh')
    .replace(/euil/g, 'uh-yuh')
    .replace(/ail/g, 'ah-yuh')
    .replace(/an/g, 'on')
    .replace(/en/g, 'on')
    .replace(/in/g, 'an')
    .replace(/un/g, 'uhn')
    .replace(/on/g, 'on')
    .replace(/é/g, 'ay')
    .replace(/è/g, 'eh')
    .replace(/ê/g, 'eh')
    .replace(/ë/g, 'eh')
    .replace(/à/g, 'ah')
    .replace(/â/g, 'ah')
    .replace(/î/g, 'ee')
    .replace(/ï/g, 'ee')
    .replace(/ô/g, 'oh')
    .replace(/ù/g, 'oo')
    .replace(/û/g, 'oo')
    .replace(/ç/g, 's')
    .replace(/j/g, 'zh')
    .replace(/ge/g, 'zhuh')
    .replace(/gi/g, 'zhee');

  return pronunciation;
};

// Map FLELex POS to our system
const mapPartOfSpeech = (pos) => {
  const posMap = {
    'verb': 'verb',
    'noun': 'noun',
    'adjective': 'adjective',
    'adverb': 'adverb',
    'preposition': 'preposition',
    'conjunction': 'conjunction',
    'pronoun': 'pronoun',
    'determiner': 'article',
    'article': 'article',
    'interjection': 'expression',
    'numeral': 'number'
  };

  return posMap[pos.toLowerCase()] || pos;
};

// Translate word to English (simplified - would need proper dictionary)
const getTranslation = (word, pos) => {
  // This would ideally use a French-English dictionary API
  // For now, returning a placeholder
  return word; // Placeholder - needs proper translation
};

// Load FLELex data and existing A1 file
console.log('Loading FLELex data...');
const flelex_a1 = JSON.parse(fs.readFileSync('/tmp/flelex_A1.json', 'utf8'));
const flelex_a2 = JSON.parse(fs.readFileSync('/tmp/flelex_A2.json', 'utf8'));
const flelex_b1 = JSON.parse(fs.readFileSync('/tmp/flelex_B1.json', 'utf8'));
const flelex_b2 = JSON.parse(fs.readFileSync('/tmp/flelex_B2.json', 'utf8'));
const flelex_c1 = JSON.parse(fs.readFileSync('/tmp/flelex_C1.json', 'utf8'));
const flelex_c2 = JSON.parse(fs.readFileSync('/tmp/flelex_C2.json', 'utf8'));

const existingA1 = JSON.parse(fs.readFileSync('/Users/andrewlandry/source/convo-lab/server/src/data/vocabulary/fr/A1.json', 'utf8'));

console.log('FLELex data loaded:');
console.log(`A1: ${flelex_a1.length} words`);
console.log(`A2: ${flelex_a2.length} words`);
console.log(`B1: ${flelex_b1.length} words`);
console.log(`B2: ${flelex_b2.length} words`);
console.log(`C1: ${flelex_c1.length} words`);
console.log(`C2: ${flelex_c2.length} words`);
console.log(`Existing A1: ${existingA1.vocabulary.length} words`);

// Create a map of existing A1 words
const existingA1Words = new Set(existingA1.vocabulary.map(v => v.word.toLowerCase()));

console.log('\n=== This script will output word lists for manual translation ===');
console.log('Due to the complexity of accurate French-English translation,');
console.log('this script will generate word lists that need manual translation.\n');

// For A1, we need to expand from 311 to 800
console.log('Processing A1 level (expanding to 800 words)...');
const a1NewWords = flelex_a1
  .filter(w => !existingA1Words.has(w.word.toLowerCase()))
  .slice(0, 800 - existingA1.vocabulary.length)
  .map(w => ({
    word: w.word,
    pos: w.pos,
    freq: w.freq
  }));

console.log(`Found ${a1NewWords.length} new words for A1`);

// Write out the word lists for manual processing
const outputDir = '/Users/andrewlandry/source/convo-lab/vocab_to_translate';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(
  path.join(outputDir, 'a1_new_words.json'),
  JSON.stringify(a1NewWords, null, 2)
);

console.log(`\nWord lists written to: ${outputDir}`);
console.log('\nNext steps:');
console.log('1. Use a translation service or dictionary to translate these words');
console.log('2. Add pronunciation guides for each word');
console.log('3. Run the compilation script to generate final vocabulary files');
