import { generateCoreLlmJsonText } from '../coreLlmClient.js';
import type { LessonScriptUnit } from '../lessonScriptGenerator.js';

import type { DailyAudioLearningAtom, DailyAudioPracticeTrackMode } from './types.js';

const MAX_SCRIPT_ATOMS = 50;
const JAPANESE_TEXT_PATTERN = /[\u3040-\u30ff\u3400-\u9fff]/;

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
- Use the learner item naturally in a new Japanese example sentence.
- Keep the Japanese around JLPT N5-N4 level.
- Keep English fields English only. Never include Japanese characters in englishCue or exampleEn.
- If the definition is Japanese-only, translate it into a short natural English cue.
- Do not copy the source example sentence unless there is no reasonable alternative.

Return JSON only:
{
  "items": [
    {
      "cardId":"...",
      "englishCue":"short English cue",
      "exampleJp":"new Japanese sentence",
      "exampleReading":"optional reading with furigana",
      "exampleEn":"English translation of the new sentence"
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
      const exampleJp =
        typeof record.exampleJp === 'string' && record.exampleJp.trim()
          ? record.exampleJp.trim()
          : undefined;
      const exampleReading =
        typeof record.exampleReading === 'string' && record.exampleReading.trim()
          ? record.exampleReading.trim()
          : undefined;
      const exampleEn = safeEnglishText(
        typeof record.exampleEn === 'string' ? record.exampleEn : null
      );

      const enhancement: DrillItemEnhancement = {};
      if (englishCue) enhancement.englishCue = englishCue;
      if (exampleJp) enhancement.exampleJp = exampleJp;
      if (exampleReading) enhancement.exampleReading = exampleReading;
      if (exampleEn) enhancement.exampleEn = exampleEn;
      enhancementByCardId.set(cardId, enhancement);
    }
    return enhancementByCardId;
  } catch {
    return new Map();
  }
}

function pushAtomDrill(
  units: LessonScriptUnit[],
  atom: DailyAudioLearningAtom,
  l1VoiceId: string,
  l2VoiceId: string,
  enhancement: DrillItemEnhancement | undefined
) {
  const cueText = enhancement?.englishCue ?? fallbackCueText(atom);
  const promptText =
    cueText === 'this expression'
      ? 'How do you say this expression?'
      : `How do you say "${cueText}"?`;
  const exampleJp = enhancement?.exampleJp ?? atom.exampleJp;
  const exampleEn = enhancement?.exampleEn ?? safeEnglishText(atom.exampleEn);
  const exampleReading = enhancement?.exampleReading ?? readingForText(atom, exampleJp ?? '');

  units.push(
    { type: 'marker', label: `Drill: ${atom.targetText}` },
    {
      type: 'narration_L1',
      text: promptText,
      voiceId: l1VoiceId,
    },
    { type: 'pause', seconds: recallPauseSeconds(cueText) },
    {
      type: 'L2',
      text: atom.targetText,
      reading: atom.reading ?? undefined,
      translation: cueText,
      voiceId: l2VoiceId,
      speed: 1,
    },
    { type: 'pause', seconds: 1.5 },
    {
      type: 'L2',
      text: atom.targetText,
      reading: atom.reading ?? undefined,
      translation: cueText,
      voiceId: l2VoiceId,
      speed: 0.85,
    },
    { type: 'pause', seconds: 2.5 }
  );

  if (exampleJp) {
    units.push(
      {
        type: 'narration_L1',
        text: exampleEn ? `Now try a sentence: ${exampleEn}` : 'Now listen in context.',
        voiceId: l1VoiceId,
      },
      { type: 'pause', seconds: exampleEn ? recallPauseSeconds(exampleEn) : 0.5 },
      {
        type: 'L2',
        text: exampleJp,
        reading: exampleReading,
        translation: exampleEn ?? cueText,
        voiceId: l2VoiceId,
        speed: 1,
      },
      { type: 'pause', seconds: 2 }
    );
  }
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
      text: "Daily Audio Practice. We'll start with focused recall and shadowing drills.",
      voiceId: options.l1VoiceId,
    },
    { type: 'pause', seconds: 1 },
  ];

  for (const atom of options.atoms) {
    pushAtomDrill(
      units,
      atom,
      options.l1VoiceId,
      l2VoiceId,
      enhancements.get(atom.cardId)
    );
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
