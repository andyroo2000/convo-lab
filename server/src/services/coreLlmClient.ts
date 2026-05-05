import { generateOpenAIResponseText } from './openAIClient.js';

const DEFAULT_CORE_GENERATOR_MODEL = 'gpt-5.5';
const DEFAULT_CORE_GENERATOR_REASONING_EFFORT = 'medium';

function getCoreGeneratorModel(): string {
  return (
    process.env.CORE_GENERATOR_MODEL ??
    // Keep core generation aligned with the flashcard model unless explicitly overridden.
    process.env.STUDY_CARD_GENERATOR_MODEL ??
    DEFAULT_CORE_GENERATOR_MODEL
  );
}

function getCoreGeneratorReasoningEffort(): string {
  return (
    process.env.CORE_GENERATOR_REASONING_EFFORT ??
    process.env.STUDY_CARD_GENERATOR_REASONING_EFFORT ??
    DEFAULT_CORE_GENERATOR_REASONING_EFFORT
  );
}

export async function generateCoreLlmText(
  prompt: string,
  systemInstruction: string = 'You are a helpful language-learning content generator.'
): Promise<string> {
  return generateOpenAIResponseText({
    prompt,
    systemInstruction,
    model: getCoreGeneratorModel(),
    reasoningEffort: getCoreGeneratorReasoningEffort(),
    responseFormat: 'text',
  });
}

export async function generateCoreLlmJsonText(
  prompt: string,
  systemInstruction: string = 'You are a helpful language-learning content generator. Return valid JSON only.'
): Promise<string> {
  return generateOpenAIResponseText({
    prompt,
    systemInstruction,
    model: getCoreGeneratorModel(),
    reasoningEffort: getCoreGeneratorReasoningEffort(),
    responseFormat: 'json_object',
  });
}
