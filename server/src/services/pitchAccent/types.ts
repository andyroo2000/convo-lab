import type {
  JapanesePitchAccentAlternative,
  JapanesePitchAccentPayload,
} from '@languageflow/shared/src/types.js';

export interface KanjiumAccentRow {
  surface: string;
  reading: string;
  pitchNums: number[];
}

export interface KanjiumPitchCandidate {
  surface: string;
  reading: string;
  pitchNum: number;
}

export interface PitchAccentPattern extends JapanesePitchAccentAlternative {
  expression: string;
}

export interface PitchAccentResolverInput {
  expression?: string | null;
  expressionReading?: string | null;
  promptReading?: string | null;
  answerAudioTextOverride?: string | null;
  sentenceJp?: string | null;
  sentenceJpKana?: string | null;
  entries?: KanjiumPitchCandidate[];
  cached?: JapanesePitchAccentPayload | null;
  selectReading?: PitchAccentReadingSelector;
}

export type PitchAccentReadingSelector = (input: {
  expression: string;
  sentenceJp?: string | null;
  candidates: string[];
}) => Promise<string>;
