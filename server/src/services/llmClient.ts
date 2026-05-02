import { AppError } from '../middleware/errorHandler.js';

import { generateWithGemini } from './geminiClient.js';
import { generateOpenAIResponseText } from './openAIClient.js';

type LlmProvider = 'openai' | 'gemini';

const DEFAULT_STUDY_CARD_GENERATOR_PROVIDER: LlmProvider = 'openai';
const DEFAULT_STUDY_CARD_GENERATOR_MODEL = 'gpt-5.5';
const DEFAULT_STUDY_CARD_GENERATOR_REASONING_EFFORT = 'medium';

function getStudyCardGeneratorProvider(): LlmProvider {
  const configured = (
    process.env.STUDY_CARD_GENERATOR_PROVIDER ??
    process.env.LLM_PROVIDER ??
    DEFAULT_STUDY_CARD_GENERATOR_PROVIDER
  ).toLowerCase();

  if (configured === 'gemini') return 'gemini';
  if (configured === 'openai') return 'openai';

  throw new AppError(
    `Unsupported study card generator provider "${configured}". Use "openai" or "gemini".`,
    500
  );
}

async function generateStudyCardCandidatesWithOpenAI(
  prompt: string,
  systemInstruction: string
): Promise<string> {
  const model = process.env.STUDY_CARD_GENERATOR_MODEL ?? DEFAULT_STUDY_CARD_GENERATOR_MODEL;
  const reasoningEffort =
    process.env.STUDY_CARD_GENERATOR_REASONING_EFFORT ??
    DEFAULT_STUDY_CARD_GENERATOR_REASONING_EFFORT;

  return generateOpenAIResponseText({ prompt, systemInstruction, model, reasoningEffort });
}

export async function generateStudyCardCandidateJson(
  prompt: string,
  systemInstruction: string
): Promise<string> {
  const provider = getStudyCardGeneratorProvider();

  if (provider === 'gemini') {
    return generateWithGemini(
      prompt,
      systemInstruction,
      process.env.STUDY_CARD_GENERATOR_MODEL ?? 'gemini-2.5-flash'
    );
  }

  return generateStudyCardCandidatesWithOpenAI(prompt, systemInstruction);
}
