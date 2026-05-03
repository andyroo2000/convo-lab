import { hatsuon } from 'hatsuon';

import type { KanjiumPitchCandidate, PitchAccentPattern } from './types.js';

export function buildPitchAccentPattern(candidate: KanjiumPitchCandidate): PitchAccentPattern {
  const result = hatsuon({
    reading: candidate.reading,
    pitchNum: candidate.pitchNum,
  });

  const pattern = result.pattern.slice(0, result.morae.length);

  return {
    expression: candidate.surface,
    reading: result.reading,
    pitchNum: result.pitchNum,
    morae: result.morae,
    pattern,
    patternName: result.patternName,
  };
}
