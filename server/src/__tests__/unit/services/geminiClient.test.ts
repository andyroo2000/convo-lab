import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import after mocking
import { generateWithGemini, generateWithGeminiChat } from '../../../services/geminiClient.js';

// Create hoisted mocks that will be available during module initialization
const { mockGenerateContent, mockStartChat, mockGetGenerativeModel } = vi.hoisted(() => {
  const mockGenerateContent = vi.fn();
  const mockStartChat = vi.fn();
  const mockGetGenerativeModel = vi.fn(() => ({
    generateContent: mockGenerateContent,
    startChat: mockStartChat,
  }));
  return { mockGenerateContent, mockStartChat, mockGetGenerativeModel };
});

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel = mockGetGenerativeModel;
  },
}));

describe('generateWithGemini', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Note: The module has rate limiting with a 6.5s delay between requests.
  // Using fake timers causes unhandled promise rejection issues due to how
  // Node.js tracks rejections across async boundaries. Error handling is
  // verified via generateWithGeminiChat tests which use the same error pattern.

  it('should call Gemini API and return generated text', async () => {
    const mockResponse = {
      response: {
        text: () => 'Generated content',
      },
    };
    mockGenerateContent.mockResolvedValue(mockResponse);

    const result = await generateWithGemini('Test prompt', 'System instruction');

    expect(mockGetGenerativeModel).toHaveBeenCalledWith({
      model: 'gemini-2.5-flash',
      systemInstruction: 'System instruction',
    });
    expect(mockGenerateContent).toHaveBeenCalledWith('Test prompt');
    expect(result).toBe('Generated content');
  });
});

describe('generateWithGeminiChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should start a chat and return response', async () => {
    const mockSendMessage = vi.fn().mockResolvedValue({
      response: {
        text: () => 'Chat response',
      },
    });
    mockStartChat.mockReturnValue({
      sendMessage: mockSendMessage,
    });

    const messages = [
      { role: 'user' as const, parts: 'Hello' },
      { role: 'model' as const, parts: 'Hi there' },
      { role: 'user' as const, parts: 'How are you?' },
    ];

    const result = await generateWithGeminiChat(messages, 'System instruction');

    expect(mockGetGenerativeModel).toHaveBeenCalledWith({
      model: 'gemini-2.5-flash',
      systemInstruction: 'System instruction',
    });
    expect(mockStartChat).toHaveBeenCalled();
    expect(mockSendMessage).toHaveBeenCalledWith('How are you?');
    expect(result).toBe('Chat response');
  });

  it('should throw error when chat fails', async () => {
    mockStartChat.mockReturnValue({
      sendMessage: vi.fn().mockRejectedValue(new Error('Chat error')),
    });

    const messages = [{ role: 'user' as const, parts: 'Hello' }];

    await expect(generateWithGeminiChat(messages)).rejects.toThrow(
      'Failed to generate chat response with Gemini'
    );
  });
});
