import { vi } from 'vitest';

// Mock ffprobe function
export const mockFfprobe = vi.fn(
  (filePath: string, callback: (err: Error | null, metadata: any) => void) => {
    callback(null, {
      format: {
        duration: 120, // 120 seconds
      },
    });
  }
);

// Mock ffmpeg fluent interface
export const mockFfmpegOn = vi.fn();
export const mockFfmpegRun = vi.fn();
export const mockFfmpegInput = vi.fn();
export const mockFfmpegInputOptions = vi.fn();
export const mockFfmpegAudioCodec = vi.fn();
export const mockFfmpegAudioBitrate = vi.fn();
export const mockFfmpegAudioFrequency = vi.fn();
export const mockFfmpegAudioChannels = vi.fn();
export const mockFfmpegOutput = vi.fn();

// Create chainable mock
export const createMockFfmpegChain = () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    input: mockFfmpegInput,
    inputOptions: mockFfmpegInputOptions,
    audioCodec: mockFfmpegAudioCodec,
    audioBitrate: mockFfmpegAudioBitrate,
    audioFrequency: mockFfmpegAudioFrequency,
    audioChannels: mockFfmpegAudioChannels,
    output: mockFfmpegOutput,
    on: mockFfmpegOn,
    run: mockFfmpegRun,
  };

  // Make all methods chainable
  Object.keys(chain).forEach((key) => {
    if (key !== 'run') {
      chain[key].mockReturnValue(chain);
    }
  });

  // Make 'on' handler work with callbacks
  mockFfmpegOn.mockImplementation((event: string, callback: () => void) => {
    if (event === 'end') {
      // Immediately call 'end' callback to simulate completion
      setTimeout(() => callback(), 0);
    }
    return chain;
  });

  return chain;
};

// Mock ffmpeg function
export const mockFfmpeg = vi.fn(() => createMockFfmpegChain());
mockFfmpeg.ffprobe = mockFfprobe;
mockFfmpeg.setFfprobePath = vi.fn();
mockFfmpeg.setFfmpegPath = vi.fn();

// Reset all mocks
export const resetFfmpegMocks = () => {
  mockFfprobe.mockClear();
  mockFfmpegOn.mockClear();
  mockFfmpegRun.mockClear();
  mockFfmpegInput.mockClear();
  mockFfmpegInputOptions.mockClear();
  mockFfmpegAudioCodec.mockClear();
  mockFfmpegAudioBitrate.mockClear();
  mockFfmpegAudioFrequency.mockClear();
  mockFfmpegAudioChannels.mockClear();
  mockFfmpegOutput.mockClear();
  mockFfmpeg.mockClear();
};
