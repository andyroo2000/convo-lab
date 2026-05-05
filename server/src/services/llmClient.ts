import { generateOpenAIResponseText } from './openAIClient.js';

const DEFAULT_STUDY_CARD_GENERATOR_MODEL = 'gpt-5.5';
const DEFAULT_STUDY_CARD_GENERATOR_REASONING_EFFORT = 'medium';

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
  return generateStudyCardCandidatesWithOpenAI(prompt, systemInstruction);
}
