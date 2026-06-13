import { getAudioScriptTtsVoices } from '@languageflow/shared/src/voiceSelection.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { generateOpenAIImageBufferMock, sharpMock, webpMock, persistStudyMediaBufferMock } =
  vi.hoisted(() => ({
    generateOpenAIImageBufferMock: vi.fn(),
    sharpMock: vi.fn(),
    webpMock: vi.fn(),
    persistStudyMediaBufferMock: vi.fn(),
  }));

import {
  AUDIO_SCRIPT_SPEEDS,
  buildAudioScriptUnits,
  generateAudioScriptSegmentImages,
} from '../../../services/audioScriptService.js';
import { mockPrisma } from '../../setup.js';

vi.mock('../../../services/openAIClient.js', () => ({
  generateOpenAIImageBuffer: generateOpenAIImageBufferMock,
}));

vi.mock('sharp', () => ({
  default: sharpMock,
}));

vi.mock('../../../services/study/shared.js', () => ({
  deletePersistedStudyMediaByStoragePath: vi.fn(),
  getStudyMediaApiPath: (mediaId: string) => `/api/study/media/${mediaId}`,
  normalizeFilename: (filename: string) => filename.replace(/[^a-zA-Z0-9_-]/g, '-'),
  persistStudyMediaBuffer: persistStudyMediaBufferMock,
  STUDY_GENERATED_IMPORT_JOB_ID: 'generated',
}));

function buildScriptFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'script-1',
    episodeId: 'episode-1',
    status: 'ready',
    imageStatus: 'pending',
    imageErrorMessage: null,
    voiceId: 'ja-JP-Neural2-D',
    voiceProvider: 'google',
    episode: {
      id: 'episode-1',
      userId: 'user-1',
      contentType: 'script',
      sourceText: '日本に住んでいます。',
      targetLanguage: 'ja',
      nativeLanguage: 'en',
      title: 'Japanese Script',
    },
    segments: [
      {
        id: 'segment-1',
        scriptId: 'script-1',
        order: 0,
        text: '日本に住んでいます。',
        reading: '日本[にほん]に住[す]んでいます。',
        translation: 'I live in Japan.',
        imagePrompt: 'A person walking through a Japanese neighborhood.',
        imageStatus: 'pending',
        imageErrorMessage: null,
        imageMediaId: null,
        imageMedia: null,
      },
      {
        id: 'segment-2',
        scriptId: 'script-1',
        order: 1,
        text: '毎日楽しいです。',
        reading: '毎日[まいにち]楽[たの]しいです。',
        translation: 'Every day is fun.',
        imagePrompt: null,
        imageStatus: 'pending',
        imageErrorMessage: null,
        imageMediaId: null,
        imageMedia: null,
      },
    ],
    renders: [],
    ...overrides,
  };
}

describe('audioScriptService', () => {
  beforeEach(() => {
    generateOpenAIImageBufferMock.mockResolvedValue({
      buffer: Buffer.from('fake-png'),
      contentType: 'image/png',
    });
    webpMock.mockReturnValue({ toBuffer: async () => Buffer.from('fake-webp') });
    sharpMock.mockReturnValue({ webp: webpMock });
    persistStudyMediaBufferMock.mockResolvedValue({
      storagePath: 'generated/script.webp',
      publicUrl: 'https://storage.example.com/script.webp',
    });
    mockPrisma.studyMedia.create.mockImplementation(async ({ data }) => ({
      id: `media-${mockPrisma.studyMedia.create.mock.calls.length}`,
      ...data,
    }));
  });

  it('uses the requested Google Neural2 script speeds', () => {
    expect(AUDIO_SCRIPT_SPEEDS.map((speed) => speed.speed)).toEqual(['0.75', '0.85', '1.0']);
    expect(AUDIO_SCRIPT_SPEEDS.map((speed) => speed.numericSpeed)).toEqual([0.75, 0.85, 1.0]);
  });

  it('exposes Google Neural2 voices for script creation while excluding Wavenet, Polly, and Fish', () => {
    const voices = getAudioScriptTtsVoices('ja');

    expect(voices.map((voice) => voice.id)).toEqual(
      expect.arrayContaining(['ja-JP-Neural2-B', 'ja-JP-Neural2-C', 'ja-JP-Neural2-D'])
    );
    expect(voices.every((voice) => voice.provider === 'google')).toBe(true);
    expect(voices.every((voice) => voice.id.includes('-Neural2-'))).toBe(true);
  });

  it('maps reviewed segments to L2 units with pauses for subtitle timing', () => {
    const units = buildAudioScriptUnits({
      voiceId: 'ja-JP-Neural2-D',
      speed: 0.75,
      segments: [
        {
          text: '日本に住んでいます。',
          reading: '日本[にほん]に住[す]んでいます。',
          translation: 'I live in Japan.',
        },
        {
          text: '毎日楽しいです。',
          reading: '毎日[まいにち]楽[たの]しいです。',
          translation: 'Every day is fun.',
        },
      ],
    });

    expect(units).toEqual([
      {
        type: 'L2',
        text: '日本に住んでいます。',
        reading: '日本[にほん]に住[す]んでいます。',
        translation: 'I live in Japan.',
        voiceId: 'ja-JP-Neural2-D',
        speed: 0.75,
      },
      { type: 'pause', seconds: 0.35 },
      {
        type: 'L2',
        text: '毎日楽しいです。',
        reading: '毎日[まいにち]楽[たの]しいです。',
        translation: 'Every day is fun.',
        voiceId: 'ja-JP-Neural2-D',
        speed: 0.75,
      },
    ]);
  });

  it('generates one guarded image per pending script segment', async () => {
    mockPrisma.audioScript.findFirst.mockResolvedValue(buildScriptFixture());
    mockPrisma.audioScriptSegment.findMany.mockResolvedValue([
      { imageStatus: 'ready', imageMediaId: 'media-1' },
      { imageStatus: 'ready', imageMediaId: 'media-2' },
    ]);

    await expect(
      generateAudioScriptSegmentImages({ episodeId: 'episode-1', userId: 'user-1' })
    ).resolves.toEqual({ episodeId: 'episode-1', imageStatus: 'ready' });

    expect(generateOpenAIImageBufferMock).toHaveBeenCalledTimes(2);
    expect(generateOpenAIImageBufferMock).toHaveBeenCalledWith(
      expect.stringContaining('construction paper')
    );
    expect(generateOpenAIImageBufferMock).toHaveBeenCalledWith(expect.stringContaining('No text'));
    expect(generateOpenAIImageBufferMock).toHaveBeenCalledWith(
      expect.stringContaining('Every day is fun.')
    );
    expect(sharpMock).toHaveBeenCalledWith(Buffer.from('fake-png'));
    expect(webpMock).toHaveBeenCalledWith({ quality: 82 });
    expect(mockPrisma.studyMedia.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.audioScriptSegment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'segment-1' },
        data: expect.objectContaining({
          imageStatus: 'ready',
          imageMediaId: expect.stringMatching(/^media-/),
        }),
      })
    );
    expect(mockPrisma.audioScript.update).toHaveBeenLastCalledWith({
      where: { id: 'script-1' },
      data: { imageStatus: 'ready', imageErrorMessage: null },
    });
  });

  it('skips already ready images unless forced', async () => {
    mockPrisma.audioScript.findFirst.mockResolvedValue(
      buildScriptFixture({
        segments: [
          {
            id: 'segment-1',
            text: '日本に住んでいます。',
            translation: 'I live in Japan.',
            imagePrompt: 'A neighborhood.',
            imageStatus: 'ready',
            imageMediaId: 'media-1',
            imageMedia: { id: 'media-1', sourceKind: 'generated', mediaKind: 'image' },
          },
        ],
      })
    );

    await generateAudioScriptSegmentImages({ episodeId: 'episode-1', userId: 'user-1' });

    expect(generateOpenAIImageBufferMock).not.toHaveBeenCalled();
    expect(mockPrisma.audioScript.update).toHaveBeenLastCalledWith({
      where: { id: 'script-1' },
      data: { imageStatus: 'ready', imageErrorMessage: null },
    });
  });

  it('retries failed or missing images without replacing successful segment images', async () => {
    mockPrisma.audioScript.findFirst.mockResolvedValue(
      buildScriptFixture({
        segments: [
          {
            id: 'segment-ready',
            text: '日本に住んでいます。',
            translation: 'I live in Japan.',
            imagePrompt: 'A neighborhood.',
            imageStatus: 'ready',
            imageMediaId: 'media-ready',
            imageMedia: { id: 'media-ready', sourceKind: 'generated', mediaKind: 'image' },
          },
          {
            id: 'segment-failed',
            text: '毎日楽しいです。',
            translation: 'Every day is fun.',
            imagePrompt: 'A happy day.',
            imageStatus: 'error',
            imageMediaId: null,
            imageMedia: null,
          },
        ],
      })
    );
    mockPrisma.audioScriptSegment.findMany.mockResolvedValue([
      { imageStatus: 'ready', imageMediaId: 'media-ready' },
      { imageStatus: 'ready', imageMediaId: 'media-retry' },
    ]);

    await generateAudioScriptSegmentImages({ episodeId: 'episode-1', userId: 'user-1' });

    expect(generateOpenAIImageBufferMock).toHaveBeenCalledTimes(1);
    expect(mockPrisma.audioScriptSegment.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'segment-ready' } })
    );
    expect(mockPrisma.audioScriptSegment.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'segment-failed' } })
    );
  });

  it('marks aggregate image status partial when some segment images fail', async () => {
    mockPrisma.audioScript.findFirst.mockResolvedValue(buildScriptFixture());
    generateOpenAIImageBufferMock
      .mockResolvedValueOnce({ buffer: Buffer.from('fake-png'), contentType: 'image/png' })
      .mockRejectedValueOnce(new Error('image model unavailable'));
    mockPrisma.audioScriptSegment.findMany.mockResolvedValue([
      { imageStatus: 'ready', imageMediaId: 'media-1' },
      { imageStatus: 'error', imageMediaId: null },
    ]);

    await generateAudioScriptSegmentImages({ episodeId: 'episode-1', userId: 'user-1' });

    expect(mockPrisma.audioScriptSegment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'segment-2' },
        data: expect.objectContaining({
          imageStatus: 'error',
          imageErrorMessage: 'image model unavailable',
        }),
      })
    );
    expect(mockPrisma.audioScript.update).toHaveBeenLastCalledWith({
      where: { id: 'script-1' },
      data: {
        imageStatus: 'partial',
        imageErrorMessage: '1 script image failed or are missing.',
      },
    });
  });
});
