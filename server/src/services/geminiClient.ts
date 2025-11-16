import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface GeminiMessage {
  role: 'user' | 'model';
  parts: string;
}

// Rate limiting: Gemini 2.5 Flash has higher rate limits than 2.0
// Track last request time to enforce gaps between requests
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 6500; // 6.5 seconds to be safe

async function waitForRateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS) {
    const waitTime = MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest;
    console.log(`Rate limiting: waiting ${waitTime}ms before next Gemini call`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();
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
    const response = result.response;
    return response.text();
  } catch (error) {
    console.error('Gemini API error:', error);
    throw new Error('Failed to generate content with Gemini');
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
      history: messages.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.parts }],
      })),
    });

    const result = await chat.sendMessage(messages[messages.length - 1].parts);
    return result.response.text();
  } catch (error) {
    console.error('Gemini chat error:', error);
    throw new Error('Failed to generate chat response with Gemini');
  }
}

export async function generateImageWithGemini(prompt: string): Promise<string> {
  // Note: As of now, Gemini doesn't directly generate images in the same way as DALL-E
  // This would integrate with Imagen API or similar
  // For MVP, we'll use Nano Banana or another service
  throw new Error('Image generation not yet implemented');
}
