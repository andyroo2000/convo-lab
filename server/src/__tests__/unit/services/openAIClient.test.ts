import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../../../middleware/errorHandler.js';
import {
  generateOpenAIImageBuffer,
  generateOpenAIResponseText,
} from '../../../services/openAIClient.js';

function mockJsonResponse(status: number, payload: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

describe('openAIClient', () => {
  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');
    vi.stubEnv('NODE_ENV', 'development');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('generates image buffers from the OpenAI Images API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockJsonResponse(200, {
          data: [{ b64_json: Buffer.from('png-bytes').toString('base64') }],
        })
      )
    );

    await expect(generateOpenAIImageBuffer('A simple cloudy day image.')).resolves.toEqual({
      buffer: Buffer.from('png-bytes'),
      contentType: 'image/png',
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/images/generations',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-openai-key',
        }),
        body: expect.stringContaining('"prompt":"A simple cloudy day image."'),
      })
    );
  });

  it('requires an API key before making provider requests', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      generateOpenAIResponseText({
        prompt: 'prompt',
        systemInstruction: 'system',
        model: 'gpt-5.5',
        reasoningEffort: 'medium',
      })
    ).rejects.toMatchObject({
      message: 'OPENAI_API_KEY is required for study card generation.',
      statusCode: 503,
    } satisfies Partial<AppError>);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps rejected credentials to a configuration error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockJsonResponse(401, {
          error: { message: 'Incorrect API key provided.' },
        })
      )
    );

    await expect(generateOpenAIImageBuffer('A cat.')).rejects.toMatchObject({
      message: 'OpenAI API key was rejected. Update OPENAI_API_KEY and restart the dev server.',
      statusCode: 503,
    } satisfies Partial<AppError>);
  });

  it('normalizes provider timeouts into operational errors', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('timeout', 'TimeoutError')));

    await expect(generateOpenAIImageBuffer('A cat.')).rejects.toMatchObject({
      message: 'OpenAI failed to generate content.',
      statusCode: 502,
    } satisfies Partial<AppError>);
    expect(consoleErrorSpy).toHaveBeenCalledWith('OpenAI request failed:', expect.any(Error));
  });
});
