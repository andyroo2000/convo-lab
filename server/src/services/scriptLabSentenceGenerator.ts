import { SENTENCE_SCRIPT_PROMPT } from '@languageflow/shared/src/scriptLabPrompts.js';

import { LessonScriptUnit } from './courseScriptGenerator.js';
import { generateWithGemini } from './geminiClient.js';
import { applyJapanesePronunciationOverrides } from './pronunciation/overrideEngine.js';

export interface SentenceScriptOptions {
  sentence: string;
  translation?: string | null;
  targetLanguage?: string;
  nativeLanguage?: string;
  jlptLevel?: string;
  l1VoiceId: string;
  l2VoiceId: string;
  promptOverride?: string | null;
}

export interface SentenceScriptResult {
  units: LessonScriptUnit[] | null;
  estimatedDurationSeconds: number | null;
  rawResponse: string;
  resolvedPrompt: string;
  translation: string | null;
  parseError?: string;
}

const ALLOWED_TYPES = new Set(['narration_l1', 'l2', 'pause', 'marker']);

function applyPromptTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    return values[key] ?? '';
  });
}

function stripJsonFromResponse(response: string): string {
  const trimmed = response.trim();
  if (!trimmed.includes('```')) {
    return trimmed;
  }

  const match = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (match && match[1]) {
    return match[1].trim();
  }

  return trimmed;
}

function normalizeUnitType(type: unknown): string | null {
  if (typeof type !== 'string') {
    return null;
  }

  const normalized = type.trim().toLowerCase().replace(/-/g, '_');
  if (normalized === 'narration') {
    return 'narration_L1';
  }
  if (!ALLOWED_TYPES.has(normalized)) {
    return null;
  }

  if (normalized === 'narration_l1') {
    return 'narration_L1';
  }

  if (normalized === 'l2') {
    return 'L2';
  }

  return normalized;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeUnits(
  rawUnits: unknown,
  voiceIds: { l1VoiceId: string; l2VoiceId: string }
): LessonScriptUnit[] {
  if (!Array.isArray(rawUnits)) {
    return [];
  }

  const normalizedUnits: LessonScriptUnit[] = [];

  for (const rawUnit of rawUnits) {
    if (!rawUnit || typeof rawUnit !== 'object') {
      continue;
    }

    const unit = rawUnit as Record<string, unknown>;
    const type = normalizeUnitType(unit.type);
    if (!type) {
      continue;
    }

    if (type === 'pause') {
      const seconds =
        parseNumber(unit.seconds) ??
        parseNumber(unit.durationSeconds) ??
        parseNumber(unit.duration);
      if (seconds === null) {
        continue;
      }
      normalizedUnits.push({ type: 'pause', seconds: Math.max(0, seconds) });
      continue;
    }

    if (type === 'marker') {
      const label = typeof unit.label === 'string' ? unit.label.trim() : '';
      if (!label) {
        continue;
      }
      normalizedUnits.push({ type: 'marker', label });
      continue;
    }

    if (type === 'narration_L1') {
      const text = typeof unit.text === 'string' ? unit.text.trim() : '';
      if (!text) {
        continue;
      }
      normalizedUnits.push({ type: 'narration_L1', text, voiceId: voiceIds.l1VoiceId });
      continue;
    }

    if (type === 'L2') {
      const text = typeof unit.text === 'string' ? unit.text.trim() : '';
      if (!text) {
        continue;
      }

      const reading = typeof unit.reading === 'string' ? unit.reading.trim() : undefined;
      const translation =
        typeof unit.translation === 'string' ? unit.translation.trim() : undefined;
      const speed = parseNumber(unit.speed) ?? undefined;

      normalizedUnits.push({
        type: 'L2',
        text,
        reading: reading || undefined,
        translation: translation || undefined,
        voiceId: voiceIds.l2VoiceId,
        ...(speed ? { speed } : {}),
      });
    }
  }

  return normalizedUnits;
}

async function hydrateJapaneseReadings(
  units: LessonScriptUnit[],
  targetLanguage: string
): Promise<void> {
  if (targetLanguage !== 'ja') {
    return;
  }

  const unitsNeedingReadings = units.filter(
    (unit): unit is Extract<LessonScriptUnit, { type: 'L2' }> =>
      unit.type === 'L2' && (!unit.reading || !unit.reading.trim())
  );

  if (unitsNeedingReadings.length === 0) {
    return;
  }

  // Apply pronunciation dictionary overrides as best-effort fallback
  // (the LLM prompt already instructs to include readings; this handles any gaps)
  for (const unit of unitsNeedingReadings) {
    const corrected = applyJapanesePronunciationOverrides({
      text: unit.text,
      reading: null,
      furigana: null,
    });

    if (corrected) {
      unit.reading = corrected;
    }
  }
}

function estimateUnitsDuration(units: LessonScriptUnit[]): number {
  let duration = 0;

  for (const unit of units) {
    if (unit.type === 'pause') {
      duration += unit.seconds;
    } else if (unit.type === 'narration_L1') {
      const wordCount = unit.text.split(/\s+/).length;
      duration += wordCount / 3 + 0.5;
    } else if (unit.type === 'L2') {
      const charCount = unit.text.length;
      const speed = unit.speed || 1.0;
      duration += ((charCount / 5) * 1.5) / speed + 0.5;
    }
  }

  return duration;
}

export async function generateSentenceScript(
  options: SentenceScriptOptions
): Promise<SentenceScriptResult> {
  const {
    sentence,
    translation,
    targetLanguage = 'ja',
    nativeLanguage = 'en',
    jlptLevel,
    l1VoiceId,
    l2VoiceId,
    promptOverride,
  } = options;

  const promptTemplate = promptOverride?.trim() || SENTENCE_SCRIPT_PROMPT;

  const prompt = applyPromptTemplate(promptTemplate, {
    sentence,
    translation: translation?.trim() || '',
    targetLanguage,
    nativeLanguage,
    jlptLevel: jlptLevel || '',
  });

  const rawResponse = await generateWithGemini(prompt);
  const jsonText = stripJsonFromResponse(rawResponse);

  try {
    const parsed = JSON.parse(jsonText) as { units?: unknown; translation?: unknown } | unknown[];

    let unitsRaw: unknown = parsed;
    let resolvedTranslation = translation?.trim() || null;

    if (!Array.isArray(parsed) && parsed && typeof parsed === 'object') {
      unitsRaw = (parsed as { units?: unknown }).units;
      const parsedTranslation = (parsed as { translation?: unknown }).translation;
      if (typeof parsedTranslation === 'string' && parsedTranslation.trim()) {
        resolvedTranslation = parsedTranslation.trim();
      }
    }

    const units = normalizeUnits(unitsRaw, { l1VoiceId, l2VoiceId });

    await hydrateJapaneseReadings(units, targetLanguage);

    return {
      units,
      estimatedDurationSeconds: estimateUnitsDuration(units),
      rawResponse,
      resolvedPrompt: prompt,
      translation: resolvedTranslation,
    };
  } catch (err) {
    return {
      units: null,
      estimatedDurationSeconds: null,
      rawResponse,
      resolvedPrompt: prompt,
      translation: translation?.trim() || null,
      parseError: err instanceof Error ? err.message : 'Failed to parse script JSON',
    };
  }
}
