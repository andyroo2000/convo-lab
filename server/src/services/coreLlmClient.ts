import { generateOpenAIResponseText } from './openAIClient.js';

// ConvoLab is configured for OpenAI gpt-5.5 access; override CORE_GENERATOR_MODEL if unavailable.
const DEFAULT_CORE_GENERATOR_MODEL = 'gpt-5.5';
const DEFAULT_CORE_GENERATOR_REASONING_EFFORT = 'medium';

function isOpenAICompatibleModel(model: string): boolean {
  return !model.toLowerCase().includes('gemini');
}

function getCoreGeneratorModel(): string {
  if (process.env.CORE_GENERATOR_MODEL) {
    return process.env.CORE_GENERATOR_MODEL;
  }

  const flashcardModel = process.env.STUDY_CARD_GENERATOR_MODEL;
  // Keep core generation aligned with the flashcard model only when it is an OpenAI model id.
  if (flashcardModel && isOpenAICompatibleModel(flashcardModel)) {
    return flashcardModel;
  }

  return DEFAULT_CORE_GENERATOR_MODEL;
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
