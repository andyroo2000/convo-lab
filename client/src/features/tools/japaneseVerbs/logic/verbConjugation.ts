import {
  VERB_DATASET,
  type JLPTLevel,
  type VerbDictionaryEntry,
  type VerbGroup,
} from './verbDataset';
import {
  resolveConjugation,
  type ConjugatedForm,
  type ConjugationResult,
  type VerbConjugationId,
} from './verbConjugationRules';

export type { JLPTLevel, VerbGroup, VerbDictionaryEntry } from './verbDataset';
export type { ConjugatedForm, ConjugationResult, VerbConjugationId } from './verbConjugationRules';

export type RegisterBadge = 'formal' | 'casual' | 'spoken' | 'colloquial';
export type ConjugationBadge = 'present' | 'past' | 'te-form' | 'negative' | 'potential';

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
    // Random suffix ensures React treats consecutive draws of the same verb+conjugation as distinct cards
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

export interface VerbConjugationCatalogEntry {
  id: string;
  verbId: string;
  conjugationId: VerbConjugationId;
  text: string;
  kanaText: string;
  relativePath: string;
}

/** Used by the server-side TTS generation script to enumerate all verb×conjugation audio clips. */
export function buildVerbConjugationCatalog(): VerbConjugationCatalogEntry[] {
  const entries: VerbConjugationCatalogEntry[] = [];

  VERB_DATASET.forEach((verb) => {
    CONJUGATION_OPTIONS.forEach((conjugation) => {
      const result = resolveConjugation(verb, conjugation.id);
      if (!result) return;

      entries.push({
        id: `${verb.id}_${conjugation.id}`,
        verbId: verb.id,
        conjugationId: conjugation.id,
        text: result.answer.script,
        kanaText: result.answer.reading,
        relativePath: `${verb.id}/${conjugation.id}.mp3`,
      });
    });
  });

  return entries;
}
