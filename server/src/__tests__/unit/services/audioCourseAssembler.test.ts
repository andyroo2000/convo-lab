import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import after mocking
import { assembleLessonAudio } from '../../../services/audioCourseAssembler.js';

// Hoisted mocks
const mockUploadFileToGCS = vi.hoisted(() => vi.fn());
const mockProcessBatches = vi.hoisted(() => vi.fn());
const mockFfprobe = vi.hoisted(() => vi.fn());
const mockFfmpegChain = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};

  // Create all chain methods
  [
    'input',
    'inputOptions',
    'audioCodec',
    'audioBitrate',
    'audioFrequency',
    'audioChannels',
    'output',
    'on',
    'run',
  ].forEach((method) => {
    chain[method] = vi.fn();
    if (method !== 'run') {
      chain[method].mockReturnValue(chain);
    }
  });

  // Make 'on' call the callback immediately for 'end' event
  chain.on.mockImplementation((event: string, callback: () => void) => {
    if (event === 'end') {
      setTimeout(() => callback(), 0);
    }
    return chain;
  });

  return chain;
});
const mockFfmpeg = vi.hoisted(() => {
  const fn = vi.fn(() => mockFfmpegChain);
  fn.ffprobe = mockFfprobe;
  fn.setFfprobePath = vi.fn();
  fn.setFfmpegPath = vi.fn();
  return fn;
});

const mockFs = vi.hoisted(() => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  rm: vi.fn(),
}));

// Mock dependencies
vi.mock('../../../services/storageClient.js', () => ({
  uploadFileToGCS: mockUploadFileToGCS,
}));

vi.mock('../../../services/batchedTTSClient.js', () => ({
  processBatches: mockProcessBatches,
}));

vi.mock('fluent-ffmpeg', () => ({
  default: mockFfmpeg,
}));

vi.mock('fs', () => ({
  promises: mockFs,
}));

vi.mock('child_process', () => ({
  execSync: vi.fn(() => '/usr/bin/ffmpeg'),
}));

describe('audioCourseAssembler', () => {
  const mockScriptUnits = [
    { type: 'intro', text: 'Welcome', voiceId: 'en-US-Neural2-D' },
    { type: 'l2', text: 'こんにちは', voiceId: 'ja-JP-Neural2-B' },
    { type: 'pause', seconds: 1 },
    { type: 'marker', label: 'Section 1' },
    { type: 'narration', text: 'Now repeat', voiceId: 'en-US-Neural2-D' },
  ];

  const mockBatchResult = {
    segments: new Map([
      [0, Buffer.from('intro-audio')],
      [1, Buffer.from('l2-audio')],
      [4, Buffer.from('narration-audio')],
    ]),
    pauseSegments: new Map([[2, Buffer.from('pause-audio')]]),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.rm.mockResolvedValue(undefined);
    mockProcessBatches.mockResolvedValue(mockBatchResult);
    mockUploadFileToGCS.mockResolvedValue('https://storage.example.com/lesson-123.mp3');
    mockFfprobe.mockImplementation((filePath, callback) => {
      callback(null, { format: { duration: 120 } });
    });
  });

  describe('assembleLessonAudio', () => {
    it('should create temp directory for audio segments', async () => {
      await assembleLessonAudio({
        lessonId: 'lesson-123',
        scriptUnits: mockScriptUnits,
        targetLanguage: 'ja',
        nativeLanguage: 'en',
      });

      expect(mockFs.mkdir).toHaveBeenCalledWith(expect.stringContaining('audio-assembly'), {
        recursive: true,
      });
    });

    it('should call processBatches with script units', async () => {
      await assembleLessonAudio({
        lessonId: 'lesson-123',
        scriptUnits: mockScriptUnits,
        targetLanguage: 'ja',
        nativeLanguage: 'en',
      });

      expect(mockProcessBatches).toHaveBeenCalledWith(
        mockScriptUnits,
        expect.objectContaining({
          targetLanguage: 'ja',
          nativeLanguage: 'en',
        })
      );
    });

    it('should skip marker units - they produce no audio', async () => {
      await assembleLessonAudio({
        lessonId: 'lesson-123',
        scriptUnits: mockScriptUnits,
        targetLanguage: 'ja',
        nativeLanguage: 'en',
      });

      // 5 units total, 1 marker, so 4 audio files written (if segments exist)
      const writeFileCalls = mockFs.writeFile.mock.calls;
      const audioFilesWritten = writeFileCalls.filter(
        (call) => typeof call[0] === 'string' && call[0].includes('segment-')
      );

      // Should write files for segments that have buffers (indices 0, 1, 4 for speech, 2 for pause)
      expect(audioFilesWritten.length).toBe(4);
    });

    it('should write pause segments from batchResult.pauseSegments', async () => {
      await assembleLessonAudio({
        lessonId: 'lesson-123',
        scriptUnits: mockScriptUnits,
        targetLanguage: 'ja',
        nativeLanguage: 'en',
      });

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('segment-2.mp3'),
        Buffer.from('pause-audio')
      );
    });

    it('should write speech segments from batchResult.segments', async () => {
      await assembleLessonAudio({
        lessonId: 'lesson-123',
        scriptUnits: mockScriptUnits,
        targetLanguage: 'ja',
        nativeLanguage: 'en',
      });

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('segment-0.mp3'),
        Buffer.from('intro-audio')
      );

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('segment-1.mp3'),
        Buffer.from('l2-audio')
      );
    });

    it('should get audio duration using ffprobe', async () => {
      await assembleLessonAudio({
        lessonId: 'lesson-123',
        scriptUnits: mockScriptUnits,
        targetLanguage: 'ja',
        nativeLanguage: 'en',
      });

      expect(mockFfprobe).toHaveBeenCalled();
    });

    it('should upload final audio to GCS', async () => {
      await assembleLessonAudio({
        lessonId: 'lesson-123',
        scriptUnits: mockScriptUnits,
        targetLanguage: 'ja',
        nativeLanguage: 'en',
      });

      expect(mockUploadFileToGCS).toHaveBeenCalledWith({
        filePath: expect.any(String),
        filename: 'lesson-lesson-123.mp3',
        contentType: 'audio/mpeg',
        folder: 'courses',
      });
    });

    it('should return audioUrl and actualDurationSeconds', async () => {
      const result = await assembleLessonAudio({
        lessonId: 'lesson-123',
        scriptUnits: mockScriptUnits,
        targetLanguage: 'ja',
        nativeLanguage: 'en',
      });

      expect(result).toEqual({
        audioUrl: 'https://storage.example.com/lesson-123.mp3',
        actualDurationSeconds: 120,
      });
    });

    it('should cleanup temp directory on success', async () => {
      await assembleLessonAudio({
        lessonId: 'lesson-123',
        scriptUnits: mockScriptUnits,
        targetLanguage: 'ja',
        nativeLanguage: 'en',
      });

      expect(mockFs.rm).toHaveBeenCalledWith(expect.stringContaining('audio-assembly'), {
        recursive: true,
        force: true,
      });
    });

    it('should cleanup temp directory on error', async () => {
      mockProcessBatches.mockRejectedValue(new Error('TTS failed'));

      await expect(
        assembleLessonAudio({
          lessonId: 'lesson-123',
          scriptUnits: mockScriptUnits,
          targetLanguage: 'ja',
          nativeLanguage: 'en',
        })
      ).rejects.toThrow('TTS failed');

      expect(mockFs.rm).toHaveBeenCalledWith(expect.stringContaining('audio-assembly'), {
        recursive: true,
        force: true,
      });
    });

    it('should call onProgress callback during processing', async () => {
      const onProgress = vi.fn();

      // Make processBatches call the onProgress callback
      mockProcessBatches.mockImplementation((units, options) => {
        if (options.onProgress) {
          options.onProgress(1, 2);
          options.onProgress(2, 2);
        }
        return Promise.resolve(mockBatchResult);
      });

      await assembleLessonAudio({
        lessonId: 'lesson-123',
        scriptUnits: mockScriptUnits,
        targetLanguage: 'ja',
        nativeLanguage: 'en',
        onProgress,
      });

      expect(onProgress).toHaveBeenCalled();
    });

    it('should handle single audio file without concatenation', async () => {
      const singleUnit = [{ type: 'intro', text: 'Hello', voiceId: 'en-US' }];
      mockProcessBatches.mockResolvedValue({
        segments: new Map([[0, Buffer.from('single-audio')]]),
        pauseSegments: new Map(),
      });

      await assembleLessonAudio({
        lessonId: 'lesson-123',
        scriptUnits: singleUnit,
        targetLanguage: 'ja',
        nativeLanguage: 'en',
      });

      // For single file, ffmpeg concat should not be needed
      // (the implementation returns early for single file)
      expect(mockUploadFileToGCS).toHaveBeenCalled();
    });

    it('should throw error if no audio files to concatenate', async () => {
      // Empty batch result means no audio to concatenate
      mockProcessBatches.mockResolvedValue({
        segments: new Map(),
        pauseSegments: new Map(),
      });

      // All units are markers - produce no audio
      const markerOnlyUnits = [
        { type: 'marker', label: 'Start' },
        { type: 'marker', label: 'End' },
      ];

      await expect(
        assembleLessonAudio({
          lessonId: 'lesson-123',
          scriptUnits: markerOnlyUnits,
          targetLanguage: 'ja',
          nativeLanguage: 'en',
        })
      ).rejects.toThrow('No audio files to concatenate');
    });
  });
});
