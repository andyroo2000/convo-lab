import { describe, it, expect, vi, beforeEach } from 'vitest';

import { extractVocabularyAudio } from '../../../services/audioExtractorService.js';
import {
  mockCourseCoreItem,
  mockCourseWithTimingData,
  mockLegacyCourseCoreItem,
} from '../../fixtures/timingData.js';
import { mockPrisma } from '../../setup.js';

// Hoisted mocks
const { mockFetch, mockWriteFile, mockUnlink, mockExecAsync, mockUpload, mockMakePublic } =
  vi.hoisted(() => ({
    mockFetch: vi.fn(),
    mockWriteFile: vi.fn(),
    mockUnlink: vi.fn(),
    mockExecAsync: vi.fn(),
    mockUpload: vi.fn(),
    mockMakePublic: vi.fn(),
  }));

// Mock external dependencies
global.fetch = mockFetch;

vi.mock('child_process', () => ({
  exec: vi.fn((cmd, callback) => {
    mockExecAsync(cmd)
      .then(() => callback(null, { stdout: '', stderr: '' }))
      .catch((err: unknown) => callback(err));
  }),
}));

vi.mock('util', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  promisify: (_fn: any) => mockExecAsync,
}));

vi.mock('fs/promises', () => ({
  default: {
    writeFile: mockWriteFile,
    unlink: mockUnlink,
  },
}));

vi.mock('@google-cloud/storage', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Storage: vi.fn(function (this: any) {
    this.bucket = vi.fn(() => ({
      upload: mockUpload,
      file: vi.fn(() => ({
        makePublic: mockMakePublic,
      })),
    }));
    return this;
  }),
}));

describe('audioExtractorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default successful mocks
    mockFetch.mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
    });
    mockWriteFile.mockResolvedValue(undefined);
    mockUnlink.mockResolvedValue(undefined);
    mockExecAsync.mockResolvedValue({ stdout: '', stderr: '' });
    mockUpload.mockResolvedValue(undefined);
    mockMakePublic.mockResolvedValue(undefined);
  });

  describe('extractVocabularyAudio()', () => {
    describe('Success Cases', () => {
      it('should extract audio using sourceUnitIndex and timing data', async () => {
        mockPrisma.courseCoreItem.findUnique.mockResolvedValue(mockCourseCoreItem);

        const result = await extractVocabularyAudio('item-123');

        expect(mockPrisma.courseCoreItem.findUnique).toHaveBeenCalledWith({
          where: { id: 'item-123' },
          include: {
            course: {
              select: {
                id: true,
                audioUrl: true,
                scriptJson: true,
                timingData: true,
              },
            },
          },
        });

        expect(result).toBe(
          'https://storage.googleapis.com/languageflow-audio/vocabulary/vocab_item-123.mp3'
        );
      });

      it('should use correct timing data for sourceUnitIndex', async () => {
        const coreItemWithIndex = {
          ...mockCourseCoreItem,
          sourceUnitIndex: 1,
        };

        mockPrisma.courseCoreItem.findUnique.mockResolvedValue(coreItemWithIndex);

        await extractVocabularyAudio('item-123');

        // Verify ffmpeg was called with correct timing (unit index 1: 2000ms-4500ms)
        expect(mockExecAsync).toHaveBeenCalled();
        const ffmpegCommand = mockExecAsync.mock.calls[0][0];
        expect(ffmpegCommand).toContain('-ss 2'); // 2000ms / 1000 = 2 seconds
        expect(ffmpegCommand).toContain('-t 2.5'); // (4500-2000) / 1000 = 2.5 seconds
      });

      it('should download source audio from URL', async () => {
        mockPrisma.courseCoreItem.findUnique.mockResolvedValue(mockCourseCoreItem);

        await extractVocabularyAudio('item-123');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://storage.googleapis.com/test-bucket/course-123.mp3'
        );
      });

      it('should call ffmpeg with correct parameters', async () => {
        mockPrisma.courseCoreItem.findUnique.mockResolvedValue(mockCourseCoreItem);

        await extractVocabularyAudio('item-123');

        expect(mockExecAsync).toHaveBeenCalled();
        const command = mockExecAsync.mock.calls[0][0];
        expect(command).toContain('ffmpeg');
        expect(command).toContain('-i');
        expect(command).toContain('-ss'); // start time
        expect(command).toContain('-t'); // duration
        expect(command).toContain('-c:a libmp3lame'); // mp3 codec
      });

      it('should upload extracted segment to GCS', async () => {
        mockPrisma.courseCoreItem.findUnique.mockResolvedValue(mockCourseCoreItem);

        await extractVocabularyAudio('item-123');

        expect(mockUpload).toHaveBeenCalled();
        const uploadCall = mockUpload.mock.calls[0];
        expect(uploadCall[0]).toContain('vocab_item-123'); // temp file path
        expect(uploadCall[1]).toEqual(
          expect.objectContaining({
            destination: 'vocabulary/vocab_item-123.mp3',
            metadata: expect.objectContaining({
              contentType: 'audio/mpeg',
            }),
          })
        );
      });

      it('should make GCS file public', async () => {
        mockPrisma.courseCoreItem.findUnique.mockResolvedValue(mockCourseCoreItem);

        await extractVocabularyAudio('item-123');

        expect(mockMakePublic).toHaveBeenCalled();
      });

      it('should return correct public URL format', async () => {
        mockPrisma.courseCoreItem.findUnique.mockResolvedValue(mockCourseCoreItem);

        const result = await extractVocabularyAudio('item-123');

        expect(result).toBe(
          'https://storage.googleapis.com/languageflow-audio/vocabulary/vocab_item-123.mp3'
        );
      });
    });

    describe('Fallback Cases - Return Null', () => {
      it('should return null when core item not found', async () => {
        mockPrisma.courseCoreItem.findUnique.mockResolvedValue(null);

        const result = await extractVocabularyAudio('non-existent');

        expect(result).toBeNull();
        expect(mockFetch).not.toHaveBeenCalled();
      });

      it('should return null when course not found', async () => {
        mockPrisma.courseCoreItem.findUnique.mockResolvedValue({
          ...mockCourseCoreItem,
          course: null,
        });

        const result = await extractVocabularyAudio('item-123');

        expect(result).toBeNull();
      });

      it('should return null when audioUrl missing', async () => {
        mockPrisma.courseCoreItem.findUnique.mockResolvedValue({
          ...mockCourseCoreItem,
          course: {
            ...mockCourseWithTimingData,
            audioUrl: null,
          },
        });

        const result = await extractVocabularyAudio('item-123');

        expect(result).toBeNull();
      });

      it('should return null when scriptJson missing', async () => {
        mockPrisma.courseCoreItem.findUnique.mockResolvedValue({
          ...mockCourseCoreItem,
          course: {
            ...mockCourseWithTimingData,
            scriptJson: null,
          },
        });

        const result = await extractVocabularyAudio('item-123');

        expect(result).toBeNull();
      });

      it('should return null when timingData missing', async () => {
        mockPrisma.courseCoreItem.findUnique.mockResolvedValue({
          ...mockCourseCoreItem,
          course: {
            ...mockCourseWithTimingData,
            timingData: null,
          },
        });

        const result = await extractVocabularyAudio('item-123');

        expect(result).toBeNull();
      });

      it('should return null when sourceUnitIndex is null (legacy items)', async () => {
        mockPrisma.courseCoreItem.findUnique.mockResolvedValue(mockLegacyCourseCoreItem);

        const result = await extractVocabularyAudio('item-legacy');

        expect(result).toBeNull();
        expect(mockFetch).not.toHaveBeenCalled();
      });

      it('should return null when sourceUnitIndex out of bounds', async () => {
        mockPrisma.courseCoreItem.findUnique.mockResolvedValue({
          ...mockCourseCoreItem,
          sourceUnitIndex: 999, // Out of bounds
        });

        const result = await extractVocabularyAudio('item-123');

        expect(result).toBeNull();
      });

      it('should return null when timing data missing for unit index', async () => {
        mockPrisma.courseCoreItem.findUnique.mockResolvedValue({
          ...mockCourseCoreItem,
          sourceUnitIndex: 1,
          course: {
            ...mockCourseWithTimingData,
            timingData: [
              // Missing timing for index 1
              { unitIndex: 0, startTime: 0, endTime: 2000 },
              { unitIndex: 2, startTime: 4500, endTime: 7000 },
            ],
          },
        });

        const result = await extractVocabularyAudio('item-123');

        expect(result).toBeNull();
      });
    });

    describe('Error Handling', () => {
      it('should handle fetch errors and return null', async () => {
        mockPrisma.courseCoreItem.findUnique.mockResolvedValue(mockCourseCoreItem);
        mockFetch.mockRejectedValue(new Error('Network error'));

        const result = await extractVocabularyAudio('item-123');

        expect(result).toBeNull();
      });

      it('should handle ffmpeg errors and return null', async () => {
        mockPrisma.courseCoreItem.findUnique.mockResolvedValue(mockCourseCoreItem);
        mockExecAsync.mockRejectedValue(new Error('FFmpeg failed'));

        const result = await extractVocabularyAudio('item-123');

        expect(result).toBeNull();
      });

      it('should handle GCS upload errors and return null', async () => {
        mockPrisma.courseCoreItem.findUnique.mockResolvedValue(mockCourseCoreItem);
        mockUpload.mockRejectedValue(new Error('Upload failed'));

        const result = await extractVocabularyAudio('item-123');

        expect(result).toBeNull();
      });

      it('should clean up temp files on success', async () => {
        mockPrisma.courseCoreItem.findUnique.mockResolvedValue(mockCourseCoreItem);

        await extractVocabularyAudio('item-123');

        expect(mockUnlink).toHaveBeenCalledTimes(2); // input and output temp files
      });

      it('should clean up temp files on error', async () => {
        mockPrisma.courseCoreItem.findUnique.mockResolvedValue(mockCourseCoreItem);
        mockExecAsync.mockRejectedValue(new Error('FFmpeg failed'));

        await extractVocabularyAudio('item-123');

        expect(mockUnlink).toHaveBeenCalled();
      });

      it('should not throw if cleanup fails', async () => {
        mockPrisma.courseCoreItem.findUnique.mockResolvedValue(mockCourseCoreItem);
        mockUnlink.mockRejectedValue(new Error('Cleanup failed'));

        // Should not throw
        await expect(extractVocabularyAudio('item-123')).resolves.toBeDefined();
      });
    });

    describe('Time Conversion', () => {
      it('should convert milliseconds to seconds correctly', async () => {
        const coreItemWithTiming = {
          ...mockCourseCoreItem,
          sourceUnitIndex: 0,
          course: {
            ...mockCourseWithTimingData,
            timingData: [
              { unitIndex: 0, startTime: 1500, endTime: 4000 }, // 1.5s to 4s
            ],
          },
        };

        mockPrisma.courseCoreItem.findUnique.mockResolvedValue(coreItemWithTiming);

        await extractVocabularyAudio('item-123');

        const command = mockExecAsync.mock.calls[0][0];
        expect(command).toContain('-ss 1.5');
        expect(command).toContain('-t 2.5'); // duration: 4s - 1.5s = 2.5s
      });

      it('should handle very short segments (< 1 second)', async () => {
        const coreItemWithShortSegment = {
          ...mockCourseCoreItem,
          sourceUnitIndex: 0,
          course: {
            ...mockCourseWithTimingData,
            timingData: [
              { unitIndex: 0, startTime: 0, endTime: 500 }, // 0.5 seconds
            ],
          },
        };

        mockPrisma.courseCoreItem.findUnique.mockResolvedValue(coreItemWithShortSegment);

        const result = await extractVocabularyAudio('item-123');

        expect(result).toBeTruthy();
        const command = mockExecAsync.mock.calls[0][0];
        expect(command).toContain('-t 0.5');
      });

      it('should handle very long segments (> 30 seconds)', async () => {
        const coreItemWithLongSegment = {
          ...mockCourseCoreItem,
          sourceUnitIndex: 0,
          course: {
            ...mockCourseWithTimingData,
            timingData: [
              { unitIndex: 0, startTime: 0, endTime: 45000 }, // 45 seconds
            ],
          },
        };

        mockPrisma.courseCoreItem.findUnique.mockResolvedValue(coreItemWithLongSegment);

        const result = await extractVocabularyAudio('item-123');

        expect(result).toBeTruthy();
        const command = mockExecAsync.mock.calls[0][0];
        expect(command).toContain('-t 45');
      });
    });

    describe('File Naming', () => {
      it('should use coreItemId in output filename', async () => {
        mockPrisma.courseCoreItem.findUnique.mockResolvedValue(mockCourseCoreItem);

        await extractVocabularyAudio('item-xyz-789');

        const uploadCall = mockUpload.mock.calls[0];
        expect(uploadCall[1].destination).toContain('vocab_item-xyz-789');
      });
    });
  });
});
