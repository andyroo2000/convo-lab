import { AppError } from '../middleware/errorHandler.js';

import { generateWithGemini } from './geminiClient.js';

type LlmProvider = 'openai' | 'gemini';

const DEFAULT_STUDY_CARD_GENERATOR_PROVIDER: LlmProvider = 'openai';
const DEFAULT_STUDY_CARD_GENERATOR_MODEL = 'gpt-5.5';
const DEFAULT_STUDY_CARD_GENERATOR_REASONING_EFFORT = 'medium';

type OpenAIResponseContent = {
  type?: string;
  text?: string;
};

type OpenAIResponseOutput = {
  type?: string;
  content?: OpenAIResponseContent[];
};

type OpenAIResponsesPayload = {
  output_text?: string;
  output?: OpenAIResponseOutput[];
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
};

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

function getOpenAIOutputText(payload: OpenAIResponsesPayload): string {
  if (typeof payload.output_text === 'string') {
    return payload.output_text;
  }

  for (const output of payload.output ?? []) {
    for (const content of output.content ?? []) {
      if (typeof content.text === 'string') {
        return content.text;
      }
    }
  }

  throw new AppError('OpenAI returned no text for the study card candidates.', 502);
}

function toOpenAIServiceError(status: number, payload: OpenAIResponsesPayload): AppError {
  const message = payload.error?.message ?? 'OpenAI request failed.';
  const lowerMessage = message.toLowerCase();

  if (status === 401 || status === 403 || lowerMessage.includes('api key')) {
    return new AppError(
      process.env.NODE_ENV === 'production'
        ? 'AI generation provider rejected the configured credentials.'
        : 'OpenAI API key was rejected. Update OPENAI_API_KEY and restart the dev server.',
      503
    );
  }

  if (status === 429) {
    return new AppError('OpenAI is rate limiting requests. Please try again shortly.', 429);
  }

  if (status >= 400 && status < 500) {
    return new AppError(`OpenAI rejected the study-card generation request: ${message}`, 502);
  }

  return new AppError('OpenAI failed to generate study card candidates.', 502);
}

async function generateStudyCardCandidatesWithOpenAI(
  prompt: string,
  systemInstruction: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AppError('OPENAI_API_KEY is required for study card generation.', 503);
  }

  const model = process.env.STUDY_CARD_GENERATOR_MODEL ?? DEFAULT_STUDY_CARD_GENERATOR_MODEL;
  const reasoningEffort =
    process.env.STUDY_CARD_GENERATOR_REASONING_EFFORT ??
    DEFAULT_STUDY_CARD_GENERATOR_REASONING_EFFORT;

  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: 'system',
            content: [{ type: 'input_text', text: systemInstruction }],
          },
          {
            role: 'user',
            content: [{ type: 'input_text', text: prompt }],
          },
        ],
        reasoning: {
          effort: reasoningEffort,
        },
        text: {
          format: {
            type: 'json_object',
          },
        },
      }),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('OpenAI request failed:', error);
    throw new AppError('OpenAI failed to generate study card candidates.', 502);
  }

  const payload = (await response.json().catch(() => ({}))) as OpenAIResponsesPayload;

  if (!response.ok) {
    throw toOpenAIServiceError(response.status, payload);
  }

  return getOpenAIOutputText(payload);
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
