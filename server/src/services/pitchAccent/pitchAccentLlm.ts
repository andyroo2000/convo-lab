import { generateOpenAIPlainTextResponse } from '../openAIClient.js';

import type { PitchAccentReadingSelector } from './types.js';

const DEFAULT_PITCH_ACCENT_READING_MODEL = 'gpt-5.4-mini';

export const selectPitchAccentReadingWithLlm: PitchAccentReadingSelector = async ({
  expression,
  sentenceJp,
  candidates,
}) => {
  const response = await generateOpenAIPlainTextResponse({
    model: process.env.PITCH_ACCENT_READING_MODEL ?? DEFAULT_PITCH_ACCENT_READING_MODEL,
    reasoningEffort: process.env.PITCH_ACCENT_READING_REASONING_EFFORT ?? 'low',
    systemInstruction:
      'Choose the kana reading used by the Japanese word in context. Return exactly one candidate reading in hiragana, or return an empty string if not confident.',
    prompt: JSON.stringify({
      expression,
      sentenceJp: sentenceJp || null,
      candidates,
    }),
  });

  return response.trim();
};
