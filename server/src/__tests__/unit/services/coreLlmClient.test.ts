import { afterEach, describe, expect, it, vi } from 'vitest';

const { generateOpenAIResponseTextMock } = vi.hoisted(() => ({
  generateOpenAIResponseTextMock: vi.fn(),
}));

vi.unmock('../../../services/coreLlmClient.js');

vi.mock('../../../services/openAIClient.js', () => ({
  generateOpenAIResponseText: generateOpenAIResponseTextMock,
}));

describe('coreLlmClient', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('ignores Gemini flashcard model fallbacks for OpenAI core generation', async () => {
    vi.stubEnv('CORE_GENERATOR_MODEL', '');
    vi.stubEnv('STUDY_CARD_GENERATOR_MODEL', 'gemini-1.5-pro');
    generateOpenAIResponseTextMock.mockResolvedValue('ok');

    const { generateCoreLlmText } = await import('../../../services/coreLlmClient.js');
    await expect(generateCoreLlmText('prompt', 'system')).resolves.toBe('ok');

    expect(generateOpenAIResponseTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5.5',
        responseFormat: 'text',
      })
    );
  });
});
