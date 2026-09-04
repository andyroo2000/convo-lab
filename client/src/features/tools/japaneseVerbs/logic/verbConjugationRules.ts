import type { VerbDictionaryEntry } from './verbDataset';

export type VerbConjugationId =
  | 'present-casual'
  | 'present-polite'
  | 'past-casual'
  | 'past-polite'
  | 'te-form'
  | 'negative-casual'
  | 'negative-polite'
  | 'potential'
  | 'potential-colloquial';

export interface ConjugatedForm {
  script: string;
  reading: string;
}

export interface ConjugationResult {
  answer: ConjugatedForm;
  referenceAnswer?: ConjugatedForm;
}

interface VerbStem {
  stemScript: string;
  stemReading: string;
}

interface GodanStem extends VerbStem {
  ending: string;
}

const GODAN_I_ENDING: Record<string, string> = {
  う: 'い',
  く: 'き',
  ぐ: 'ぎ',
  す: 'し',
  つ: 'ち',
  ぬ: 'に',
  ぶ: 'び',
  む: 'み',
  る: 'り',
};

const GODAN_A_ENDING: Record<string, string> = {
  う: 'わ',
  く: 'か',
  ぐ: 'が',
  す: 'さ',
  つ: 'た',
  ぬ: 'な',
  ぶ: 'ば',
  む: 'ま',
  る: 'ら',
};

const GODAN_E_ENDING: Record<string, string> = {
  う: 'え',
  く: 'け',
  ぐ: 'げ',
  す: 'せ',
  つ: 'て',
  ぬ: 'ね',
  ぶ: 'べ',
  む: 'め',
  る: 'れ',
};

const GODAN_PAST_SUFFIX: Record<string, string> = {
  う: 'った',
  つ: 'った',
  る: 'った',
  む: 'んだ',
  ぶ: 'んだ',
  ぬ: 'んだ',
  く: 'いた',
  ぐ: 'いだ',
  す: 'した',
};

const GODAN_TE_SUFFIX: Record<string, string> = {
  う: 'って',
  つ: 'って',
  る: 'って',
  む: 'んで',
  ぶ: 'んで',
  ぬ: 'んで',
  く: 'いて',
  ぐ: 'いで',
  す: 'して',
};

interface GodanStemRule {
  endings: Record<string, string>;
  suffix: string;
}

const GODAN_STEM_RULES: Partial<Record<VerbConjugationId, GodanStemRule>> = {
  'present-polite': { endings: GODAN_I_ENDING, suffix: 'ます' },
  'past-polite': { endings: GODAN_I_ENDING, suffix: 'ました' },
  'negative-casual': { endings: GODAN_A_ENDING, suffix: 'ない' },
  'negative-polite': { endings: GODAN_I_ENDING, suffix: 'ません' },
  potential: { endings: GODAN_E_ENDING, suffix: 'る' },
};

const ICHIDAN_SUFFIXES: Record<VerbConjugationId, string> = {
  'present-casual': 'る',
  'present-polite': 'ます',
  'past-casual': 'た',
  'past-polite': 'ました',
  'te-form': 'て',
  'negative-casual': 'ない',
  'negative-polite': 'ません',
  potential: 'られる',
  'potential-colloquial': 'れる',
};

const SURU_SUFFIXES: Partial<Record<VerbConjugationId, string>> = {
  'present-casual': 'する',
  'present-polite': 'します',
  'past-casual': 'した',
  'past-polite': 'しました',
  'te-form': 'して',
  'negative-casual': 'しない',
  'negative-polite': 'しません',
  potential: 'できる',
};

const KURU_READING_SUFFIXES: Record<VerbConjugationId, string> = {
  'present-casual': 'くる',
  'present-polite': 'きます',
  'past-casual': 'きた',
  'past-polite': 'きました',
  'te-form': 'きて',
  'negative-casual': 'こない',
  'negative-polite': 'きません',
  potential: 'こられる',
  'potential-colloquial': 'これる',
};

const KURU_KANJI_SUFFIXES: Record<VerbConjugationId, string> = {
  'present-casual': '来る',
  'present-polite': '来ます',
  'past-casual': '来た',
  'past-polite': '来ました',
  'te-form': '来て',
  'negative-casual': '来ない',
  'negative-polite': '来ません',
  potential: '来られる',
  'potential-colloquial': '来れる',
};

const appendSuffix = (stem: VerbStem, scriptSuffix: string, readingSuffix = scriptSuffix) => ({
  script: `${stem.stemScript}${scriptSuffix}`,
  reading: `${stem.stemReading}${readingSuffix}`,
});

const splitVerbEnding = (verb: VerbDictionaryEntry): GodanStem | null => {
  const ending = verb.reading.slice(-1);
  if (!ending || !verb.dictionary.endsWith(ending)) return null;

  return {
    stemScript: verb.dictionary.slice(0, -1),
    stemReading: verb.reading.slice(0, -1),
    ending,
  };
};

const splitVerbSuffix = (
  verb: VerbDictionaryEntry,
  scriptSuffix: string,
  readingSuffix = scriptSuffix
): VerbStem | null => {
  if (!verb.dictionary.endsWith(scriptSuffix) || !verb.reading.endsWith(readingSuffix)) return null;
  return {
    stemScript: verb.dictionary.slice(0, -scriptSuffix.length),
    stemReading: verb.reading.slice(0, -readingSuffix.length),
  };
};

const getGodanSoundChangeSuffix = (
  verb: VerbDictionaryEntry,
  stem: GodanStem,
  conjugationId: VerbConjugationId
) => {
  if (conjugationId === 'past-casual') {
    return verb.id === 'iku' ? 'った' : GODAN_PAST_SUFFIX[stem.ending];
  }
  if (conjugationId === 'te-form') {
    return verb.id === 'iku' ? 'って' : GODAN_TE_SUFFIX[stem.ending];
  }
  return undefined;
};

const getGroup1Conjugation = (
  verb: VerbDictionaryEntry,
  conjugationId: VerbConjugationId
): ConjugatedForm | null => {
  const stem = splitVerbEnding(verb);
  if (!stem) return null;
  if (conjugationId === 'present-casual') {
    return { script: verb.dictionary, reading: verb.reading };
  }
  if (conjugationId === 'potential-colloquial') return null;

  const soundChangeSuffix = getGodanSoundChangeSuffix(verb, stem, conjugationId);
  if (soundChangeSuffix) return appendSuffix(stem, soundChangeSuffix);

  const rule = GODAN_STEM_RULES[conjugationId];
  const transformedEnding = rule?.endings[stem.ending];
  return rule && transformedEnding
    ? appendSuffix(stem, `${transformedEnding}${rule.suffix}`)
    : null;
};

const getGroup2Conjugation = (
  verb: VerbDictionaryEntry,
  conjugationId: VerbConjugationId
): ConjugatedForm | null => {
  const stem = splitVerbSuffix(verb, 'る');
  return stem ? appendSuffix(stem, ICHIDAN_SUFFIXES[conjugationId]) : null;
};

const getSuruConjugation = (
  verb: VerbDictionaryEntry,
  conjugationId: VerbConjugationId
): ConjugatedForm | null => {
  const stem = splitVerbSuffix(verb, 'する');
  const suffix = SURU_SUFFIXES[conjugationId];
  return stem && suffix ? appendSuffix(stem, suffix) : null;
};

const getKuruConjugation = (
  verb: VerbDictionaryEntry,
  conjugationId: VerbConjugationId
): ConjugatedForm | null => {
  const usesKanji = verb.dictionary.endsWith('来る');
  const stem = usesKanji ? splitVerbSuffix(verb, '来る', 'くる') : splitVerbSuffix(verb, 'くる');
  if (!stem) return null;
  const scriptSuffix = usesKanji
    ? KURU_KANJI_SUFFIXES[conjugationId]
    : KURU_READING_SUFFIXES[conjugationId];
  return appendSuffix(stem, scriptSuffix, KURU_READING_SUFFIXES[conjugationId]);
};

const getGroup3Conjugation = (
  verb: VerbDictionaryEntry,
  conjugationId: VerbConjugationId
): ConjugatedForm | null =>
  verb.reading.endsWith('する')
    ? getSuruConjugation(verb, conjugationId)
    : getKuruConjugation(verb, conjugationId);

const getConjugatedForm = (
  verb: VerbDictionaryEntry,
  conjugationId: VerbConjugationId
): ConjugatedForm | null => {
  if (verb.group === '1') return getGroup1Conjugation(verb, conjugationId);
  if (verb.group === '2') return getGroup2Conjugation(verb, conjugationId);
  return getGroup3Conjugation(verb, conjugationId);
};

export const resolveConjugation = (
  verb: VerbDictionaryEntry,
  conjugationId: VerbConjugationId
): ConjugationResult | null => {
  const textbookPotential =
    conjugationId === 'potential-colloquial' ? getConjugatedForm(verb, 'potential') : null;
  const answer = getConjugatedForm(verb, conjugationId);
  if (!answer) return null;
  if (conjugationId !== 'potential-colloquial' || !textbookPotential) return { answer };
  if (textbookPotential.script === answer.script && textbookPotential.reading === answer.reading) {
    return null;
  }
  return { answer, referenceAnswer: textbookPotential };
};
