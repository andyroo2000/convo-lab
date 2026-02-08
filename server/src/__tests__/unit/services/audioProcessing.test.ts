import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoisted mocks
const mockExecFileAsync = vi.hoisted(() => vi.fn());
const mockFs = vi.hoisted(() => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(Buffer.from('processed-audio')),
  rm: vi.fn().mockResolvedValue(undefined),
  copyFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('child_process', () => ({
  execFile: vi.fn(),
}));

vi.mock('util', () => ({
  promisify: () => mockExecFileAsync,
}));

vi.mock('fs', () => ({
  promises: mockFs,
}));

// Import after mocking
import {
  normalizeSegmentLoudness,
  applySweeteningChain,
  applySweeteningChainToBuffer,
} from '../../../services/audioProcessing.js';

describe('audioProcessing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecFileAsync.mockResolvedValue({ stdout: '', stderr: '' });
    // Reset env vars
    delete process.env.AUDIO_SWEETENING_ENABLED;
    delete process.env.AUDIO_LOUDNORM_ENABLED;
  });

  describe('normalizeSegmentLoudness', () => {
    it('should return input unchanged for empty buffer', async () => {
      const emptyBuffer = Buffer.alloc(0);
      const result = await normalizeSegmentLoudness(emptyBuffer);
      expect(result).toBe(emptyBuffer);
      expect(mockExecFileAsync).not.toHaveBeenCalled();
    });

    it('should call ffmpeg with loudnorm filter', async () => {
      const input = Buffer.from('test-audio');
      await normalizeSegmentLoudness(input);

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        'ffmpeg',
        expect.arrayContaining([
          '-af',
          expect.stringContaining('loudnorm=I=-16'),
          '-ar',
          '44100',
          '-ac',
          '2',
          '-c:a',
          'libmp3lame',
          '-b:a',
          '128k',
        ])
      );
    });

    it('should write input to temp file and read output', async () => {
      const input = Buffer.from('test-audio');
      const result = await normalizeSegmentLoudness(input);

      expect(mockFs.writeFile).toHaveBeenCalledWith(expect.stringContaining('input.mp3'), input);
      expect(mockFs.readFile).toHaveBeenCalledWith(expect.stringContaining('output.mp3'));
      expect(result).toEqual(Buffer.from('processed-audio'));
    });

    it('should clean up temp directory', async () => {
      await normalizeSegmentLoudness(Buffer.from('test'));
      expect(mockFs.rm).toHaveBeenCalledWith(expect.stringContaining('audio-norm'), {
        recursive: true,
        force: true,
      });
    });

    it('should clean up temp directory on error', async () => {
      mockExecFileAsync.mockRejectedValue(new Error('ffmpeg failed'));
      await expect(normalizeSegmentLoudness(Buffer.from('test'))).rejects.toThrow(
        /Loudness normalization failed/
      );
      expect(mockFs.rm).toHaveBeenCalledWith(expect.stringContaining('audio-norm'), {
        recursive: true,
        force: true,
      });
    });

    it('should include context in error message on failure', async () => {
      mockExecFileAsync.mockRejectedValue(new Error('ffmpeg failed'));
      await expect(normalizeSegmentLoudness(Buffer.from('test'))).rejects.toThrow(
        /inputSize: 4 bytes.*ffmpeg failed/
      );
    });
  });

  describe('applySweeteningChain', () => {
    it('should call ffmpeg with full filter chain in correct order', async () => {
      await applySweeteningChain('/tmp/input.mp3', '/tmp/output.mp3');

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        'ffmpeg',
        expect.arrayContaining(['-af', expect.any(String)])
      );

      const args = mockExecFileAsync.mock.calls[0][1] as string[];
      const filterIdx = args.indexOf('-af');
      const filter = args[filterIdx + 1];

      // Verify filter chain order
      const parts = filter.split(',');
      expect(parts[0]).toMatch(/^highpass/);
      expect(parts[1]).toMatch(/^acompressor/);
      expect(parts[2]).toMatch(/^equalizer/);
      expect(parts[3]).toMatch(/^loudnorm/);
    });

    it('should include context in error message on failure', async () => {
      mockExecFileAsync.mockRejectedValue(new Error('ffmpeg crashed'));
      await expect(applySweeteningChain('/tmp/input.mp3', '/tmp/output.mp3')).rejects.toThrow(
        /Sweetening chain failed.*input:.*input\.mp3.*ffmpeg crashed/
      );
    });

    it('should copy file when sweetening is disabled', async () => {
      process.env.AUDIO_SWEETENING_ENABLED = '0';

      // Re-import to pick up env change
      vi.resetModules();
      const { applySweeteningChain: freshFn } =
        await import('../../../services/audioProcessing.js');

      await freshFn('/tmp/input.mp3', '/tmp/output.mp3');

      expect(mockFs.copyFile).toHaveBeenCalledWith('/tmp/input.mp3', '/tmp/output.mp3');
      expect(mockExecFileAsync).not.toHaveBeenCalled();
    });
  });

  describe('environment variable validation', () => {
    it('should fall back to default when env var is invalid (NaN)', async () => {
      process.env.AUDIO_LOUDNORM_TARGET_IL = 'invalid';
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      vi.resetModules();
      const { normalizeSegmentLoudness: freshFn } =
        await import('../../../services/audioProcessing.js');

      await freshFn(Buffer.from('test-audio'));

      // Should warn about invalid value
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid env value "invalid"'));

      // Should still use default -16 in the filter
      const args = mockExecFileAsync.mock.calls[0][1] as string[];
      const filterIdx = args.indexOf('-af');
      const filter = args[filterIdx + 1];
      expect(filter).toContain('I=-16');

      warnSpy.mockRestore();
      delete process.env.AUDIO_LOUDNORM_TARGET_IL;
    });

    it('should use valid env var value when provided', async () => {
      process.env.AUDIO_LOUDNORM_TARGET_IL = '-20';

      vi.resetModules();
      const { normalizeSegmentLoudness: freshFn } =
        await import('../../../services/audioProcessing.js');

      await freshFn(Buffer.from('test-audio'));

      const args = mockExecFileAsync.mock.calls[0][1] as string[];
      const filterIdx = args.indexOf('-af');
      const filter = args[filterIdx + 1];
      expect(filter).toContain('I=-20');

      delete process.env.AUDIO_LOUDNORM_TARGET_IL;
    });
  });

  describe('applySweeteningChainToBuffer', () => {
    it('should write buffer to temp file, process, and return result', async () => {
      const input = Buffer.from('test-audio');
      const result = await applySweeteningChainToBuffer(input);

      expect(mockFs.writeFile).toHaveBeenCalledWith(expect.stringContaining('input.mp3'), input);
      expect(mockExecFileAsync).toHaveBeenCalled();
      expect(result).toEqual(Buffer.from('processed-audio'));
    });

    it('should clean up temp directory', async () => {
      await applySweeteningChainToBuffer(Buffer.from('test'));
      expect(mockFs.rm).toHaveBeenCalledWith(expect.stringContaining('audio-sweeten'), {
        recursive: true,
        force: true,
      });
    });
  });
});
