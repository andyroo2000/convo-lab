import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../../../middleware/errorHandler.js';
import { generateStudyCardCandidateJson } from '../../../services/llmClient.js';

describe('llmClient', () => {
  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');
    vi.stubEnv('LLM_PROVIDER', 'openai');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ output_text: '{"candidates":[]}' }),
      })
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('uses OpenAI responses and extracts output text', async () => {
    await expect(generateStudyCardCandidateJson('prompt', 'system')).resolves.toBe(
      '{"candidates":[]}'
    );

    expect(fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/responses',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-openai-key',
        }),
        signal: expect.any(AbortSignal),
      })
    );
  });

  it('normalizes OpenAI network failures into an operational provider error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    await expect(generateStudyCardCandidateJson('prompt', 'system')).rejects.toMatchObject({
      message: 'OpenAI failed to generate content.',
      statusCode: 502,
    } satisfies Partial<AppError>);
    expect(consoleErrorSpy).toHaveBeenCalledWith('OpenAI request failed:', expect.any(Error));
  });

  it('ignores legacy provider configuration and keeps using OpenAI', async () => {
    vi.stubEnv('LLM_PROVIDER', 'gemini');

    await expect(generateStudyCardCandidateJson('prompt', 'system')).resolves.toBe(
      '{"candidates":[]}'
    );

    expect(fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/responses',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
