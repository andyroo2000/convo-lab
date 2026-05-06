import { generateCoreLlmJsonText } from '../coreLlmClient.js';
import type { LessonScriptUnit } from '../lessonScriptGenerator.js';

import type { DailyAudioLearningAtom, DailyAudioPracticeTrackMode } from './types.js';

const MAX_SCRIPT_ATOMS = 50;
const MAX_VARIATIONS_PER_ATOM = 4;
const JAPANESE_TEXT_PATTERN = /[\u3040-\u30ff\u3400-\u9fff]/;
const INLINE_PAREN_READING_PATTERN = /([\u3400-\u9fff々〆ヵヶ]+)[(（]([\u3040-\u30ffー\s]+)[)）]/;
const INLINE_BRACKET_READING_PATTERN =
  /([^\s[\]]*[\u3040-\u30ff\u3400-\u9fff][^\s[\]]*)\[([\u3040-\u30ffー\s]+)\]/;
const DRILL_VARIATION_KINDS = ['anchor', 'grammar_substitution', 'form_transform'] as const;

interface ScriptGenerationOptions {
  atoms: DailyAudioLearningAtom[];
  targetDurationMinutes: number;
  targetLanguage: string;
  nativeLanguage: string;
  l1VoiceId: string;
  speakerVoiceIds: [string, string] | string[];
}

type GeneratedScripts = Record<DailyAudioPracticeTrackMode, LessonScriptUnit[]>;

interface DrillItemEnhancement {
  englishCue?: string;
  exampleJp?: string;
  exampleReading?: string;
  exampleEn?: string;
  variations?: DrillVariation[];
}

interface DrillVariation {
  kind: (typeof DRILL_VARIATION_KINDS)[number];
  japanese: string;
  reading?: string;
  english: string;
}

interface DrillPrompt {
  label: string;
  japanese: string;
  reading?: string;
  english: string;
}

interface JapaneseDisplayText {
  text: string;
  reading?: string;
}

function stripCodeFence(raw: string): string {
  let text = raw.trim();
  const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (match?.[1]) text = match[1].trim();
  return text;
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(stripCodeFence(raw)) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Daily audio generator returned invalid JSON.');
  }
  return parsed as Record<string, unknown>;
}

function readingForText(atom: DailyAudioLearningAtom, text: string): string | undefined {
  return text === atom.targetText ? (atom.reading ?? undefined) : undefined;
}

function languageName(languageCode: string): string {
  if (languageCode === 'ja') return 'Japanese';
  if (languageCode === 'en') return 'English';
  return languageCode;
}

function containsJapaneseText(text: string | null | undefined): boolean {
  return Boolean(text && JAPANESE_TEXT_PATTERN.test(text));
}

function safeEnglishText(text: string | null | undefined): string | null {
  const trimmed = text?.trim();
  if (!trimmed || containsJapaneseText(trimmed)) return null;
  return trimmed;
}

function parseDrillVariationKind(value: unknown): DrillVariation['kind'] | null {
  return typeof value === 'string' &&
    (DRILL_VARIATION_KINDS as readonly string[]).includes(value)
    ? (value as DrillVariation['kind'])
    : null;
}

function globalPattern(pattern: RegExp): RegExp {
  return new RegExp(pattern.source, 'g');
}

function normalizeFuriganaFormat(reading: string | null | undefined): string | undefined {
  const trimmed = reading?.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(globalPattern(INLINE_PAREN_READING_PATTERN), '$1[$2]');
}

function normalizeJapaneseDisplayText(
  text: string | null | undefined,
  reading?: string | null
): JapaneseDisplayText | null {
  const trimmed = text?.trim();
  if (!trimmed) return null;

  const normalizedInlineReading = normalizeFuriganaFormat(trimmed);
  const derivedReading = normalizedInlineReading
    ? INLINE_BRACKET_READING_PATTERN.test(normalizedInlineReading)
      ? normalizedInlineReading
      : undefined
    : undefined;
  const plainText = trimmed
    .replace(globalPattern(INLINE_BRACKET_READING_PATTERN), '$1')
    .replace(globalPattern(INLINE_PAREN_READING_PATTERN), '$1')
    .trim();
  const normalizedReading = normalizeFuriganaFormat(reading) ?? derivedReading;

  if (!plainText) return null;
  const result: JapaneseDisplayText = { text: plainText };
  if (normalizedReading && normalizedReading !== plainText) result.reading = normalizedReading;
  return result;
}

function normalizedEnglish(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function englishWordCount(text: string): number {
  const normalized = normalizedEnglish(text);
  return normalized ? normalized.split(' ').length : 0;
}

function looksLikeJapaneseSentence(text: string): boolean {
  const trimmed = text.trim();
  return /[。！？!?]/.test(trimmed) || trimmed.length >= 8;
}

function safeGeneratedEnglishTranslation(
  text: string | null | undefined,
  japaneseText: string | null | undefined,
  cueText: string | null | undefined
): string | null {
  const english = safeEnglishText(text);
  if (!english) return null;
  if (!japaneseText || !looksLikeJapaneseSentence(japaneseText)) return english;

  const normalizedTranslation = normalizedEnglish(english);
  const normalizedCue = cueText ? normalizedEnglish(cueText) : '';
  if (normalizedCue && normalizedTranslation === normalizedCue) return null;
  if (englishWordCount(english) < 2) return null;

  return english;
}

function fallbackCueText(atom: DailyAudioLearningAtom): string {
  return safeEnglishText(atom.english) ?? safeEnglishText(atom.exampleEn) ?? 'this expression';
}

function recallPauseSeconds(text: string): number {
  const length = text.trim().length;
  if (length > 80) return 9;
  if (length > 48) return 7;
  if (length > 28) return 5.5;
  return 4;
}

async function buildDrillItemEnhancements(
  atoms: DailyAudioLearningAtom[]
): Promise<Map<string, DrillItemEnhancement>> {
  if (atoms.length === 0) return new Map();

  const prompt = `Create fresh N5-N4 Japanese drill examples from these learner items.

Requirements:
- Use the learner item naturally in new Japanese example sentences.
- For every item, create a balanced ladder before moving to the next item:
  1. exampleJp is the close anchor: a fresh sentence that clearly connects to the flashcard but does not copy the source example.
  2. variations contains exactly two grammar_substitution items: keep the same grammar structure or sentence pattern, but swap in different common N5-N4 words, objects, people, places, or contexts.
  3. variations contains exactly two form_transform items: keep the target word, verb family, or core expression and change the form when linguistically appropriate, such as past, negative, potential, negative-past, polite/plain, or simple combinations.
- For single words, reuse the word in different simple N5-N4 contexts and include at least one form_transform when the word can inflect. For non-inflecting nouns, use natural phrase/sentence frame changes instead of fake conjugations.
- For grammar patterns or sentence phrases, reuse the same structure with different common N5-N4 words the learner is likely to know, then include form changes on the main verb/adjective when possible.
- Keep the Japanese around JLPT N5-N4 level.
- Put normal Japanese only in exampleJp and variation japanese fields. Do not include furigana, romaji, parenthetical readings, or bracket readings there.
- Put furigana only in exampleReading and variation reading fields.
- Keep English fields English only. Never include Japanese characters in englishCue, exampleEn, or variation english fields.
- Translate each full Japanese example sentence into a complete, idiomatic English sentence. Do not use only the target word as the translation.
- Translate context-dependent words by the meaning they have in the generated sentence, not by a literal dictionary gloss.
- Preserve the grammar and topic of the Japanese sentence. Do not turn time/place topics into literal English subjects when that changes the meaning.
- If the definition is Japanese-only, translate it into a short natural English cue.
- Do not copy the source example sentence unless there is no reasonable alternative.

Return JSON only:
{
  "items": [
    {
      "cardId":"...",
      "englishCue":"short English cue",
      "exampleKind":"anchor",
      "exampleJp":"new Japanese sentence",
      "exampleReading":"optional reading with furigana",
      "exampleEn":"English translation of the new sentence",
      "variations": [
        {
          "kind":"grammar_substitution",
          "japanese":"variation Japanese sentence",
          "reading":"optional reading",
          "english":"English translation"
        },
        {
          "kind":"form_transform",
          "japanese":"variation Japanese sentence",
          "reading":"optional reading",
          "english":"English translation"
        }
      ]
    }
  ]
}

Cards:
${atoms
  .map(
    (atom, index) =>
      `${index + 1}. cardId=${atom.cardId}
target=${atom.targetText}
definition=${atom.english}
sourceExampleJp=${atom.exampleJp ?? ''}
sourceExampleEn=${atom.exampleEn ?? ''}
cardType=${atom.cardType}
noteType=${atom.noteType ?? ''}`
  )
  .join('\n\n')}`;

  try {
    const parsed = parseJsonObject(
      await generateCoreLlmJsonText(
        prompt,
        'Return valid JSON for audio drill examples. English fields must contain English only.'
      )
    );
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    const enhancementByCardId = new Map<string, DrillItemEnhancement>();
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const record = item as Record<string, unknown>;
      const cardId = typeof record.cardId === 'string' ? record.cardId : null;
      if (!cardId) continue;

      const englishCue = safeEnglishText(
        typeof record.englishCue === 'string' ? record.englishCue : null
      );
      const example = normalizeJapaneseDisplayText(
        typeof record.exampleJp === 'string' ? record.exampleJp : null,
        typeof record.exampleReading === 'string' ? record.exampleReading : null
      );
      const exampleEn = safeGeneratedEnglishTranslation(
        typeof record.exampleEn === 'string' ? record.exampleEn : null,
        example?.text,
        englishCue
      );
      const rawVariations = Array.isArray(record.variations) ? record.variations : [];
      const variations: DrillVariation[] = [];
      for (const variation of rawVariations) {
        if (!variation || typeof variation !== 'object') continue;
        const variationRecord = variation as Record<string, unknown>;
        const kind = parseDrillVariationKind(variationRecord.kind);
        if (!kind || kind === 'anchor') continue;
        const variationJapanese = normalizeJapaneseDisplayText(
          typeof variationRecord.japanese === 'string' ? variationRecord.japanese : null,
          typeof variationRecord.reading === 'string' ? variationRecord.reading : null
        );
        const english = safeGeneratedEnglishTranslation(
          typeof variationRecord.english === 'string' ? variationRecord.english : null,
          variationJapanese?.text,
          englishCue
        );
        if (!variationJapanese || !english) continue;
        const safeVariation: DrillVariation = { kind, japanese: variationJapanese.text, english };
        if (variationJapanese.reading) safeVariation.reading = variationJapanese.reading;
        variations.push(safeVariation);
      }

      const enhancement: DrillItemEnhancement = {};
      if (englishCue) enhancement.englishCue = englishCue;
      if (example && exampleEn) {
        enhancement.exampleJp = example.text;
        enhancement.exampleEn = exampleEn;
        if (example.reading) enhancement.exampleReading = example.reading;
      }
      if (variations.length) {
        enhancement.variations = [
          ...variations.filter((variation) => variation.kind === 'grammar_substitution'),
          ...variations.filter((variation) => variation.kind === 'form_transform'),
        ].slice(0, MAX_VARIATIONS_PER_ATOM);
      }
      enhancementByCardId.set(cardId, enhancement);
    }
    return enhancementByCardId;
  } catch {
    return new Map();
  }
}

function buildDrillPrompts(
  atom: DailyAudioLearningAtom,
  enhancement: DrillItemEnhancement | undefined
): DrillPrompt[] {
  const cueText = enhancement?.englishCue ?? fallbackCueText(atom);
  const target = normalizeJapaneseDisplayText(atom.targetText, atom.reading) ?? {
    text: atom.targetText,
    reading: atom.reading ?? undefined,
  };
  const prompts: DrillPrompt[] = [
    {
      label: `Drill: ${atom.targetText}`,
      japanese: target.text,
      reading: target.reading,
      english: cueText,
    },
  ];

  const exampleJp = enhancement?.exampleJp ?? atom.exampleJp;
  const exampleEn = enhancement?.exampleEn ?? safeEnglishText(atom.exampleEn);
  if (exampleJp && exampleEn) {
    const example = normalizeJapaneseDisplayText(
      exampleJp,
      enhancement?.exampleReading ?? readingForText(atom, exampleJp)
    );
    if (example) {
      prompts.push({
        label: `Example: ${atom.targetText}`,
        japanese: example.text,
        reading: example.reading,
        english: exampleEn,
      });
    }
  }

  for (const [index, variation] of (enhancement?.variations ?? [])
    .slice(0, MAX_VARIATIONS_PER_ATOM)
    .entries()) {
    const variationJapanese = normalizeJapaneseDisplayText(variation.japanese, variation.reading);
    if (!variationJapanese) continue;
    prompts.push({
      label: `Variation ${index + 1}: ${atom.targetText}`,
      japanese: variationJapanese.text,
      reading: variationJapanese.reading,
      english: variation.english,
    });
  }

  return prompts;
}

function dedupeDrillPrompts(prompts: DrillPrompt[], seenJapanese: Set<string>): DrillPrompt[] {
  const deduped: DrillPrompt[] = [];
  for (const prompt of prompts) {
    const key = prompt.japanese.replace(/\s+/g, '');
    // Deduping across the full practice prevents repeated slow/fast/English triplets.
    if (seenJapanese.has(key)) continue;
    seenJapanese.add(key);
    deduped.push(prompt);
  }
  return deduped;
}

function pushProductionPrompt(
  units: LessonScriptUnit[],
  prompt: DrillPrompt,
  l1VoiceId: string,
  l2VoiceId: string
) {
  const promptText =
    prompt.english === 'this expression'
      ? 'How do you say this expression?'
      : `How do you say "${prompt.english}"?`;

  units.push(
    { type: 'marker', label: prompt.label },
    {
      type: 'narration_L1',
      text: promptText,
      voiceId: l1VoiceId,
    },
    { type: 'pause', seconds: recallPauseSeconds(prompt.english) },
    {
      type: 'L2',
      text: prompt.japanese,
      reading: prompt.reading,
      translation: prompt.english,
      voiceId: l2VoiceId,
      speed: 0.75,
    },
    { type: 'pause', seconds: 1 },
    {
      type: 'L2',
      text: prompt.japanese,
      reading: prompt.reading,
      translation: prompt.english,
      voiceId: l2VoiceId,
      speed: 1,
    },
    { type: 'pause', seconds: 2.5 }
  );
}

function pushRecognitionPrompt(
  units: LessonScriptUnit[],
  prompt: DrillPrompt,
  l1VoiceId: string,
  l2VoiceId: string
) {
  units.push(
    { type: 'marker', label: `Recognition: ${prompt.label}` },
    {
      type: 'L2',
      text: prompt.japanese,
      reading: prompt.reading,
      translation: prompt.english,
      voiceId: l2VoiceId,
      speed: 0.75,
    },
    { type: 'pause', seconds: recallPauseSeconds(prompt.english) },
    {
      type: 'L2',
      text: prompt.japanese,
      reading: prompt.reading,
      translation: prompt.english,
      voiceId: l2VoiceId,
      speed: 1,
    },
    { type: 'pause', seconds: 1.25 },
    {
      type: 'narration_L1',
      text: prompt.english,
      voiceId: l1VoiceId,
    },
    { type: 'pause', seconds: 2 }
  );
}

function buildDrillScript(
  options: ScriptGenerationOptions,
  enhancements: Map<string, DrillItemEnhancement>
): LessonScriptUnit[] {
  const l2VoiceId = options.speakerVoiceIds[0];
  const units: LessonScriptUnit[] = [
    { type: 'marker', label: 'Daily Audio Practice - Drills' },
    {
      type: 'narration_L1',
      text: "Daily Audio Practice. We'll start with recognition drills, then switch to production drills.",
      voiceId: options.l1VoiceId,
    },
    { type: 'pause', seconds: 1 },
  ];
  const allPrompts: DrillPrompt[] = [];
  const seenJapanese = new Set<string>();

  for (const atom of options.atoms) {
    allPrompts.push(
      ...dedupeDrillPrompts(buildDrillPrompts(atom, enhancements.get(atom.cardId)), seenJapanese)
    );
  }

  units.push({ type: 'marker', label: 'Recognition drills' });
  for (const prompt of allPrompts) {
    pushRecognitionPrompt(units, prompt, options.l1VoiceId, l2VoiceId);
  }

  units.push(
    { type: 'marker', label: 'Production drills' },
    {
      type: 'narration_L1',
      text: 'Now the order reverses. Listen to the English prompt, then say the Japanese before the answer.',
      voiceId: options.l1VoiceId,
    },
    { type: 'pause', seconds: 1 }
  );
  for (const prompt of allPrompts) {
    pushProductionPrompt(units, prompt, options.l1VoiceId, l2VoiceId);
  }

  units.push({
    type: 'narration_L1',
    text: 'Drill track complete. Nice work.',
    voiceId: options.l1VoiceId,
  });
  return units;
}

export async function buildDailyAudioPracticeDrillScript(
  options: ScriptGenerationOptions
): Promise<LessonScriptUnit[]> {
  if (options.atoms.length === 0) {
    throw new Error('Daily Audio Practice needs at least one eligible study card.');
  }

  const boundedOptions = {
    ...options,
    atoms: options.atoms.slice(0, MAX_SCRIPT_ATOMS),
  };
  const enhancements = await buildDrillItemEnhancements(boundedOptions.atoms);
  const drill = buildDrillScript(boundedOptions, enhancements);
  validateDailyAudioScriptUnits(drill);
  return drill;
}

function hasL2Units(units: LessonScriptUnit[]): boolean {
  return units.some((unit) => unit.type === 'L2');
}

function pushFallbackDialogueLines(units: LessonScriptUnit[], options: ScriptGenerationOptions) {
  units.push({ type: 'marker', label: 'Flashcard dialogue fallback' });
  for (const [index, atom] of options.atoms.slice(0, 8).entries()) {
    units.push(
      {
        type: 'L2',
        text: atom.exampleJp ?? atom.targetText,
        reading: readingForText(atom, atom.exampleJp ?? atom.targetText),
        translation: atom.exampleEn ?? atom.english,
        voiceId: options.speakerVoiceIds[index % 2] ?? options.speakerVoiceIds[0],
        speed: 1,
      },
      { type: 'pause', seconds: 1 }
    );
  }
}

function pushFallbackStoryLines(units: LessonScriptUnit[], options: ScriptGenerationOptions) {
  for (const atom of options.atoms.slice(0, 10)) {
    units.push(
      {
        type: 'L2',
        text: atom.exampleJp ?? atom.targetText,
        reading: readingForText(atom, atom.exampleJp ?? atom.targetText),
        translation: atom.exampleEn ?? atom.english,
        voiceId: options.speakerVoiceIds[0],
        speed: 1,
      },
      { type: 'pause', seconds: 1.25 }
    );
  }
}

async function buildDialogueScript(options: ScriptGenerationOptions): Promise<LessonScriptUnit[]> {
  const targetLanguageName = languageName(options.targetLanguage);
  const prompt = `Create short ${targetLanguageName} dialogue scenes for audio-only language practice.

Use these learner items:
${options.atoms.map((atom, index) => `${index + 1}. ${atom.targetText} = ${atom.english}`).join('\n')}

Return JSON only:
{
  "scenes": [
    {
      "title": "...",
      "lines": [
        {"speaker":"speaker1","text":"...","reading":"...","translation":"..."},
        {"speaker":"speaker2","text":"...","reading":"...","translation":"..."}
      ]
    }
  ]
}`;
  const parsed = parseJsonObject(
    await generateCoreLlmJsonText(
      prompt,
      `Return valid JSON for an audio-only ${targetLanguageName} dialogue.`
    )
  );
  const scenes = Array.isArray(parsed.scenes) ? parsed.scenes : [];
  const units: LessonScriptUnit[] = [
    { type: 'marker', label: 'Daily Audio Practice - Dialogues' },
    {
      type: 'narration_L1',
      text: 'Now listen to short dialogues using your recent flashcards.',
      voiceId: options.l1VoiceId,
    },
    { type: 'pause', seconds: 1 },
  ];

  for (const scene of scenes) {
    if (!scene || typeof scene !== 'object') continue;
    const sceneRecord = scene as Record<string, unknown>;
    if (typeof sceneRecord.title === 'string') {
      units.push({ type: 'marker', label: sceneRecord.title });
    }
    const lines = Array.isArray(sceneRecord.lines) ? sceneRecord.lines : [];
    for (const line of lines) {
      if (!line || typeof line !== 'object') continue;
      const lineRecord = line as Record<string, unknown>;
      const text = typeof lineRecord.text === 'string' ? lineRecord.text.trim() : '';
      if (!text) continue;
      const speakerIndex = lineRecord.speaker === 'speaker2' ? 1 : 0;
      units.push(
        {
          type: 'L2',
          text,
          reading: typeof lineRecord.reading === 'string' ? lineRecord.reading : undefined,
          translation:
            typeof lineRecord.translation === 'string' ? lineRecord.translation : undefined,
          voiceId: options.speakerVoiceIds[speakerIndex] ?? options.speakerVoiceIds[0],
          speed: 1,
        },
        { type: 'pause', seconds: 1 }
      );
    }
  }

  if (!hasL2Units(units)) {
    pushFallbackDialogueLines(units, options);
  }

  return units;
}

async function buildStoryScript(options: ScriptGenerationOptions): Promise<LessonScriptUnit[]> {
  const targetLanguageName = languageName(options.targetLanguage);
  const prompt = `Create one short ${targetLanguageName} monologue story for audio-only language practice.

Use and repeat these learner items naturally:
${options.atoms.map((atom, index) => `${index + 1}. ${atom.targetText} = ${atom.english}`).join('\n')}

Return JSON only:
{
  "title": "...",
  "lines": [
    {"text":"...","reading":"...","translation":"..."}
  ]
}`;
  const parsed = parseJsonObject(
    await generateCoreLlmJsonText(
      prompt,
      `Return valid JSON for an audio-only ${targetLanguageName} monologue.`
    )
  );
  const units: LessonScriptUnit[] = [
    { type: 'marker', label: 'Daily Audio Practice - Story' },
    {
      type: 'narration_L1',
      text:
        typeof parsed.title === 'string'
          ? `Finally, a short story: ${parsed.title}.`
          : 'Finally, a short story using your cards.',
      voiceId: options.l1VoiceId,
    },
    { type: 'pause', seconds: 1 },
  ];

  const lines = Array.isArray(parsed.lines) ? parsed.lines : [];
  for (const line of lines) {
    if (!line || typeof line !== 'object') continue;
    const lineRecord = line as Record<string, unknown>;
    const text = typeof lineRecord.text === 'string' ? lineRecord.text.trim() : '';
    if (!text) continue;
    units.push(
      {
        type: 'L2',
        text,
        reading: typeof lineRecord.reading === 'string' ? lineRecord.reading : undefined,
        translation:
          typeof lineRecord.translation === 'string' ? lineRecord.translation : undefined,
        voiceId: options.speakerVoiceIds[0],
        speed: 1,
      },
      { type: 'pause', seconds: 1.25 }
    );
  }

  if (!hasL2Units(units)) {
    pushFallbackStoryLines(units, options);
  }

  return units;
}

export function validateDailyAudioScriptUnits(units: LessonScriptUnit[]): void {
  if (!Array.isArray(units) || units.length === 0) {
    throw new Error('Daily audio script must include at least one unit.');
  }

  for (const unit of units) {
    if (unit.type === 'pause') {
      if (!(unit.seconds > 0)) throw new Error('Pause units must have a positive duration.');
    } else if (unit.type === 'L2' || unit.type === 'narration_L1') {
      if (!unit.text.trim()) throw new Error('Spoken units must include text.');
      if (!unit.voiceId.trim()) throw new Error('Spoken units must include a voice ID.');
    } else if (unit.type === 'marker') {
      if (!unit.label.trim()) throw new Error('Marker units must include a label.');
    } else {
      throw new Error('Unsupported daily audio script unit.');
    }
  }
}

export async function buildDailyAudioPracticeScripts(
  options: ScriptGenerationOptions
): Promise<GeneratedScripts> {
  if (options.atoms.length === 0) {
    throw new Error('Daily Audio Practice needs at least one eligible study card.');
  }

  const boundedOptions = {
    ...options,
    atoms: options.atoms.slice(0, MAX_SCRIPT_ATOMS),
  };
  const [dialogue, story] = await Promise.all([
    buildDialogueScript(boundedOptions),
    buildStoryScript(boundedOptions),
  ]);
  const scripts: GeneratedScripts = {
    drill: await buildDailyAudioPracticeDrillScript(boundedOptions),
    dialogue,
    story,
  };

  validateDailyAudioScriptUnits(scripts.drill);
  validateDailyAudioScriptUnits(scripts.dialogue);
  validateDailyAudioScriptUnits(scripts.story);

  return scripts;
}
