import type {
  JapanesePitchAccentPayload,
  JapanesePitchAccentResolvedBy,
  JapanesePitchAccentUnresolvedReason,
} from '@languageflow/shared/src/types.js';

import { buildPitchAccentPattern } from './hatsuonAdapter.js';
import { getKanjiumCandidates } from './kanjiumData.js';
import { selectPitchAccentReadingWithLlm } from './pitchAccentLlm.js';
import { collectPitchAccentReadingCandidates } from './readingCandidates.js';
import type { KanjiumPitchCandidate, PitchAccentResolverInput } from './types.js';

function toUnresolved(
  expression: string,
  reason: JapanesePitchAccentUnresolvedReason,
  resolvedBy: 'llm' | 'none' = 'none'
): JapanesePitchAccentPayload {
  return {
    status: 'unresolved',
    expression,
    reason,
    source: 'kanjium',
    resolvedBy,
  };
}

function hasJapanese(value: string): boolean {
  return /[\u3040-\u30ff\u4e00-\u9faf]/.test(value);
}

function uniqueReadings(candidates: KanjiumPitchCandidate[]): string[] {
  return Array.from(new Set(candidates.map((candidate) => candidate.reading)));
}

function buildResolved(
  candidate: KanjiumPitchCandidate,
  candidates: KanjiumPitchCandidate[],
  resolvedBy: JapanesePitchAccentResolvedBy
): JapanesePitchAccentPayload {
  const primary = buildPitchAccentPattern(candidate);
  const alternatives = candidates
    .filter((entry) => entry !== candidate)
    .map((entry) => {
      const { expression: _expression, ...alternative } = buildPitchAccentPattern(entry);
      return alternative;
    });

  return {
    status: 'resolved',
    expression: primary.expression,
    reading: primary.reading,
    pitchNum: primary.pitchNum,
    morae: primary.morae,
    pattern: primary.pattern,
    patternName: primary.patternName,
    source: 'kanjium',
    resolvedBy,
    ...(alternatives.length > 0 ? { alternatives } : {}),
  };
}

function findByReading(
  candidates: KanjiumPitchCandidate[],
  readings: string[]
): KanjiumPitchCandidate | null {
  for (const reading of readings) {
    const candidate = candidates.find((entry) => entry.reading === reading);
    if (candidate) return candidate;
  }

  return null;
}

export async function resolvePitchAccent(
  input: PitchAccentResolverInput
): Promise<JapanesePitchAccentPayload> {
  if (input.cached?.status === 'resolved') {
    return input.cached;
  }

  const expression = input.expression?.trim() ?? '';
  if (!expression) return toUnresolved('', 'no-expression');
  if (!hasJapanese(expression)) return toUnresolved(expression, 'not-japanese');

  const candidates = (input.entries ?? (await getKanjiumCandidates(expression))).filter(
    (entry) => entry.surface === expression
  );
  if (candidates.length === 0) return toUnresolved(expression, 'not-found');

  const readingCandidates = collectPitchAccentReadingCandidates(input);
  const localMatch = findByReading(candidates, readingCandidates);
  if (localMatch) return buildResolved(localMatch, candidates, 'local-reading');

  const readings = uniqueReadings(candidates);
  if (readings.length === 1 && candidates[0]) {
    return buildResolved(candidates[0], candidates, 'single-candidate');
  }

  const selectReading = input.selectReading ?? selectPitchAccentReadingWithLlm;
  const selected = await selectReading({
    expression,
    sentenceJp: input.sentenceJp,
    candidates: readings,
  }).catch(() => '');
  const llmMatch = candidates.find((candidate) => candidate.reading === selected.trim());
  if (llmMatch) return buildResolved(llmMatch, candidates, 'llm');

  return toUnresolved(expression, 'ambiguous-reading', 'llm');
}
