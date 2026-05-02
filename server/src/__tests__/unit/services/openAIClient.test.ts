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
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0]?.[1]?.body as string)).toMatchObject({
      output_format: 'png',
    });
  });

  it('requests base64 image responses for non-GPT image models', async () => {
    vi.stubEnv('STUDY_CARD_IMAGE_GENERATOR_MODEL', 'dall-e-2');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockJsonResponse(200, {
          data: [{ b64_json: Buffer.from('png-bytes').toString('base64') }],
        })
      )
    );

    await expect(generateOpenAIImageBuffer('A simple cloudy day image.')).resolves.toMatchObject({
      buffer: Buffer.from('png-bytes'),
    });

    expect(JSON.parse(vi.mocked(fetch).mock.calls[0]?.[1]?.body as string)).toMatchObject({
      response_format: 'b64_json',
    });
  });

  it('rejects image responses with an unexpected output format', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockJsonResponse(200, {
          output_format: 'jpeg',
          data: [{ b64_json: Buffer.from('jpeg-bytes').toString('base64') }],
        })
      )
    );

    await expect(generateOpenAIImageBuffer('A cat.')).rejects.toMatchObject({
      message: 'OpenAI returned an unsupported image format.',
      statusCode: 502,
    } satisfies Partial<AppError>);
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

  it('does not surface raw provider messages for non-credential request failures', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockJsonResponse(400, {
          error: { message: 'Unsafe provider detail with prompt contents.' },
        })
      )
    );

    await expect(generateOpenAIImageBuffer('A cat.')).rejects.toMatchObject({
      message: 'AI generation provider rejected the request.',
      statusCode: 502,
    } satisfies Partial<AppError>);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'OpenAI rejected study-card generation request:',
      expect.objectContaining({
        status: 400,
        message: 'Unsafe provider detail with prompt contents.',
      })
    );
  });
});
