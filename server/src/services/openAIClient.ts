import { AppError } from '../middleware/errorHandler.js';

const OPENAI_RESPONSES_TIMEOUT_MS = 60_000;
const OPENAI_IMAGES_TIMEOUT_MS = 45_000;
const DEFAULT_OPENAI_IMAGE_MODEL = 'gpt-image-1';
const DEFAULT_OPENAI_IMAGE_SIZE = '1024x1024';
const DEFAULT_OPENAI_IMAGE_QUALITY = 'medium';
const DEFAULT_OPENAI_IMAGE_OUTPUT_FORMAT = 'png';

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

type OpenAIImagePayload = {
  data?: Array<{
    b64_json?: string;
    url?: string;
  }>;
  output_format?: string;
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
};

function isGptImageModel(model: string): boolean {
  return model.startsWith('gpt-image-');
}

function contentTypeForOpenAIImageFormat(value: unknown): string {
  if (typeof value === 'undefined' || value === null || value === 'png') {
    return 'image/png';
  }
  if (value === 'webp') {
    return 'image/webp';
  }
  if (value === 'jpeg') {
    return 'image/jpeg';
  }

  throw new AppError('OpenAI returned an unsupported image format.', 502);
}

function getOpenAIApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AppError('OPENAI_API_KEY is required for study card generation.', 503);
  }

  return apiKey;
}

function toOpenAIServiceError(status: number, payload: { error?: { message?: string } }): AppError {
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
    // eslint-disable-next-line no-console
    console.warn('OpenAI rejected study-card generation request:', {
      status,
      message,
    });
    return new AppError('AI generation provider rejected the request.', 502);
  }

  return new AppError('OpenAI failed to generate content.', 502);
}

async function postOpenAIJson<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  const apiKey = getOpenAIApiKey();
  let response: Response;
  try {
    response = await fetch(`https://api.openai.com/v1/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify(body),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('OpenAI request failed:', error);
    throw new AppError('OpenAI failed to generate content.', 502);
  }

  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: { message?: string };
  };
  if (!response.ok) {
    throw toOpenAIServiceError(response.status, payload);
  }

  return payload;
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

export async function generateOpenAIResponseText(input: {
  prompt: string;
  systemInstruction: string;
  model: string;
  reasoningEffort: string;
  responseFormat?: 'json_object' | 'text';
}): Promise<string> {
  const responseFormat = input.responseFormat ?? 'json_object';
  const payload = await postOpenAIJson<OpenAIResponsesPayload>(
    'responses',
    {
      model: input.model,
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: input.systemInstruction }],
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: input.prompt }],
        },
      ],
      reasoning: {
        effort: input.reasoningEffort,
      },
      text: {
        format: {
          type: responseFormat,
        },
      },
    },
    OPENAI_RESPONSES_TIMEOUT_MS
  );

  return getOpenAIOutputText(payload);
}

export async function generateOpenAIImageBuffer(prompt: string): Promise<{
  buffer: Buffer;
  contentType: string;
}> {
  const model = process.env.STUDY_CARD_IMAGE_GENERATOR_MODEL ?? DEFAULT_OPENAI_IMAGE_MODEL;
  const imageRequest: Record<string, unknown> = {
    model,
    prompt,
    n: 1,
    size: DEFAULT_OPENAI_IMAGE_SIZE,
    quality: DEFAULT_OPENAI_IMAGE_QUALITY,
  };

  if (isGptImageModel(model)) {
    imageRequest.output_format = DEFAULT_OPENAI_IMAGE_OUTPUT_FORMAT;
  } else {
    imageRequest.response_format = 'b64_json';
  }

  const payload = await postOpenAIJson<OpenAIImagePayload>(
    'images/generations',
    imageRequest,
    OPENAI_IMAGES_TIMEOUT_MS
  );

  const contentType = contentTypeForOpenAIImageFormat(payload.output_format);

  const b64Json = payload.data?.[0]?.b64_json;
  if (!b64Json) {
    throw new AppError('OpenAI returned no image for the study card candidate.', 502);
  }

  return {
    buffer: Buffer.from(b64Json, 'base64'),
    contentType,
  };
}
