const fs = require('fs');
const path = require('path');

// Comprehensive French-English dictionary with pronunciations
// This includes common words across all CEFR levels
const frenchDictionary = {
  // Verbs
  'accepter': { translation: 'to accept', pronunciation: 'ak-sep-tay', pos: 'verb' },
  'accompagner': { translation: 'to accompany', pronunciation: 'ah-kom-pahn-yay', pos: 'verb' },
  'accorder': { translation: 'to grant, accord', pronunciation: 'ah-kor-day', pos: 'verb' },
  'accrocher': { translation: 'to hang, hook', pronunciation: 'ah-kro-shay', pos: 'verb' },
  'accueillir': { translation: 'to welcome', pronunciation: 'ah-kuh-yeer', pos: 'verb' },
  'acheter': { translation: 'to buy', pronunciation: 'ahsh-tay', pos: 'verb' },
  'achever': { translation: 'to complete, finish', pronunciation: 'ahsh-vay', pos: 'verb' },
  'acquérir': { translation: 'to acquire', pronunciation: 'ah-kay-reer', pos: 'verb' },
  'admettre': { translation: 'to admit', pronunciation: 'ad-meh-truh', pos: 'verb' },
  'admirer': { translation: 'to admire', pronunciation: 'ad-mee-ray', pos: 'verb' },
  'adorer': { translation: 'to adore', pronunciation: 'ah-do-ray', pos: 'verb' },
  'adresser': { translation: 'to address', pronunciation: 'ah-dreh-say', pos: 'verb' },
  'affirmer': { translation: 'to affirm, assert', pronunciation: 'ah-feer-may', pos: 'verb' },
  'agir': { translation: 'to act', pronunciation: 'ah-zheer', pos: 'verb' },
  'agiter': { translation: 'to shake, agitate', pronunciation: 'ah-zhee-tay', pos: 'verb' },
  'aider': { translation: 'to help', pronunciation: 'ay-day', pos: 'verb' },
  'aimer': { translation: 'to like, love', pronunciation: 'eh-may', pos: 'verb' },
  'ajouter': { translation: 'to add', pronunciation: 'ah-zhoo-tay', pos: 'verb' },
  'aller': { translation: 'to go', pronunciation: 'ah-lay', pos: 'verb' },
  'allumer': { translation: 'to light, turn on', pronunciation: 'ah-loo-may', pos: 'verb' },
  'amener': { translation: 'to bring', pronunciation: 'ahm-nay', pos: 'verb' },
  'améliorer': { translation: 'to improve', pronunciation: 'ah-may-lyo-ray', pos: 'verb' },
  'amuser': { translation: 'to amuse', pronunciation: 'ah-moo-zay', pos: 'verb' },
  'annoncer': { translation: 'to announce', pronunciation: 'ah-non-say', pos: 'verb' },
  'annuler': { translation: 'to cancel', pronunciation: 'ah-noo-lay', pos: 'verb' },
  'apercevoir': { translation: 'to notice, perceive', pronunciation: 'ah-pehr-suh-vwahr', pos: 'verb' },
  'apparaître': { translation: 'to appear', pronunciation: 'ah-pah-reh-truh', pos: 'verb' },
  'appartenir': { translation: 'to belong', pronunciation: 'ah-pahr-tuh-neer', pos: 'verb' },
  'appeler': { translation: 'to call', pronunciation: 'ah-puh-lay', pos: 'verb' },
  'appliquer': { translation: 'to apply', pronunciation: 'ah-plee-kay', pos: 'verb' },
  'apporter': { translation: 'to bring', pronunciation: 'ah-por-tay', pos: 'verb' },
  'apprécier': { translation: 'to appreciate', pronunciation: 'ah-pray-syay', pos: 'verb' },
  'apprendre': { translation: 'to learn', pronunciation: 'ah-pron-druh', pos: 'verb' },
  'approcher': { translation: 'to approach', pronunciation: 'ah-pro-shay', pos: 'verb' },
  'appuyer': { translation: 'to support, press', pronunciation: 'ah-pwee-yay', pos: 'verb' },
  'arranger': { translation: 'to arrange', pronunciation: 'ah-ron-zhay', pos: 'verb' },
  'arrêter': { translation: 'to stop', pronunciation: 'ah-reh-tay', pos: 'verb' },
  'arriver': { translation: 'to arrive', pronunciation: 'ah-ree-vay', pos: 'verb' },
  'asseoir': { translation: 'to sit down', pronunciation: 'ah-swahr', pos: 'verb' },
  'assister': { translation: 'to attend, assist', pronunciation: 'ah-see-stay', pos: 'verb' },
  'assurer': { translation: 'to assure, insure', pronunciation: 'ah-soo-ray', pos: 'verb' },
  'attacher': { translation: 'to attach, tie', pronunciation: 'ah-tah-shay', pos: 'verb' },
  'attaquer': { translation: 'to attack', pronunciation: 'ah-tah-kay', pos: 'verb' },
  'atteindre': { translation: 'to reach, attain', pronunciation: 'ah-tan-druh', pos: 'verb' },
  'attendre': { translation: 'to wait', pronunciation: 'ah-ton-druh', pos: 'verb' },
  'attirer': { translation: 'to attract', pronunciation: 'ah-tee-ray', pos: 'verb' },
  'attraper': { translation: 'to catch', pronunciation: 'ah-trah-pay', pos: 'verb' },
  'augmenter': { translation: 'to increase', pronunciation: 'ohg-mon-tay', pos: 'verb' },
  'autoriser': { translation: 'to authorize', pronunciation: 'oh-to-ree-zay', pos: 'verb' },
  'avancer': { translation: 'to advance, move forward', pronunciation: 'ah-von-say', pos: 'verb' },
  'avertir': { translation: 'to warn', pronunciation: 'ah-vehr-teer', pos: 'verb' },
  'avoir': { translation: 'to have', pronunciation: 'ah-vwahr', pos: 'verb' },
  'avouer': { translation: 'to admit, confess', pronunciation: 'ah-voo-ay', pos: 'verb' },

  // Nouns
  'accord': { translation: 'agreement', pronunciation: 'ah-kor', pos: 'noun' },
  'accueil': { translation: 'welcome, reception', pronunciation: 'ah-kuh-yuh', pos: 'noun' },
  'achat': { translation: 'purchase', pronunciation: 'ah-shah', pos: 'noun' },
  'action': { translation: 'action', pronunciation: 'ak-syon', pos: 'noun' },
  'activité': { translation: 'activity', pronunciation: 'ak-tee-vee-tay', pos: 'noun' },
  'acteur': { translation: 'actor', pronunciation: 'ak-tuhr', pos: 'noun' },
  'actrice': { translation: 'actress', pronunciation: 'ak-trees', pos: 'noun' },
  'addition': { translation: 'bill, check', pronunciation: 'ah-dee-syon', pos: 'noun' },
  'adresse': { translation: 'address', pronunciation: 'ah-dres', pos: 'noun' },
  'adulte': { translation: 'adult', pronunciation: 'ah-doolt', pos: 'noun' },
  'affaire': { translation: 'business, affair', pronunciation: 'ah-fehr', pos: 'noun' },
  'affiche': { translation: 'poster', pronunciation: 'ah-feesh', pos: 'noun' },
  'âge': { translation: 'age', pronunciation: 'ahzh', pos: 'noun' },
  'agence': { translation: 'agency', pronunciation: 'ah-zhons', pos: 'noun' },
  'agent': { translation: 'agent', pronunciation: 'ah-zhon', pos: 'noun' },
  'aide': { translation: 'help', pronunciation: 'ed', pos: 'noun' },
  'air': { translation: 'air, appearance', pronunciation: 'ehr', pos: 'noun' },
  'album': { translation: 'album', pronunciation: 'al-bom', pos: 'noun' },
  'alcool': { translation: 'alcohol', pronunciation: 'al-kol', pos: 'noun' },
  'aliment': { translation: 'food', pronunciation: 'ah-lee-mon', pos: 'noun' },
  'allée': { translation: 'path, aisle', pronunciation: 'ah-lay', pos: 'noun' },
  'ambiance': { translation: 'atmosphere, ambiance', pronunciation: 'om-bee-ons', pos: 'noun' },
  'âme': { translation: 'soul', pronunciation: 'ahm', pos: 'noun' },
  'ami': { translation: 'friend (m.)', pronunciation: 'ah-mee', pos: 'noun' },
  'amie': { translation: 'friend (f.)', pronunciation: 'ah-mee', pos: 'noun' },
  'amitié': { translation: 'friendship', pronunciation: 'ah-mee-tyay', pos: 'noun' },
  'amour': { translation: 'love', pronunciation: 'ah-moor', pos: 'noun' },
  'an': { translation: 'year', pronunciation: 'on', pos: 'noun' },
  'analyse': { translation: 'analysis', pronunciation: 'ah-nah-leez', pos: 'noun' },
  'ancêtre': { translation: 'ancestor', pronunciation: 'on-seh-truh', pos: 'noun' },
  'animal': { translation: 'animal', pronunciation: 'ah-nee-mal', pos: 'noun' },
  'animateur': { translation: 'host, facilitator', pronunciation: 'ah-nee-mah-tuhr', pos: 'noun' },
  'animation': { translation: 'animation, activity', pronunciation: 'ah-nee-mah-syon', pos: 'noun' },
  'année': { translation: 'year', pronunciation: 'ah-nay', pos: 'noun' },
  'anniversaire': { translation: 'birthday, anniversary', pronunciation: 'ah-nee-vehr-sehr', pos: 'noun' },
  'annonce': { translation: 'announcement, ad', pronunciation: 'ah-nons', pos: 'noun' },
  'annuaire': { translation: 'directory, phone book', pronunciation: 'ah-noo-ehr', pos: 'noun' },
  'appartement': { translation: 'apartment', pronunciation: 'ah-pahr-tuh-mon', pos: 'noun' },
  'appareil': { translation: 'device, apparatus', pronunciation: 'ah-pah-ray', pos: 'noun' },
  'apparence': { translation: 'appearance', pronunciation: 'ah-pah-rons', pos: 'noun' },
  'appel': { translation: 'call', pronunciation: 'ah-pel', pos: 'noun' },
  'appétit': { translation: 'appetite', pronunciation: 'ah-pay-tee', pos: 'noun' },
  'application': { translation: 'application', pronunciation: 'ah-plee-kah-syon', pos: 'noun' },
  'après-midi': { translation: 'afternoon', pronunciation: 'ah-preh-mee-dee', pos: 'noun' },
  'arbre': { translation: 'tree', pronunciation: 'ahr-bruh', pos: 'noun' },
  'architecte': { translation: 'architect', pronunciation: 'ahr-shee-tekt', pos: 'noun' },
  'architecture': { translation: 'architecture', pronunciation: 'ahr-shee-tek-toor', pos: 'noun' },
  'argent': { translation: 'money, silver', pronunciation: 'ahr-zhon', pos: 'noun' },
  'arme': { translation: 'weapon', pronunciation: 'ahrm', pos: 'noun' },
  'armée': { translation: 'army', pronunciation: 'ahr-may', pos: 'noun' },
  'armoire': { translation: 'wardrobe, cupboard', pronunciation: 'ahr-mwahr', pos: 'noun' },
  'arrêt': { translation: 'stop', pronunciation: 'ah-reh', pos: 'noun' },
  'arrière': { translation: 'back, rear', pronunciation: 'ah-ree-ehr', pos: 'noun' },
  'arrivée': { translation: 'arrival', pronunciation: 'ah-ree-vay', pos: 'noun' },
  'art': { translation: 'art', pronunciation: 'ahr', pos: 'noun' },
  'article': { translation: 'article', pronunciation: 'ahr-tee-kluh', pos: 'noun' },
  'artiste': { translation: 'artist', pronunciation: 'ahr-teest', pos: 'noun' },
  'ascenseur': { translation: 'elevator', pronunciation: 'ah-son-suhr', pos: 'noun' },
  'aspect': { translation: 'aspect', pronunciation: 'ah-speh', pos: 'noun' },
  'assemblée': { translation: 'assembly', pronunciation: 'ah-som-blay', pos: 'noun' },
  'assiette': { translation: 'plate', pronunciation: 'ah-see-et', pos: 'noun' },
  'association': { translation: 'association', pronunciation: 'ah-so-syah-syon', pos: 'noun' },
  'assurance': { translation: 'insurance, assurance', pronunciation: 'ah-soo-rons', pos: 'noun' },
  'atelier': { translation: 'workshop', pronunciation: 'ah-tuh-lyay', pos: 'noun' },
  'atmosphère': { translation: 'atmosphere', pronunciation: 'at-mos-fehr', pos: 'noun' },
  'attaque': { translation: 'attack', pronunciation: 'ah-tak', pos: 'noun' },
  'attente': { translation: 'waiting, expectation', pronunciation: 'ah-tont', pos: 'noun' },
  'attention': { translation: 'attention', pronunciation: 'ah-ton-syon', pos: 'noun' },
  'attitude': { translation: 'attitude', pronunciation: 'ah-tee-tood', pos: 'noun' },
  'attraction': { translation: 'attraction', pronunciation: 'ah-trak-syon', pos: 'noun' },
  'aube': { translation: 'dawn', pronunciation: 'ohb', pos: 'noun' },
  'auberge': { translation: 'inn', pronunciation: 'oh-berzh', pos: 'noun' },
  'audience': { translation: 'audience, hearing', pronunciation: 'oh-dee-ons', pos: 'noun' },
  'augmentation': { translation: 'increase', pronunciation: 'ohg-mon-tah-syon', pos: 'noun' },
  'aujourd\'hui': { translation: 'today', pronunciation: 'oh-zhoor-dwee', pos: 'adverb' },
  'auteur': { translation: 'author', pronunciation: 'oh-tuhr', pos: 'noun' },
  'auto': { translation: 'car', pronunciation: 'oh-toh', pos: 'noun' },
  'autobus': { translation: 'bus', pronunciation: 'oh-toh-boos', pos: 'noun' },
  'automne': { translation: 'autumn', pronunciation: 'oh-ton', pos: 'noun' },
  'automobile': { translation: 'car', pronunciation: 'oh-toh-mo-beel', pos: 'noun' },
  'autorisation': { translation: 'authorization', pronunciation: 'oh-to-ree-zah-syon', pos: 'noun' },
  'autorité': { translation: 'authority', pronunciation: 'oh-to-ree-tay', pos: 'noun' },
  'autoroute': { translation: 'highway', pronunciation: 'oh-toh-root', pos: 'noun' },
  'avance': { translation: 'advance', pronunciation: 'ah-vons', pos: 'noun' },
  'avantage': { translation: 'advantage', pronunciation: 'ah-von-tahzh', pos: 'noun' },
  'avenir': { translation: 'future', pronunciation: 'ahv-neer', pos: 'noun' },
  'aventure': { translation: 'adventure', pronunciation: 'ah-von-toor', pos: 'noun' },
  'avenue': { translation: 'avenue', pronunciation: 'ahv-noo', pos: 'noun' },
  'avion': { translation: 'airplane', pronunciation: 'ah-vyon', pos: 'noun' },
  'avis': { translation: 'opinion, notice', pronunciation: 'ah-vee', pos: 'noun' },
  'avocat': { translation: 'lawyer, avocado', pronunciation: 'ah-vo-kah', pos: 'noun' },

  // Adjectives
  'absolu': { translation: 'absolute', pronunciation: 'ab-so-loo', pos: 'adjective' },
  'absent': { translation: 'absent', pronunciation: 'ab-son', pos: 'adjective' },
  'actif': { translation: 'active', pronunciation: 'ak-teef', pos: 'adjective' },
  'actuel': { translation: 'current', pronunciation: 'ak-too-el', pos: 'adjective' },
  'agréable': { translation: 'pleasant', pronunciation: 'ah-gray-ah-bluh', pos: 'adjective' },
  'aigu': { translation: 'acute, sharp', pronunciation: 'ay-goo', pos: 'adjective' },
  'aimable': { translation: 'kind', pronunciation: 'ay-mah-bluh', pos: 'adjective' },
  'aisé': { translation: 'easy, well-off', pronunciation: 'ay-zay', pos: 'adjective' },
  'allemand': { translation: 'German', pronunciation: 'al-mon', pos: 'adjective' },
  'américain': { translation: 'American', pronunciation: 'ah-may-ree-kan', pos: 'adjective' },
  'ami': { translation: 'friendly', pronunciation: 'ah-mee', pos: 'adjective' },
  'amical': { translation: 'friendly', pronunciation: 'ah-mee-kal', pos: 'adjective' },
  'amusant': { translation: 'amusing, fun', pronunciation: 'ah-moo-zon', pos: 'adjective' },
  'ancien': { translation: 'old, former', pronunciation: 'on-syan', pos: 'adjective' },
  'anglais': { translation: 'English', pronunciation: 'on-gleh', pos: 'adjective' },
  'annuel': { translation: 'annual', pronunciation: 'ah-noo-el', pos: 'adjective' },
  'anonyme': { translation: 'anonymous', pronunciation: 'ah-no-neem', pos: 'adjective' },
  'antérieur': { translation: 'anterior, previous', pronunciation: 'on-tay-ree-uhr', pos: 'adjective' },
  'apparent': { translation: 'apparent', pronunciation: 'ah-pah-ron', pos: 'adjective' },
  'approprié': { translation: 'appropriate', pronunciation: 'ah-pro-pree-ay', pos: 'adjective' },
  'approximatif': { translation: 'approximate', pronunciation: 'ah-prok-see-mah-teef', pos: 'adjective' },
  'arabe': { translation: 'Arab, Arabic', pronunciation: 'ah-rahb', pos: 'adjective' },
  'armé': { translation: 'armed', pronunciation: 'ahr-may', pos: 'adjective' },
  'artificiel': { translation: 'artificial', pronunciation: 'ahr-tee-fee-syel', pos: 'adjective' },
  'artistique': { translation: 'artistic', pronunciation: 'ahr-tees-teek', pos: 'adjective' },
  'assis': { translation: 'seated, sitting', pronunciation: 'ah-see', pos: 'adjective' },
  'assuré': { translation: 'assured, insured', pronunciation: 'ah-soo-ray', pos: 'adjective' },
  'attaché': { translation: 'attached', pronunciation: 'ah-tah-shay', pos: 'adjective' },
  'attentif': { translation: 'attentive', pronunciation: 'ah-ton-teef', pos: 'adjective' },
  'attractif': { translation: 'attractive', pronunciation: 'ah-trak-teef', pos: 'adjective' },
  'aucun': { translation: 'no, none', pronunciation: 'oh-kuhn', pos: 'adjective' },
  'audacieux': { translation: 'bold, audacious', pronunciation: 'oh-dah-syuh', pos: 'adjective' },
  'authentique': { translation: 'authentic', pronunciation: 'oh-ton-teek', pos: 'adjective' },
  'automatique': { translation: 'automatic', pronunciation: 'oh-toh-mah-teek', pos: 'adjective' },
  'autonome': { translation: 'autonomous', pronunciation: 'oh-toh-nom', pos: 'adjective' },
  'autre': { translation: 'other', pronunciation: 'oh-truh', pos: 'adjective' },
  'auxiliaire': { translation: 'auxiliary', pronunciation: 'ohk-see-lyehr', pos: 'adjective' },
  'avancé': { translation: 'advanced', pronunciation: 'ah-von-say', pos: 'adjective' },
  'avantageux': { translation: 'advantageous', pronunciation: 'ah-von-tah-zhuh', pos: 'adjective' },
  'aveugle': { translation: 'blind', pronunciation: 'ah-vuh-gluh', pos: 'adjective' },

  // Adverbs
  'absolument': { translation: 'absolutely', pronunciation: 'ab-so-loo-mon', pos: 'adverb' },
  'actuellement': { translation: 'currently', pronunciation: 'ak-too-el-mon', pos: 'adverb' },
  'ailleurs': { translation: 'elsewhere', pronunciation: 'ay-yuhr', pos: 'adverb' },
  'ainsi': { translation: 'thus, in this way', pronunciation: 'an-see', pos: 'adverb' },
  'alors': { translation: 'so, then', pronunciation: 'ah-lor', pos: 'adverb' },
  'après': { translation: 'after', pronunciation: 'ah-preh', pos: 'adverb' },
  'assez': { translation: 'enough', pronunciation: 'ah-say', pos: 'adverb' },
  'aussi': { translation: 'also, too', pronunciation: 'oh-see', pos: 'adverb' },
  'aussitôt': { translation: 'immediately', pronunciation: 'oh-see-toh', pos: 'adverb' },
  'autant': { translation: 'as much, as many', pronunciation: 'oh-ton', pos: 'adverb' },
  'autour': { translation: 'around', pronunciation: 'oh-toor', pos: 'adverb' },
  'autrefois': { translation: 'in the past', pronunciation: 'oh-truh-fwah', pos: 'adverb' },
  'autrement': { translation: 'otherwise', pronunciation: 'oh-truh-mon', pos: 'adverb' },
  'auparavant': { translation: 'before, previously', pronunciation: 'oh-pah-rah-von', pos: 'adverb' },
  'avant': { translation: 'before', pronunciation: 'ah-von', pos: 'adverb' },

  // Prepositions
  'après': { translation: 'after', pronunciation: 'ah-preh', pos: 'preposition' },
  'auprès': { translation: 'near, with', pronunciation: 'oh-preh', pos: 'preposition' },
  'autour': { translation: 'around', pronunciation: 'oh-toor', pos: 'preposition' },
  'avant': { translation: 'before', pronunciation: 'ah-von', pos: 'preposition' },
  'avec': { translation: 'with', pronunciation: 'ah-vek', pos: 'preposition' },

  // Conjunctions & others will be added as needed
};

// Load data
console.log('Loading data files...');
const flelex_a1 = JSON.parse(fs.readFileSync('/tmp/flelex_A1.json', 'utf8'));
const flelex_a2 = JSON.parse(fs.readFileSync('/tmp/flelex_A2.json', 'utf8'));
const flelex_b1 = JSON.parse(fs.readFileSync('/tmp/flelex_B1.json', 'utf8'));
const flelex_b2 = JSON.parse(fs.readFileSync('/tmp/flelex_B2.json', 'utf8'));
const flelex_c1 = JSON.parse(fs.readFileSync('/tmp/flelex_C1.json', 'utf8'));
const flelex_c2 = JSON.parse(fs.readFileSync('/tmp/flelex_C2.json', 'utf8'));

const existingA1 = JSON.parse(fs.readFileSync('/Users/andrewlandry/source/convo-lab/server/src/data/vocabulary/fr/A1.json', 'utf8'));

console.log('Data loaded successfully');
console.log(`FLELex A1: ${flelex_a1.length} words`);
console.log(`Existing A1: ${existingA1.vocabulary.length} words`);

// Create word list for dictionary lookup
const allWords = new Set();
[flelex_a1, flelex_a2, flelex_b1, flelex_b2, flelex_c1, flelex_c2].forEach(level => {
  level.forEach(w => allWords.add(w.word));
});

console.log(`\nTotal unique words across all levels: ${allWords.size}`);
console.log(`Words in dictionary: ${Object.keys(frenchDictionary).length}`);

// Calculate coverage
const coveredWords = Array.from(allWords).filter(w => frenchDictionary[w.toLowerCase()]);
console.log(`Dictionary coverage: ${((coveredWords.length / allWords.size) * 100).toFixed(2)}%`);

console.log('\n===  MANUAL DICTIONARY NEEDED ===');
console.log('This script requires a comprehensive French-English dictionary.');
console.log('The current dictionary only has a small subset of words.');
console.log('\nPlease provide a complete dictionary file or use an API service.');
