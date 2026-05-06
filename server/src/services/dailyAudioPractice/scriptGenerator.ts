import { generateCoreLlmJsonText } from '../coreLlmClient.js';
import { applyJapanesePronunciationOverrides } from '../japanesePronunciationOverrides.js';
import type { LessonScriptUnit } from '../lessonScriptGenerator.js';

import type { DailyAudioLearningAtom, DailyAudioPracticeTrackMode } from './types.js';

const MAX_SCRIPT_ATOMS = 50;
const MAX_VARIATIONS_PER_ATOM = 4;
const DRILL_ENHANCEMENT_BATCH_SIZE = 5;
const JAPANESE_TEXT_PATTERN = /[\u3040-\u30ff\u3400-\u9fff]/;
const KANJI_TEXT_PATTERN = /[\u3400-\u9fff々〆ヵヶ]/;
const LATIN_TEXT_PATTERN = /[A-Za-z]/;
const SAFE_READING_TEXT_PATTERN =
  /^[\u3040-\u30ff\u3400-\u9fff々〆ヵヶー\s、。！？!?.,・「」『』（）()[\]0-9]+$/;
const INLINE_PAREN_READING_PATTERN = /([\u3400-\u9fff々〆ヵヶ]+)[(（]([\u3040-\u30ffー\s]+)[)）]/;
const INLINE_BRACKET_READING_PATTERN =
  /([^\s[\]]*[\u3040-\u30ff\u3400-\u9fff][^\s[\]]*)\[([\u3040-\u30ffー\s]+)\]/;
const DRILL_VARIATION_KINDS = ['grammar_substitution', 'form_transform'] as const;

interface ScriptGenerationOptions {
  atoms: DailyAudioLearningAtom[];
  targetDurationMinutes: number;
  targetLanguage: string;
  nativeLanguage: string;
  l1VoiceId: string;
  speakerVoiceIds: [string, string] | string[];
}

type GeneratedScripts = Record<DailyAudioPracticeTrackMode, LessonScriptUnit[]>;

export interface DailyAudioDrillGenerationMetadata {
  enhancedAtomCount: number;
  generatedPromptCount: number;
  fallbackPromptCount: number;
  missingCueCount: number;
  totalPromptCount: number;
  unitCount: number;
  l2UnitCount: number;
  l2UnitsWithReadingCount: number;
  l2UnitsMissingReadingCount: number;
  pronunciationOverrideCount: number;
}

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
  source: 'generated' | 'fallback';
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
  if (/^this expression$/i.test(trimmed)) return null;
  return trimmed;
}

function parseDrillVariationKind(value: unknown): DrillVariation['kind'] | null {
  return typeof value === 'string' && (DRILL_VARIATION_KINDS as readonly string[]).includes(value)
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

function hasKanji(text: string): boolean {
  return KANJI_TEXT_PATTERN.test(text);
}

function isSafeJapaneseReadingText(reading: string): boolean {
  const trimmed = reading.trim();
  if (!trimmed) return false;
  if (LATIN_TEXT_PATTERN.test(trimmed)) return false;
  if (!JAPANESE_TEXT_PATTERN.test(trimmed)) return false;
  if (!SAFE_READING_TEXT_PATTERN.test(trimmed)) return false;
  return !hasKanji(trimmed) || INLINE_BRACKET_READING_PATTERN.test(trimmed);
}

function normalizeJapaneseDisplayText(
  text: string | null | undefined,
  reading?: string | null,
  options: { requireReadingForKanji?: boolean } = {}
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
  const candidateReading = normalizeFuriganaFormat(reading) ?? derivedReading;
  const normalizedReading =
    candidateReading && isSafeJapaneseReadingText(candidateReading) ? candidateReading : undefined;

  if (!plainText) return null;
  if (options.requireReadingForKanji && hasKanji(plainText) && !normalizedReading) return null;
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

function fallbackCueText(atom: DailyAudioLearningAtom): string | null {
  return safeEnglishText(atom.english) ?? safeEnglishText(atom.exampleEn);
}

function recallPauseSeconds(text: string): number {
  const length = text.trim().length;
  if (length > 80) return 9;
  if (length > 48) return 7;
  if (length > 28) return 5.5;
  return 4;
}

function stringField(record: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}

function parseGeneratedVariation(
  value: unknown,
  kind: DrillVariation['kind'],
  englishCue: string | null
): DrillVariation | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const variationJapanese = normalizeJapaneseDisplayText(
    stringField(record, 'japanese', 'text', 'exampleJp'),
    stringField(record, 'reading', 'exampleReading'),
    { requireReadingForKanji: true }
  );
  const english = safeGeneratedEnglishTranslation(
    stringField(record, 'english', 'translation', 'exampleEn'),
    variationJapanese?.text,
    englishCue
  );
  if (!variationJapanese || !english) return null;

  const safeVariation: DrillVariation = { kind, japanese: variationJapanese.text, english };
  if (variationJapanese.reading) safeVariation.reading = variationJapanese.reading;
  return safeVariation;
}

function appendGeneratedVariations(
  output: DrillVariation[],
  values: unknown,
  kind: DrillVariation['kind'],
  englishCue: string | null
) {
  if (!Array.isArray(values)) return;
  for (const value of values) {
    const parsed = parseGeneratedVariation(value, kind, englishCue);
    if (parsed) output.push(parsed);
  }
}

function inferLegacyVariationKind(index: number): DrillVariation['kind'] {
  return index < 2 ? 'grammar_substitution' : 'form_transform';
}

function appendLegacyVariations(
  output: DrillVariation[],
  values: unknown,
  englishCue: string | null
) {
  if (!Array.isArray(values)) return;
  values.forEach((value, index) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const record = value as Record<string, unknown>;
    const explicitKind = parseDrillVariationKind(record.kind);
    if (typeof record.kind === 'string' && !explicitKind) return;
    const kind = explicitKind ?? inferLegacyVariationKind(index);
    const parsed = parseGeneratedVariation(value, kind, englishCue);
    if (parsed) output.push(parsed);
  });
}

function selectBalancedVariations(variations: DrillVariation[]): DrillVariation[] {
  const selected: DrillVariation[] = [
    ...variations.filter((variation) => variation.kind === 'grammar_substitution').slice(0, 2),
    ...variations.filter((variation) => variation.kind === 'form_transform').slice(0, 2),
  ];
  const selectedKeys = new Set(
    selected.map((variation) => `${variation.kind}:${variation.japanese}`)
  );
  for (const variation of variations) {
    if (selected.length >= MAX_VARIATIONS_PER_ATOM) break;
    const key = `${variation.kind}:${variation.japanese}`;
    if (selectedKeys.has(key)) continue;
    selected.push(variation);
    selectedKeys.add(key);
  }
  return selected;
}

async function buildDrillItemEnhancementBatch(
  atoms: DailyAudioLearningAtom[]
): Promise<Map<string, DrillItemEnhancement>> {
  if (atoms.length === 0) return new Map();

  const prompt = `Create fresh N5-N4 Japanese drill examples from these learner items.

Requirements:
- Use the learner item naturally in new Japanese example sentences.
- For every item, create a balanced ladder before moving to the next item:
  1. anchor is the close anchor: a fresh sentence that clearly connects to the flashcard but does not copy the source example.
  2. grammarSubstitutions contains exactly two items: keep the same grammar structure or sentence pattern, but swap in different common N5-N4 words, objects, people, places, or contexts.
  3. formTransforms contains exactly two items: keep the target word, verb family, or core expression and change the form when linguistically appropriate, such as past, negative, potential, negative-past, polite/plain, or simple combinations.
- For single words, reuse the word in different simple N5-N4 contexts and include at least one form_transform when the word can inflect. For non-inflecting nouns, use natural phrase/sentence frame changes instead of fake conjugations.
- For grammar patterns or sentence phrases, reuse the same structure with different common N5-N4 words the learner is likely to know, then include form changes on the main verb/adjective when possible.
- Keep the Japanese around JLPT N5-N4 level.
- Put normal Japanese only in anchor.japanese, grammarSubstitutions[].japanese, and formTransforms[].japanese. Do not include furigana, romaji, parenthetical readings, or bracket readings there.
- Put furigana only in reading fields.
- If a Japanese example contains kanji, reading is required. Use bracket-notation furigana such as 物価[ぶっか] or kana-only text. Do not use romaji or English in reading fields.
- Keep English fields English only. Never include Japanese characters in englishCue or english fields.
- Translate each full Japanese example sentence into a complete, idiomatic English sentence. Do not use only the target word as the translation.
- Translate context-dependent words by the meaning they have in the generated sentence, not by a literal dictionary gloss.
- Preserve the grammar and topic of the Japanese sentence. Do not turn time/place topics into literal English subjects when that changes the meaning.
- If the definition is Japanese-only or mixed Japanese/English, translate it into a short natural English cue.
- Do not copy the source example sentence unless there is no reasonable alternative.
- Prefer new generated sentences over restating the card target by itself.

Return JSON only:
{
  "items": [
    {
      "cardId":"...",
      "englishCue":"short English cue",
      "anchor": {
        "japanese":"new close-anchor Japanese sentence",
        "reading":"required when japanese contains kanji; bracket furigana or kana-only",
        "english":"English translation"
      },
      "grammarSubstitutions": [
        {
          "japanese":"variation Japanese sentence",
          "reading":"required when japanese contains kanji",
          "english":"English translation"
        }
      ],
      "formTransforms": [
        {
          "japanese":"variation Japanese sentence",
          "reading":"required when japanese contains kanji",
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
      const anchorRecord =
        record.anchor && typeof record.anchor === 'object' && !Array.isArray(record.anchor)
          ? (record.anchor as Record<string, unknown>)
          : null;
      const example = anchorRecord
        ? normalizeJapaneseDisplayText(
            stringField(anchorRecord, 'japanese', 'text', 'exampleJp'),
            stringField(anchorRecord, 'reading', 'exampleReading'),
            { requireReadingForKanji: true }
          )
        : normalizeJapaneseDisplayText(
            typeof record.exampleJp === 'string' ? record.exampleJp : null,
            typeof record.exampleReading === 'string' ? record.exampleReading : null,
            { requireReadingForKanji: true }
          );
      const exampleEn = safeGeneratedEnglishTranslation(
        anchorRecord
          ? stringField(anchorRecord, 'english', 'translation', 'exampleEn')
          : typeof record.exampleEn === 'string'
            ? record.exampleEn
            : null,
        example?.text,
        englishCue
      );
      const variations: DrillVariation[] = [];
      appendGeneratedVariations(
        variations,
        record.grammarSubstitutions,
        'grammar_substitution',
        englishCue
      );
      appendGeneratedVariations(variations, record.formTransforms, 'form_transform', englishCue);
      appendLegacyVariations(variations, record.variations, englishCue);

      const enhancement: DrillItemEnhancement = {};
      if (englishCue) enhancement.englishCue = englishCue;
      if (example && exampleEn) {
        enhancement.exampleJp = example.text;
        enhancement.exampleEn = exampleEn;
        if (example.reading) enhancement.exampleReading = example.reading;
      }
      if (variations.length) enhancement.variations = selectBalancedVariations(variations);
      enhancementByCardId.set(cardId, enhancement);
    }
    return enhancementByCardId;
  } catch (error) {
    console.warn('[DailyAudioPractice] Drill enhancement batch failed; using fallbacks.', {
      cardCount: atoms.length,
      cardIds: atoms.map((atom) => atom.cardId),
      error: error instanceof Error ? error.message : String(error),
    });
    return new Map();
  }
}

async function buildDrillItemEnhancements(
  atoms: DailyAudioLearningAtom[]
): Promise<Map<string, DrillItemEnhancement>> {
  const enhancementByCardId = new Map<string, DrillItemEnhancement>();
  for (let index = 0; index < atoms.length; index += DRILL_ENHANCEMENT_BATCH_SIZE) {
    const batch = atoms.slice(index, index + DRILL_ENHANCEMENT_BATCH_SIZE);
    const batchEnhancements = await buildDrillItemEnhancementBatch(batch);
    for (const [cardId, enhancement] of batchEnhancements) {
      enhancementByCardId.set(cardId, enhancement);
    }
  }
  return enhancementByCardId;
}

interface DrillPromptBuildResult {
  prompts: DrillPrompt[];
  enhanced: boolean;
  generatedPromptCount: number;
  fallbackPromptCount: number;
  missingCueCount: number;
}

function buildDrillPrompts(
  atom: DailyAudioLearningAtom,
  enhancement: DrillItemEnhancement | undefined
): DrillPromptBuildResult {
  const cueText = enhancement?.englishCue ?? fallbackCueText(atom);
  const target = normalizeJapaneseDisplayText(atom.targetText, atom.reading) ?? {
    text: atom.targetText,
    reading: atom.reading ?? undefined,
  };
  const prompts: DrillPrompt[] = [];
  let generatedPromptCount = 0;
  let fallbackPromptCount = 0;
  const hasGeneratedContent =
    Boolean(enhancement?.exampleJp && enhancement.exampleEn) ||
    Boolean(enhancement?.variations?.length);

  const exampleJp = enhancement?.exampleJp ?? atom.exampleJp;
  const exampleEn =
    enhancement?.exampleEn ?? (hasGeneratedContent ? null : safeEnglishText(atom.exampleEn));
  if (exampleJp && exampleEn) {
    const example = normalizeJapaneseDisplayText(
      exampleJp,
      enhancement?.exampleReading ?? readingForText(atom, exampleJp)
    );
    if (example) {
      prompts.push({
        label: `Anchor: ${atom.targetText}`,
        japanese: example.text,
        reading: example.reading,
        english: exampleEn,
        source: hasGeneratedContent ? 'generated' : 'fallback',
      });
      if (hasGeneratedContent) generatedPromptCount += 1;
      else fallbackPromptCount += 1;
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
      source: 'generated',
    });
    generatedPromptCount += 1;
  }

  if (!hasGeneratedContent && cueText) {
    prompts.unshift({
      label: `Drill: ${atom.targetText}`,
      japanese: target.text,
      reading: target.reading,
      english: cueText,
      source: 'fallback',
    });
    fallbackPromptCount += 1;
  }

  const missingCueCount = !cueText && !hasGeneratedContent ? 1 : 0;

  return {
    prompts,
    enhanced: hasGeneratedContent,
    generatedPromptCount,
    fallbackPromptCount,
    missingCueCount,
  };
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
  const promptText = `How do you say "${prompt.english}"?`;

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
): { units: LessonScriptUnit[]; metadata: DailyAudioDrillGenerationMetadata } {
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
  const metadata: DailyAudioDrillGenerationMetadata = {
    enhancedAtomCount: 0,
    generatedPromptCount: 0,
    fallbackPromptCount: 0,
    missingCueCount: 0,
    totalPromptCount: 0,
    unitCount: 0,
    l2UnitCount: 0,
    l2UnitsWithReadingCount: 0,
    l2UnitsMissingReadingCount: 0,
    pronunciationOverrideCount: 0,
  };

  for (const atom of options.atoms) {
    const built = buildDrillPrompts(atom, enhancements.get(atom.cardId));
    if (built.enhanced) metadata.enhancedAtomCount += 1;
    metadata.missingCueCount += built.missingCueCount;
    const deduped = dedupeDrillPrompts(built.prompts, seenJapanese);
    metadata.generatedPromptCount += deduped.filter(
      (prompt) => prompt.source === 'generated'
    ).length;
    metadata.fallbackPromptCount += deduped.filter((prompt) => prompt.source === 'fallback').length;
    allPrompts.push(...deduped);
  }
  metadata.totalPromptCount = allPrompts.length;

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
  metadata.unitCount = units.length;
  Object.assign(metadata, buildDrillPronunciationMetadata(units));
  return { units, metadata };
}

function buildDrillPronunciationMetadata(
  units: LessonScriptUnit[]
): Pick<
  DailyAudioDrillGenerationMetadata,
  | 'l2UnitCount'
  | 'l2UnitsWithReadingCount'
  | 'l2UnitsMissingReadingCount'
  | 'pronunciationOverrideCount'
> {
  let l2UnitCount = 0;
  let l2UnitsWithReadingCount = 0;
  let l2UnitsMissingReadingCount = 0;
  let pronunciationOverrideCount = 0;

  for (const unit of units) {
    if (unit.type !== 'L2') continue;
    l2UnitCount += 1;
    if (unit.reading?.trim()) l2UnitsWithReadingCount += 1;
    else l2UnitsMissingReadingCount += 1;

    const ttsText = applyJapanesePronunciationOverrides({
      text: unit.text,
      reading: unit.reading,
    });
    if (ttsText !== unit.text) pronunciationOverrideCount += 1;
  }

  return {
    l2UnitCount,
    l2UnitsWithReadingCount,
    l2UnitsMissingReadingCount,
    pronunciationOverrideCount,
  };
}

export async function buildDailyAudioPracticeDrillScriptResult(
  options: ScriptGenerationOptions
): Promise<{ units: LessonScriptUnit[]; metadata: DailyAudioDrillGenerationMetadata }> {
  if (options.atoms.length === 0) {
    throw new Error('Daily Audio Practice needs at least one eligible study card.');
  }

  const boundedOptions = {
    ...options,
    atoms: options.atoms.slice(0, MAX_SCRIPT_ATOMS),
  };
  const enhancements = await buildDrillItemEnhancements(boundedOptions.atoms);
  const drill = buildDrillScript(boundedOptions, enhancements);
  validateDailyAudioScriptUnits(drill.units);
  return drill;
}

export async function buildDailyAudioPracticeDrillScript(
  options: ScriptGenerationOptions
): Promise<LessonScriptUnit[]> {
  return (await buildDailyAudioPracticeDrillScriptResult(options)).units;
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
