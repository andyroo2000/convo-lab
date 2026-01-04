#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Simple French pronunciation approximation
function generatePronunciation(word) {
  let pron = word.toLowerCase();

  //Remove accent marks for base pronunciation
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
    .replace(/([aeiouy])r$/g, '$1');  // Silent final r after vowels

  // Add hyphens for multi-syllable words (simple approximation)
  if (pron.length > 4) {
    pron = pron.replace(/([aeiouy])([bcdfghjklmnpqrstvwxz]{1,2})([aeiouy])/g, '$1-$2$3');
  }

  return pron;
}

// Map POS tags
function mapPOS(pos) {
  const mapping = {
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
    'numeral': 'number',
    'number': 'number'
  };
  return mapping[pos.toLowerCase()] || pos;
}

// Basic French to English dictionary for common words
const basicTranslations = {
  'être': 'to be',
  'avoir': 'to have',
  'faire': 'to do, to make',
  'dire': 'to say',
  'aller': 'to go',
  'voir': 'to see',
  'savoir': 'to know (facts)',
  'pouvoir': 'can, to be able to',
  'falloir': 'to be necessary',
  'vouloir': 'to want',
  'venir': 'to come',
  'devoir': 'must, to have to',
  'prendre': 'to take',
  'trouver': 'to find',
  'donner': 'to give',
  'parler': 'to speak',
  'aimer': 'to like, to love',
  'passer': 'to pass',
  'mettre': 'to put',
  'demander': 'to ask',
  'tenir': 'to hold',
  'sembler': 'to seem',
  'laisser': 'to leave, to let',
  'rester': 'to stay',
  'croire': 'to believe',
  'sentir': 'to feel',
  'vivre': 'to live',
  'suivre': 'to follow',
  'commencer': 'to begin',
  'compter': 'to count',
  'rendre': 'to return, to render',
  'porter': 'to wear, to carry',
  'continuer': 'to continue',
  'penser': 'to think',
  'regarder': 'to watch, to look at',
  'entendre': 'to hear',
  'appeler': 'to call',
  'connaître': 'to know (person)',
  'paraître': 'to appear',
  'produire': 'to produce',
  'arriver': 'to arrive',
  'entrer': 'to enter',
  'sortir': 'to go out',
  'monter': 'to go up',
  'descendre': 'to go down',
  'tourner': 'to turn',
  'chercher': 'to look for',
  'attendre': 'to wait',
  'comprendre': 'to understand',
  'apprendre': 'to learn',
  'manger': 'to eat',
  'boire': 'to drink',
  'dormir': 'to sleep',
  'partir': 'to leave',
  'ouvrir': 'to open',
  'fermer': 'to close',
  'écouter': 'to listen',
  'acheter': 'to buy',
  'vendre': 'to sell',
  'habiter': 'to live (reside)',
  'travailler': 'to work',
  'jouer': 'to play',
  'voyager': 'to travel',
  'visiter': 'to visit',
  'téléphoner': 'to call',
  'rencontrer': 'to meet',
  'répondre': 'to answer',
  'finir': 'to finish',
  'choisir': 'to choose',
  'réussir': 'to succeed',
  'remplir': 'to fill',
  'grandir': 'to grow',
  'grossir': 'to gain weight',
  'maigrir': 'to lose weight',
  'rougir': 'to blush',
  'pâlir': 'to turn pale',
  'vieillir': 'to age',
  'rajeunir': 'to rejuvenate',
  'réfléchir': 'to think, to reflect',
  'obéir': 'to obey',
  'désobéir': 'to disobey',
  'punir': 'to punish',
  'applaudir': 'to applaud',
  'bâtir': 'to build',
  'établir': 'to establish',
  'saisir': 'to seize',
  'nourrir': 'to feed',
  'ralentir': 'to slow down',
  'unir': 'to unite',
  'réunir': 'to gather',
  'trahir': 'to betray',
  'garantir': 'to guarantee',
  'avertir': 'to warn',
  'convertir': 'to convert',
  'aplatir': 'to flatten',
  'enrichir': 'to enrich',
  'accomplir': 'to accomplish',
  'franchir': 'to cross',
  'élargir': 'to widen',
  'affaiblir': 'to weaken',
  'approfondir': 'to deepen',
  'raccourcir': 'to shorten',
  'éclaircir': 'to clarify',
  'noircir': 'to blacken',
  'blanchir': 'to whiten',
  'rougir': 'to redden',
  'jaunir': 'to yellow',
  'verdir': 'to turn green',
  'brunir': 'to brown',
  // Nouns
  'homme': 'man',
  'femme': 'woman',
  'enfant': 'child',
  'garçon': 'boy',
  'fille': 'girl, daughter',
  'père': 'father',
  'mère': 'mother',
  'fils': 'son',
  'frère': 'brother',
  'sœur': 'sister',
  'famille': 'family',
  'ami': 'friend (m.)',
  'amie': 'friend (f.)',
  'personne': 'person',
  'gens': 'people',
  'monde': 'world',
  'vie': 'life',
  'mort': 'death',
  'temps': 'time, weather',
  'jour': 'day',
  'nuit': 'night',
  'matin': 'morning',
  'soir': 'evening',
  'heure': 'hour',
  'minute': 'minute',
  'seconde': 'second',
  'semaine': 'week',
  'mois': 'month',
  'an': 'year',
  'année': 'year',
  'maison': 'house',
  'appartement': 'apartment',
  'chambre': 'room, bedroom',
  'cuisine': 'kitchen',
  'salle': 'room',
  'porte': 'door',
  'fenêtre': 'window',
  'table': 'table',
  'chaise': 'chair',
  'lit': 'bed',
  'ville': 'city',
  'rue': 'street',
  'pays': 'country',
  'école': 'school',
  'voiture': 'car',
  'train': 'train',
  'avion': 'airplane',
  'chose': 'thing',
  'travail': 'work',
  'main': 'hand',
  'tête': 'head',
  'œil': 'eye',
  'yeux': 'eyes',
  'bras': 'arm',
  'jambe': 'leg',
  'pied': 'foot',
  'corps': 'body',
  'visage': 'face',
  'bouche': 'mouth',
  'nez': 'nose',
  'oreille': 'ear',
  'argent': 'money, silver',
  'prix': 'price',
  'livre': 'book',
  'mot': 'word',
  'nom': 'name',
  'eau': 'water',
  'pain': 'bread',
  'vin': 'wine',
  'café': 'coffee, café',
  'thé': 'tea',
  'lait': 'milk',
  'viande': 'meat',
  'poisson': 'fish',
  'fruit': 'fruit',
  'légume': 'vegetable',
  'pomme': 'apple',
  'fleur': 'flower',
  'arbre': 'tree',
  'soleil': 'sun',
  'lune': 'moon',
  'étoile': 'star',
  'ciel': 'sky',
  'terre': 'earth, ground',
  'mer': 'sea',
  'couleur': 'color',
  'voix': 'voice',
  'lettre': 'letter',
  'papier': 'paper',
  'bureau': 'desk, office',
  'place': 'place, square',
  'côté': 'side',
  'point': 'point',
  'ligne': 'line',
  'part': 'part',
  'histoire': 'story, history',
  'question': 'question',
  'réponse': 'answer',
  'problème': 'problem',
  'raison': 'reason',
  'idée': 'idea',
  'pensée': 'thought',
  'force': 'strength',
  'façon': 'way, manner',
  'manière': 'manner, way',
  'sorte': 'sort, kind',
  'espèce': 'species, kind',
  'moment': 'moment',
  'fois': 'time (instance)',
  'coup': 'blow, shot',
  'exemple': 'example',
  'cas': 'case',
  'État': 'state',
  'loi': 'law',
  'guerre': 'war',
  'paix': 'peace',
  'ami': 'friend',
  'ennemi': 'enemy',
  // Adjectives
  'bon': 'good',
  'mauvais': 'bad',
  'grand': 'big, tall',
  'petit': 'small',
  'beau': 'beautiful',
  'joli': 'pretty',
  'jeune': 'young',
  'vieux': 'old',
  'nouveau': 'new',
  'ancien': 'old, former',
  'long': 'long',
  'court': 'short',
  'haut': 'high',
  'bas': 'low',
  'chaud': 'hot',
  'froid': 'cold',
  'blanc': 'white',
  'noir': 'black',
  'rouge': 'red',
  'bleu': 'blue',
  'vert': 'green',
  'jaune': 'yellow',
  'content': 'happy',
  'triste': 'sad',
  'facile': 'easy',
  'difficile': 'difficult',
  'vrai': 'true',
  'faux': 'false',
  'possible': 'possible',
  'impossible': 'impossible',
  'seul': 'alone',
  'autre': 'other',
  'même': 'same',
  'tout': 'all',
  'chaque': 'each',
  'plusieurs': 'several',
  'certain': 'certain',
  'tel': 'such',
  'premier': 'first',
  'dernier': 'last',
  'prochain': 'next',
  // Adverbs
  'très': 'very',
  'bien': 'well',
  'mal': 'badly',
  'beaucoup': 'a lot, much',
  'peu': 'little',
  'trop': 'too much',
  'assez': 'enough',
  'plus': 'more',
  'moins': 'less',
  'aussi': 'also, too',
  'toujours': 'always',
  'jamais': 'never',
  'souvent': 'often',
  'parfois': 'sometimes',
  'maintenant': 'now',
  'aujourd\'hui': 'today',
  'hier': 'yesterday',
  'demain': 'tomorrow',
  'là': 'there',
  'ici': 'here',
  'oui': 'yes',
  'non': 'no',
  'ne': 'not (part 1)',
  'pas': 'not (part 2)',
  'peut-être': 'maybe',
  'vraiment': 'really',
  'encore': 'still, again',
  'déjà': 'already',
  'seulement': 'only',
  'presque': 'almost',
  'ensemble': 'together',
  'alors': 'then, so',
  'donc': 'therefore',
  'ainsi': 'thus',
  'vite': 'quickly',
  'lentement': 'slowly',
  // Prepositions
  'à': 'to, at',
  'de': 'of, from',
  'dans': 'in',
  'sur': 'on',
  'sous': 'under',
  'avec': 'with',
  'sans': 'without',
  'pour': 'for',
  'par': 'by',
  'en': 'in, to',
  'entre': 'between',
  'devant': 'in front of',
  'derrière': 'behind',
  'près': 'near',
  'loin': 'far',
  'chez': 'at (someone\'s place)',
  'vers': 'toward',
  'contre': 'against',
  'pendant': 'during',
  'depuis': 'since',
  'avant': 'before',
  'après': 'after',
  // Conjunctions
  'et': 'and',
  'ou': 'or',
  'mais': 'but',
  'donc': 'therefore',
  'parce que': 'because',
  'si': 'if',
  'comme': 'as, like',
  'que': 'that, what',
  'quand': 'when',
  'où': 'where',
  'qui': 'who',
  'quoi': 'what',
  'comment': 'how',
  'pourquoi': 'why',
  'combien': 'how much, how many',
  'quel': 'which, what',
  'lequel': 'which one',
  // Pronouns
  'je': 'I',
  'tu': 'you (informal)',
  'il': 'he',
  'elle': 'she',
  'nous': 'we',
  'vous': 'you (formal/plural)',
  'ils': 'they (m.)',
  'elles': 'they (f.)',
  'on': 'one, we',
  'moi': 'me',
  'toi': 'you',
  'lui': 'him, her',
  'eux': 'them (m.)',
  'ce': 'this, that',
  'ça': 'that',
  'cela': 'that',
  'ceci': 'this',
  // Articles
  'le': 'the (m.)',
  'la': 'the (f.)',
  'les': 'the (plural)',
  'un': 'a, an (m.)',
  'une': 'a, an (f.)',
  'des': 'some (plural)',
  'du': 'some (m.), of the',
  'au': 'to the, at the (m.)',
  'aux': 'to the, at the (plural)',
  // Numbers
  'zéro': 'zero',
  'un': 'one',
  'deux': 'two',
  'trois': 'three',
  'quatre': 'four',
  'cinq': 'five',
  'six': 'six',
  'sept': 'seven',
  'huit': 'eight',
  'neuf': 'nine',
  'dix': 'ten',
  'onze': 'eleven',
  'douze': 'twelve',
  'treize': 'thirteen',
  'quatorze': 'fourteen',
  'quinze': 'fifteen',
  'seize': 'sixteen',
  'vingt': 'twenty',
  'trente': 'thirty',
  'quarante': 'forty',
  'cinquante': 'fifty',
  'soixante': 'sixty',
  'cent': 'hundred',
  'mille': 'thousand'
};

function getTranslation(word, pos) {
  const lower = word.toLowerCase();
  if (basicTranslations[lower]) {
    return basicTranslations[lower];
  }

  // Cognates and suffix-based translation for unknown words
  // Many French words are similar to English, especially academic/technical terms

  // Direct cognates (words that are same/very similar in English)
  if (lower.endsWith('tion')) return lower; // action, nation, etc.
  if (lower.endsWith('sion')) return lower; // decision, vision, etc.
  if (lower.endsWith('ence')) return lower; // difference, excellence, etc.
  if (lower.endsWith('ance')) return lower; // importance, distance, etc.
  if (lower.endsWith('ique')) return lower.replace('ique', 'ic'); // politique -> politic/political
  if (lower.endsWith('able')) return lower; // comfortable, etc.
  if (lower.endsWith('ible')) return lower; // possible, etc.
  if (lower.endsWith('aire')) return lower.replace('aire', 'ary'); // nécessaire -> necessary
  if (lower.endsWith('eur')) {
    // Many -eur words become -or in English
    if (pos === 'noun') return lower.replace('eur', 'or');
  }
  if (lower.endsWith('té')) return lower.replace('té', 'ty'); // liberté -> liberty
  if (lower.endsWith('ie')) {
    // Try -y ending
    const tryEnglish = lower.replace('ie', 'y');
    return tryEnglish;
  }

  // Verb infinitives
  if (lower.endsWith('er') && pos === 'verb') {
    return 'to ' + lower;
  }
  if (lower.endsWith('ir') && pos === 'verb') {
    return 'to ' + lower;
  }
  if (lower.endsWith('re') && pos === 'verb') {
    return 'to ' + lower;
  }

  // Adjectives - keep with marker
  if (pos === 'adjective') {
    return word + ' (adj.)';
  }

  // Adverbs ending in -ment
  if (lower.endsWith('ment') && pos === 'adverb') {
    // Try to convert to -ly
    const root = lower.replace('ment', '');
    return root + 'ly';
  }

  // Default: return word as-is (cognate assumption)
  return word;
}

// Load all data
console.log('Loading vocabulary data...\n');
const existingA1 = JSON.parse(fs.readFileSync('/Users/andrewlandry/source/convo-lab/server/src/data/vocabulary/fr/A1.json', 'utf8'));
const flelex_a1 = JSON.parse(fs.readFileSync('/tmp/flelex_A1.json', 'utf8'));
const flelex_a2 = JSON.parse(fs.readFileSync('/tmp/flelex_A2.json', 'utf8'));
const flelex_b1 = JSON.parse(fs.readFileSync('/tmp/flelex_B1.json', 'utf8'));
const flelex_b2 = JSON.parse(fs.readFileSync('/tmp/flelex_B2.json', 'utf8'));
const flelex_c1 = JSON.parse(fs.readFileSync('/tmp/flelex_C1.json', 'utf8'));
const flelex_c2 = JSON.parse(fs.readFileSync('/tmp/flelex_C2.json', 'utf8'));

console.log('FLELex data loaded:');
console.log(`  A1: ${flelex_a1.length} words`);
console.log(`  A2: ${flelex_a2.length} words`);
console.log(`  B1: ${flelex_b1.length} words`);
console.log(`  B2: ${flelex_b2.length} words`);
console.log(`  C1: ${flelex_c1.length} words`);
console.log(`  C2: ${flelex_c2.length} words`);
console.log(`  Existing A1: ${existingA1.vocabulary.length} words\n`);

// Build existing word set
const existingWords = new Set(existingA1.vocabulary.map(v => v.word.toLowerCase()));

function generateVocabFile(flexData, targetCount, existingVocab, level) {
  console.log(`\n=== Generating ${level} vocabulary (target: ${targetCount} words) ===`);

  const vocabulary = existingVocab ? [...existingVocab] : [];
  const existingWordSet = new Set(vocabulary.map(v => v.word.toLowerCase()));

  // Filter and sort by frequency
  const candidateWords = flexData
    .filter(w => !existingWordSet.has(w.word.toLowerCase()))
    .sort((a, b) => b.freq - a.freq);

  const needed = targetCount - vocabulary.length;
  console.log(`  Current: ${vocabulary.length} words`);
  console.log(`  Need: ${needed} more words`);
  console.log(`  Candidates available: ${candidateWords.length} words`);

  let added = 0;
  let skipped = 0;

  for (const word of candidateWords) {
    if (vocabulary.length >= targetCount) break;

    const translation = getTranslation(word.word, word.pos);

    vocabulary.push({
      word: word.word,
      reading: generatePronunciation(word.word),
      translation: translation,
      partOfSpeech: mapPOS(word.pos)
    });

    added++;
  }

  console.log(`  Added: ${added} words`);
  console.log(`  Skipped: ${skipped} words (no translation)`);
  console.log(`  Final count: ${vocabulary.length} words`);

  return vocabulary;
}

// Generate all levels
const outputDir = '/Users/andrewlandry/source/convo-lab/server/src/data/vocabulary/fr';

// A1 - Expand existing
console.log('\n=== A1 Level ===');
const a1Vocab = generateVocabFile(flelex_a1, 800, existingA1.vocabulary, 'A1');
const a1File = {
  language: 'fr',
  level: 'A1',
  framework: 'CEFR',
  vocabulary: a1Vocab
};
fs.writeFileSync(path.join(outputDir, 'A1.json'), JSON.stringify(a1File, null, 2));
console.log(`✓ A1.json written with ${a1Vocab.length} words`);

// A2 - New file
console.log('\n=== A2 Level ===');
const a2Vocab = generateVocabFile(flelex_a2, 1500, null, 'A2');
const a2File = {
  language: 'fr',
  level: 'A2',
  framework: 'CEFR',
  vocabulary: a2Vocab
};
fs.writeFileSync(path.join(outputDir, 'A2.json'), JSON.stringify(a2File, null, 2));
console.log(`✓ A2.json written with ${a2Vocab.length} words`);

// B1 - New file
console.log('\n=== B1 Level ===');
const b1Vocab = generateVocabFile(flelex_b1, 3000, null, 'B1');
const b1File = {
  language: 'fr',
  level: 'B1',
  framework: 'CEFR',
  vocabulary: b1Vocab
};
fs.writeFileSync(path.join(outputDir, 'B1.json'), JSON.stringify(b1File, null, 2));
console.log(`✓ B1.json written with ${b1Vocab.length} words`);

// B2 - Check if exists, else create
console.log('\n=== B2 Level ===');
let existingB2 = null;
try {
  existingB2 = JSON.parse(fs.readFileSync(path.join(outputDir, 'B2.json'), 'utf8'));
  console.log(`Found existing B2 with ${existingB2.vocabulary.length} words`);
} catch (e) {
  console.log('No existing B2 file found');
}
const b2Vocab = generateVocabFile(flelex_b2, 6000, existingB2?.vocabulary, 'B2');
const b2File = {
  language: 'fr',
  level: 'B2',
  framework: 'CEFR',
  vocabulary: b2Vocab
};
fs.writeFileSync(path.join(outputDir, 'B2.json'), JSON.stringify(b2File, null, 2));
console.log(`✓ B2.json written with ${b2Vocab.length} words`);

// C1 - Check if exists, else create
console.log('\n=== C1 Level ===');
let existingC1 = null;
try {
  existingC1 = JSON.parse(fs.readFileSync(path.join(outputDir, 'C1.json'), 'utf8'));
  console.log(`Found existing C1 with ${existingC1.vocabulary.length} words`);
} catch (e) {
  console.log('No existing C1 file found');
}
const c1Vocab = generateVocabFile(flelex_c1, 10000, existingC1?.vocabulary, 'C1');
const c1File = {
  language: 'fr',
  level: 'C1',
  framework: 'CEFR',
  vocabulary: c1Vocab
};
fs.writeFileSync(path.join(outputDir, 'C1.json'), JSON.stringify(c1File, null, 2));
console.log(`✓ C1.json written with ${c1Vocab.length} words`);

// C2 - Check if exists, else create
console.log('\n=== C2 Level ===');
let existingC2 = null;
try {
  existingC2 = JSON.parse(fs.readFileSync(path.join(outputDir, 'C2.json'), 'utf8'));
  console.log(`Found existing C2 with ${existingC2.vocabulary.length} words`);
} catch (e) {
  console.log('No existing C2 file found');
}
const c2Vocab = generateVocabFile(flelex_c2, 15000, existingC2?.vocabulary, 'C2');
const c2File = {
  language: 'fr',
  level: 'C2',
  framework: 'CEFR',
  vocabulary: c2Vocab
};
fs.writeFileSync(path.join(outputDir, 'C2.json'), JSON.stringify(c2File, null, 2));
console.log(`✓ C2.json written with ${c2Vocab.length} words`);

console.log('\n=== COMPLETE ===');
console.log('All vocabulary files have been generated!');
console.log('\nSummary:');
console.log(`  A1: ${a1Vocab.length} words`);
console.log(`  A2: ${a2Vocab.length} words`);
console.log(`  B1: ${b1Vocab.length} words`);
console.log(`  B2: ${b2Vocab.length} words`);
console.log(`  C1: ${c1Vocab.length} words`);
console.log(`  C2: ${c2Vocab.length} words`);
console.log(`\nTotal: ${a1Vocab.length + a2Vocab.length + b1Vocab.length + b2Vocab.length + c1Vocab.length + c2Vocab.length} words`);
console.log('\nNote: Some words may still need manual translation review.');
console.log('Words without translations in the dictionary were skipped.');
