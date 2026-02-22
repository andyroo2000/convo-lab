import {
  VERB_DATASET,
  type JLPTLevel,
  type VerbDictionaryEntry,
  type VerbGroup,
} from './verbDataset';

export type { JLPTLevel, VerbGroup, VerbDictionaryEntry } from './verbDataset';

export type RegisterBadge = 'formal' | 'casual' | 'spoken' | 'colloquial';
export type ConjugationBadge = 'present' | 'past' | 'te-form' | 'negative' | 'potential';

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

export interface VerbConjugationOption {
  id: VerbConjugationId;
  label: string;
  conjugationBadge: ConjugationBadge;
  registers: RegisterBadge[];
  promptHint?: string;
}

export interface VerbPracticeCard {
  id: string;
  verb: VerbDictionaryEntry;
  conjugation: VerbConjugationOption;
  answer: ConjugatedForm;
  referenceAnswer?: ConjugatedForm;
}

export interface ConjugationResult {
  answer: ConjugatedForm;
  referenceAnswer?: ConjugatedForm;
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

const CONJUGATION_OPTIONS: VerbConjugationOption[] = [
  {
    id: 'present-casual',
    label: 'Present Casual',
    conjugationBadge: 'present',
    registers: ['casual'],
  },
  {
    id: 'present-polite',
    label: 'Present Polite',
    conjugationBadge: 'present',
    registers: ['formal'],
  },
  {
    id: 'past-casual',
    label: 'Past Casual',
    conjugationBadge: 'past',
    registers: ['casual'],
  },
  {
    id: 'past-polite',
    label: 'Past Polite',
    conjugationBadge: 'past',
    registers: ['formal'],
  },
  {
    id: 'te-form',
    label: 'Te-Form',
    conjugationBadge: 'te-form',
    registers: ['spoken'],
  },
  {
    id: 'negative-casual',
    label: 'Negative Casual',
    conjugationBadge: 'negative',
    registers: ['casual'],
  },
  {
    id: 'negative-polite',
    label: 'Negative Polite',
    conjugationBadge: 'negative',
    registers: ['formal'],
  },
  {
    id: 'potential',
    label: 'Potential (Textbook)',
    conjugationBadge: 'potential',
    registers: ['formal'],
  },
  {
    id: 'potential-colloquial',
    label: 'Potential (Colloquial)',
    conjugationBadge: 'potential',
    registers: ['spoken', 'colloquial'],
    promptHint: 'Use the colloquial ら抜き potential form on this card.',
  },
];

const CONJUGATION_OPTIONS_BY_ID = new Map(CONJUGATION_OPTIONS.map((option) => [option.id, option]));

const JLPT_LEVEL_SET: ReadonlySet<JLPTLevel> = new Set(['N5', 'N4']);
const VERB_GROUP_SET: ReadonlySet<VerbGroup> = new Set(['1', '2', '3']);
const CONJUGATION_SET: ReadonlySet<VerbConjugationId> = new Set(
  CONJUGATION_OPTIONS.map((option) => option.id)
);

const RECENT_CARD_EXCLUSION_LIMIT = 18;

export const JLPT_LEVEL_OPTIONS: JLPTLevel[] = ['N5', 'N4'];
export const VERB_GROUP_OPTIONS: VerbGroup[] = ['1', '2', '3'];
export const VERB_CONJUGATION_OPTIONS: VerbConjugationOption[] = CONJUGATION_OPTIONS;

export const REGISTER_BADGE_LABELS: Record<RegisterBadge, string> = {
  formal: 'Formal',
  casual: 'Casual',
  spoken: 'Spoken',
  colloquial: 'Colloquial',
};

export const CONJUGATION_BADGE_LABELS: Record<ConjugationBadge, string> = {
  present: 'Present',
  past: 'Past',
  'te-form': 'Te-form',
  negative: 'Negative',
  potential: 'Potential',
};

export const DEFAULT_JLPT_LEVELS: JLPTLevel[] = ['N5'];
export const DEFAULT_VERB_GROUPS: VerbGroup[] = ['1', '2', '3'];
export const DEFAULT_CONJUGATION_IDS: VerbConjugationId[] = [
  'present-polite',
  'past-casual',
  'te-form',
  'potential-colloquial',
];

function randomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function splitVerbEnding(verb: VerbDictionaryEntry): {
  stemScript: string;
  stemReading: string;
  ending: string;
} | null {
  const ending = verb.reading.slice(-1);
  if (!ending || !verb.dictionary.endsWith(ending)) {
    return null;
  }

  return {
    stemScript: verb.dictionary.slice(0, -1),
    stemReading: verb.reading.slice(0, -1),
    ending,
  };
}

function splitRuStem(
  verb: VerbDictionaryEntry
): { stemScript: string; stemReading: string } | null {
  if (!verb.dictionary.endsWith('る') || !verb.reading.endsWith('る')) {
    return null;
  }

  return {
    stemScript: verb.dictionary.slice(0, -1),
    stemReading: verb.reading.slice(0, -1),
  };
}

function getGroup1Conjugation(
  verb: VerbDictionaryEntry,
  conjugationId: VerbConjugationId
): ConjugatedForm | null {
  const split = splitVerbEnding(verb);
  if (!split) {
    return null;
  }

  const { stemScript, stemReading, ending } = split;
  const iEnding = GODAN_I_ENDING[ending];
  const aEnding = GODAN_A_ENDING[ending];
  const eEnding = GODAN_E_ENDING[ending];

  switch (conjugationId) {
    case 'present-casual':
      return { script: verb.dictionary, reading: verb.reading };
    case 'present-polite':
      if (!iEnding) {
        return null;
      }
      return {
        script: `${stemScript}${iEnding}ます`,
        reading: `${stemReading}${iEnding}ます`,
      };
    case 'past-casual':
      if (verb.id === 'iku') {
        return { script: `${stemScript}った`, reading: `${stemReading}った` };
      }
      if (ending === 'う' || ending === 'つ' || ending === 'る') {
        return { script: `${stemScript}った`, reading: `${stemReading}った` };
      }
      if (ending === 'む' || ending === 'ぶ' || ending === 'ぬ') {
        return { script: `${stemScript}んだ`, reading: `${stemReading}んだ` };
      }
      if (ending === 'く') {
        return { script: `${stemScript}いた`, reading: `${stemReading}いた` };
      }
      if (ending === 'ぐ') {
        return { script: `${stemScript}いだ`, reading: `${stemReading}いだ` };
      }
      if (ending === 'す') {
        return { script: `${stemScript}した`, reading: `${stemReading}した` };
      }
      return null;
    case 'past-polite':
      if (!iEnding) {
        return null;
      }
      return {
        script: `${stemScript}${iEnding}ました`,
        reading: `${stemReading}${iEnding}ました`,
      };
    case 'te-form':
      if (verb.id === 'iku') {
        return { script: `${stemScript}って`, reading: `${stemReading}って` };
      }
      if (ending === 'う' || ending === 'つ' || ending === 'る') {
        return { script: `${stemScript}って`, reading: `${stemReading}って` };
      }
      if (ending === 'む' || ending === 'ぶ' || ending === 'ぬ') {
        return { script: `${stemScript}んで`, reading: `${stemReading}んで` };
      }
      if (ending === 'く') {
        return { script: `${stemScript}いて`, reading: `${stemReading}いて` };
      }
      if (ending === 'ぐ') {
        return { script: `${stemScript}いで`, reading: `${stemReading}いで` };
      }
      if (ending === 'す') {
        return { script: `${stemScript}して`, reading: `${stemReading}して` };
      }
      return null;
    case 'negative-casual':
      if (!aEnding) {
        return null;
      }
      return {
        script: `${stemScript}${aEnding}ない`,
        reading: `${stemReading}${aEnding}ない`,
      };
    case 'negative-polite':
      if (!iEnding) {
        return null;
      }
      return {
        script: `${stemScript}${iEnding}ません`,
        reading: `${stemReading}${iEnding}ません`,
      };
    case 'potential':
      if (!eEnding) {
        return null;
      }
      return {
        script: `${stemScript}${eEnding}る`,
        reading: `${stemReading}${eEnding}る`,
      };
    case 'potential-colloquial':
      return null;
    default:
      return null;
  }
}

function getGroup2Conjugation(
  verb: VerbDictionaryEntry,
  conjugationId: VerbConjugationId
): ConjugatedForm | null {
  const split = splitRuStem(verb);
  if (!split) {
    return null;
  }

  const { stemScript, stemReading } = split;

  switch (conjugationId) {
    case 'present-casual':
      return { script: verb.dictionary, reading: verb.reading };
    case 'present-polite':
      return { script: `${stemScript}ます`, reading: `${stemReading}ます` };
    case 'past-casual':
      return { script: `${stemScript}た`, reading: `${stemReading}た` };
    case 'past-polite':
      return { script: `${stemScript}ました`, reading: `${stemReading}ました` };
    case 'te-form':
      return { script: `${stemScript}て`, reading: `${stemReading}て` };
    case 'negative-casual':
      return { script: `${stemScript}ない`, reading: `${stemReading}ない` };
    case 'negative-polite':
      return { script: `${stemScript}ません`, reading: `${stemReading}ません` };
    case 'potential':
      return { script: `${stemScript}られる`, reading: `${stemReading}られる` };
    case 'potential-colloquial':
      return { script: `${stemScript}れる`, reading: `${stemReading}れる` };
    default:
      return null;
  }
}

function getSuruStem(
  verb: VerbDictionaryEntry
): { stemScript: string; stemReading: string } | null {
  if (!verb.dictionary.endsWith('する') || !verb.reading.endsWith('する')) {
    return null;
  }

  return {
    stemScript: verb.dictionary.slice(0, -2),
    stemReading: verb.reading.slice(0, -2),
  };
}

function getKuruStem(verb: VerbDictionaryEntry): {
  stemScript: string;
  stemReading: string;
  usesKanji: boolean;
} | null {
  if (!verb.reading.endsWith('くる')) {
    return null;
  }

  if (verb.dictionary.endsWith('来る')) {
    return {
      stemScript: verb.dictionary.slice(0, -2),
      stemReading: verb.reading.slice(0, -2),
      usesKanji: true,
    };
  }

  if (verb.dictionary.endsWith('くる')) {
    return {
      stemScript: verb.dictionary.slice(0, -2),
      stemReading: verb.reading.slice(0, -2),
      usesKanji: false,
    };
  }

  return null;
}

function getGroup3Conjugation(
  verb: VerbDictionaryEntry,
  conjugationId: VerbConjugationId
): ConjugatedForm | null {
  const suruStem = getSuruStem(verb);
  if (suruStem) {
    switch (conjugationId) {
      case 'present-casual':
        return { script: verb.dictionary, reading: verb.reading };
      case 'present-polite':
        return { script: `${suruStem.stemScript}します`, reading: `${suruStem.stemReading}します` };
      case 'past-casual':
        return { script: `${suruStem.stemScript}した`, reading: `${suruStem.stemReading}した` };
      case 'past-polite':
        return {
          script: `${suruStem.stemScript}しました`,
          reading: `${suruStem.stemReading}しました`,
        };
      case 'te-form':
        return { script: `${suruStem.stemScript}して`, reading: `${suruStem.stemReading}して` };
      case 'negative-casual':
        return {
          script: `${suruStem.stemScript}しない`,
          reading: `${suruStem.stemReading}しない`,
        };
      case 'negative-polite':
        return {
          script: `${suruStem.stemScript}しません`,
          reading: `${suruStem.stemReading}しません`,
        };
      case 'potential':
        return {
          script: `${suruStem.stemScript}できる`,
          reading: `${suruStem.stemReading}できる`,
        };
      case 'potential-colloquial':
        return null;
      default:
        return null;
    }
  }

  const kuruStem = getKuruStem(verb);
  if (!kuruStem) {
    return null;
  }

  const suffixes = kuruStem.usesKanji
    ? {
        presentPolite: '来ます',
        pastCasual: '来た',
        pastPolite: '来ました',
        teForm: '来て',
        negativeCasual: '来ない',
        negativePolite: '来ません',
        potentialTextbook: '来られる',
        potentialColloquial: '来れる',
      }
    : {
        presentPolite: 'きます',
        pastCasual: 'きた',
        pastPolite: 'きました',
        teForm: 'きて',
        negativeCasual: 'こない',
        negativePolite: 'きません',
        potentialTextbook: 'こられる',
        potentialColloquial: 'これる',
      };

  switch (conjugationId) {
    case 'present-casual':
      return { script: verb.dictionary, reading: verb.reading };
    case 'present-polite':
      return {
        script: `${kuruStem.stemScript}${suffixes.presentPolite}`,
        reading: `${kuruStem.stemReading}きます`,
      };
    case 'past-casual':
      return {
        script: `${kuruStem.stemScript}${suffixes.pastCasual}`,
        reading: `${kuruStem.stemReading}きた`,
      };
    case 'past-polite':
      return {
        script: `${kuruStem.stemScript}${suffixes.pastPolite}`,
        reading: `${kuruStem.stemReading}きました`,
      };
    case 'te-form':
      return {
        script: `${kuruStem.stemScript}${suffixes.teForm}`,
        reading: `${kuruStem.stemReading}きて`,
      };
    case 'negative-casual':
      return {
        script: `${kuruStem.stemScript}${suffixes.negativeCasual}`,
        reading: `${kuruStem.stemReading}こない`,
      };
    case 'negative-polite':
      return {
        script: `${kuruStem.stemScript}${suffixes.negativePolite}`,
        reading: `${kuruStem.stemReading}きません`,
      };
    case 'potential':
      return {
        script: `${kuruStem.stemScript}${suffixes.potentialTextbook}`,
        reading: `${kuruStem.stemReading}こられる`,
      };
    case 'potential-colloquial':
      return {
        script: `${kuruStem.stemScript}${suffixes.potentialColloquial}`,
        reading: `${kuruStem.stemReading}これる`,
      };
    default:
      return null;
  }
}

function getConjugatedForm(
  verb: VerbDictionaryEntry,
  conjugationId: VerbConjugationId
): ConjugatedForm | null {
  if (verb.group === '1') {
    return getGroup1Conjugation(verb, conjugationId);
  }

  if (verb.group === '2') {
    return getGroup2Conjugation(verb, conjugationId);
  }

  return getGroup3Conjugation(verb, conjugationId);
}

function resolveConjugation(
  verb: VerbDictionaryEntry,
  conjugationId: VerbConjugationId
): ConjugationResult | null {
  const textbookPotential =
    conjugationId === 'potential-colloquial' ? getConjugatedForm(verb, 'potential') : null;

  const answer = getConjugatedForm(verb, conjugationId);
  if (!answer) {
    return null;
  }

  if (conjugationId !== 'potential-colloquial' || !textbookPotential) {
    return { answer };
  }

  if (textbookPotential.script === answer.script && textbookPotential.reading === answer.reading) {
    return null;
  }

  return {
    answer,
    referenceAnswer: textbookPotential,
  };
}

export function sanitizeSelectedJlptLevels(levels: readonly string[]): JLPTLevel[] {
  const uniqueLevels = Array.from(new Set(levels)).filter((level): level is JLPTLevel =>
    JLPT_LEVEL_SET.has(level as JLPTLevel)
  );
  return uniqueLevels.length > 0 ? uniqueLevels : DEFAULT_JLPT_LEVELS;
}

export function sanitizeSelectedVerbGroups(groups: readonly string[]): VerbGroup[] {
  const uniqueGroups = Array.from(new Set(groups)).filter((group): group is VerbGroup =>
    VERB_GROUP_SET.has(group as VerbGroup)
  );
  return uniqueGroups.length > 0 ? uniqueGroups : DEFAULT_VERB_GROUPS;
}

export function sanitizeSelectedConjugationIds(ids: readonly string[]): VerbConjugationId[] {
  const uniqueIds = Array.from(new Set(ids)).filter((id): id is VerbConjugationId =>
    CONJUGATION_SET.has(id as VerbConjugationId)
  );
  return uniqueIds.length > 0 ? uniqueIds : DEFAULT_CONJUGATION_IDS;
}

export function toggleSelection<T extends string>(current: readonly T[], value: T): T[] {
  if (current.includes(value)) {
    if (current.length === 1) {
      return [...current];
    }
    return current.filter((entry) => entry !== value);
  }

  return [...current, value];
}

export function createVerbPracticeCard(
  selectedJlptLevels: readonly JLPTLevel[],
  selectedVerbGroups: readonly VerbGroup[],
  selectedConjugationIds: readonly VerbConjugationId[],
  recentCardKeys: readonly string[] = []
): VerbPracticeCard | null {
  const safeLevels = sanitizeSelectedJlptLevels(selectedJlptLevels);
  const safeGroups = sanitizeSelectedVerbGroups(selectedVerbGroups);
  const safeConjugationIds = sanitizeSelectedConjugationIds(selectedConjugationIds);

  const availableVerbs = VERB_DATASET.filter(
    (verb) => safeLevels.includes(verb.jlptLevel) && safeGroups.includes(verb.group)
  );

  if (availableVerbs.length === 0) {
    return null;
  }

  const candidateCards = availableVerbs.flatMap((verb) =>
    safeConjugationIds.flatMap((conjugationId) => {
      const conjugation = CONJUGATION_OPTIONS_BY_ID.get(conjugationId);
      if (!conjugation) {
        return [];
      }

      const resolved = resolveConjugation(verb, conjugationId);
      if (!resolved) {
        return [];
      }

      return [
        {
          key: `${verb.id}:${conjugation.id}`,
          verb,
          conjugation,
          answer: resolved.answer,
          referenceAnswer: resolved.referenceAnswer,
        },
      ];
    })
  );

  if (candidateCards.length === 0) {
    return null;
  }

  const recentWindowSize = Math.min(RECENT_CARD_EXCLUSION_LIMIT, recentCardKeys.length);
  const excludedKeys = new Set(recentCardKeys.slice(0, recentWindowSize));
  const eligibleCards = candidateCards.filter((candidate) => !excludedKeys.has(candidate.key));
  const selectedCard =
    eligibleCards.length > 0 ? randomItem(eligibleCards) : randomItem(candidateCards);

  return {
    id: `${selectedCard.key}:${Math.random().toString(36).slice(2, 8)}`,
    verb: selectedCard.verb,
    conjugation: selectedCard.conjugation,
    answer: selectedCard.answer,
    referenceAnswer: selectedCard.referenceAnswer,
  };
}

export function conjugateVerb(
  verb: VerbDictionaryEntry,
  conjugationId: VerbConjugationId
): ConjugationResult | null {
  return resolveConjugation(verb, conjugationId);
}
