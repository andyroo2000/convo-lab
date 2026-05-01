import { GoogleGenerativeAI } from '@google/generative-ai';

import { AppError } from '../middleware/errorHandler.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface GeminiMessage {
  role: 'user' | 'model';
  parts: string;
}

// Rate limiting: Gemini 2.5 Flash has higher rate limits than 2.0
// Track last request time to enforce gaps between requests
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 3000; // 3 seconds - Gemini 2.5 Flash has higher rate limits

async function waitForRateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS) {
    const waitTime = MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest;
    // eslint-disable-next-line no-console
    console.log(`Rate limiting: waiting ${waitTime}ms before next Gemini call`);
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();
}

function toGeminiServiceError(error: unknown, fallbackMessage: string): AppError {
  const status =
    typeof (error as { status?: unknown })?.status === 'number'
      ? (error as { status: number }).status
      : 500;
  const message = error instanceof Error ? error.message : String(error);

  if (status === 401 || status === 403) {
    return new AppError(
      process.env.NODE_ENV === 'production'
        ? 'AI generation provider rejected the configured credentials.'
        : 'Gemini API key was rejected. Update GEMINI_API_KEY and restart the dev server.',
      503
    );
  }

  if (status === 429) {
    return new AppError('Gemini is rate limiting requests. Please try again shortly.', 429);
  }

  if (message.toLowerCase().includes('api key')) {
    return new AppError(
      process.env.NODE_ENV === 'production'
        ? 'AI generation provider rejected the configured credentials.'
        : 'Gemini API key was rejected. Update GEMINI_API_KEY and restart the dev server.',
      503
    );
  }

  return new AppError(fallbackMessage, 502);
}

export async function generateWithGemini(
  prompt: string,
  systemInstruction?: string,
  model: string = 'gemini-2.5-flash'
): Promise<string> {
  // Wait for rate limit before making request
  await waitForRateLimit();

  try {
    const generativeModel = genAI.getGenerativeModel({
      model,
      systemInstruction,
    });

    const result = await generativeModel.generateContent(prompt);
    const { response } = result;
    return response.text();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Gemini API error:', error);
    throw toGeminiServiceError(error, 'Failed to generate content with Gemini');
  }
}

export async function generateWithGeminiChat(
  messages: GeminiMessage[],
  systemInstruction?: string,
  model: string = 'gemini-2.5-flash'
): Promise<string> {
  try {
    const generativeModel = genAI.getGenerativeModel({
      model,
      systemInstruction,
    });

    const chat = generativeModel.startChat({
      history: messages.map((msg) => ({
        role: msg.role,
        parts: [{ text: msg.parts }],
      })),
    });

    const result = await chat.sendMessage(messages[messages.length - 1].parts);
    return result.response.text();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Gemini chat error:', error);
    throw toGeminiServiceError(error, 'Failed to generate chat response with Gemini');
  }
}

export async function generateImageWithGemini(_prompt: string): Promise<string> {
  // Note: As of now, Gemini doesn't directly generate images in the same way as DALL-E
  // This would integrate with Imagen API or similar
  // For MVP, we'll use Nano Banana or another service
  throw new Error('Image generation not yet implemented');
}
