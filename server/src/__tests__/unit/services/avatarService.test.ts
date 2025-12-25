import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import after mocking
import {
  cropAndResizeImage,
  uploadUserAvatar,
  uploadSpeakerAvatar,
  recropSpeakerAvatar,
  getSpeakerAvatarOriginalUrl,
  getAllSpeakerAvatars,
  getSpeakerAvatar,
  parseVoiceIdForGender,
  findSpeakerAvatarUrl,
  getAvatarUrlFromVoice,
} from '../../../services/avatarService.js';

// Create hoisted mocks
const mockSharp = vi.hoisted(() => {
  const mockInstance = {
    metadata: vi.fn(),
    extract: vi.fn(),
    resize: vi.fn(),
    jpeg: vi.fn(),
    toBuffer: vi.fn(),
  };
  // Chain all methods back to the instance
  mockInstance.extract.mockReturnValue(mockInstance);
  mockInstance.resize.mockReturnValue(mockInstance);
  mockInstance.jpeg.mockReturnValue(mockInstance);

  const sharpFn = vi.fn(() => mockInstance);
  return { sharpFn, mockInstance };
});

const mockUploadToGCS = vi.hoisted(() => vi.fn());
const mockFetch = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  user: {
    update: vi.fn(),
  },
  speakerAvatar: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
}));

// Mock sharp
vi.mock('sharp', () => ({
  default: mockSharp.sharpFn,
}));

// Mock storageClient
vi.mock('../../../services/storageClient.js', () => ({
  uploadToGCS: mockUploadToGCS,
}));

// Mock prisma
vi.mock('../../../db/client.js', () => ({
  prisma: mockPrisma,
}));

// Mock fetch globally
vi.stubGlobal('fetch', mockFetch);

// Mock TTS_VOICES from shared constants
vi.mock('../../../../../shared/src/constants-new.js', () => ({
  TTS_VOICES: {
    ja: {
      voices: [
        { id: 'ja-JP-Wavenet-A', name: 'Japanese Female 1', gender: 'female' },
        { id: 'ja-JP-Wavenet-C', name: 'Japanese Male 1', gender: 'male' },
        { id: 'Takumi', name: 'Takumi', gender: 'male' },
      ],
    },
    es: {
      voices: [
        { id: 'Lucia', name: 'Lucia', gender: 'female' },
        { id: 'Sergio', name: 'Sergio', gender: 'male' },
      ],
    },
    zh: {
      voices: [
        { id: 'cmn-CN-Wavenet-A', name: 'Chinese Female 1', gender: 'female' },
        { id: 'cmn-CN-Wavenet-B', name: 'Chinese Male 1', gender: 'male' },
        { id: 'Zhiyu', name: 'Zhiyu', gender: 'female' },
      ],
    },
    fr: {
      voices: [
        { id: 'Léa', name: 'Léa', gender: 'female' },
        { id: 'Rémi', name: 'Rémi', gender: 'male' },
      ],
    },
    ar: {
      voices: [
        { id: 'Hala', name: 'Hala', gender: 'female' },
        { id: 'Zayd', name: 'Zayd', gender: 'male' },
      ],
    },
  },
}));

describe('avatarService', () => {
  const mockImageBuffer = Buffer.from('mock image data');
  const mockCropArea = { x: 10, y: 20, width: 100, height: 100 };

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset sharp mock defaults
    mockSharp.mockInstance.metadata.mockResolvedValue({
      width: 500,
      height: 500,
    });
    mockSharp.mockInstance.toBuffer.mockResolvedValue(Buffer.from('cropped image'));
  });

  describe('cropAndResizeImage', () => {
    it('should crop and resize image to 256x256', async () => {
      const result = await cropAndResizeImage(mockImageBuffer, mockCropArea);

      expect(mockSharp.sharpFn).toHaveBeenCalledWith(mockImageBuffer);
      expect(mockSharp.mockInstance.metadata).toHaveBeenCalled();
      expect(mockSharp.mockInstance.extract).toHaveBeenCalledWith({
        left: 10,
        top: 20,
        width: 100,
        height: 100,
      });
      expect(mockSharp.mockInstance.resize).toHaveBeenCalledWith(256, 256, {
        fit: 'cover',
        position: 'center',
      });
      expect(mockSharp.mockInstance.jpeg).toHaveBeenCalledWith({
        quality: 85,
        progressive: true,
      });
      expect(result).toEqual(Buffer.from('cropped image'));
    });

    it('should clamp crop area to image bounds', async () => {
      mockSharp.mockInstance.metadata.mockResolvedValue({
        width: 50,
        height: 50,
      });

      await cropAndResizeImage(mockImageBuffer, { x: 40, y: 40, width: 100, height: 100 });

      // x=40 clamped to min(40, 49)=40, width clamped to min(100, 50-40)=10
      expect(mockSharp.mockInstance.extract).toHaveBeenCalledWith({
        left: 40,
        top: 40,
        width: 10,
        height: 10,
      });
    });

    it('should handle negative crop coordinates', async () => {
      await cropAndResizeImage(mockImageBuffer, { x: -10, y: -20, width: 100, height: 100 });

      expect(mockSharp.mockInstance.extract).toHaveBeenCalledWith({
        left: 0,
        top: 0,
        width: 100,
        height: 100,
      });
    });
  });

  describe('uploadUserAvatar', () => {
    it('should crop, upload to GCS, and update user record', async () => {
      const mockPublicUrl = 'https://storage.example.com/avatars/user-123.jpg';
      mockUploadToGCS.mockResolvedValue(mockPublicUrl);

      const result = await uploadUserAvatar('user-123', mockImageBuffer, mockCropArea);

      expect(mockUploadToGCS).toHaveBeenCalledWith({
        buffer: expect.any(Buffer),
        filename: expect.stringMatching(/^user-user-123-\d+\.jpg$/),
        contentType: 'image/jpeg',
        folder: 'avatars',
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { avatarUrl: mockPublicUrl },
      });
      expect(result).toBe(mockPublicUrl);
    });
  });

  describe('uploadSpeakerAvatar', () => {
    it('should upload cropped and original versions to GCS', async () => {
      const croppedUrl = 'https://storage.example.com/avatars/speakers/ja-female-casual.jpg';
      const originalUrl =
        'https://storage.example.com/avatars/speakers/original-ja-female-casual.jpg';
      mockUploadToGCS.mockResolvedValueOnce(croppedUrl).mockResolvedValueOnce(originalUrl);

      const result = await uploadSpeakerAvatar(
        'ja-female-casual.jpg',
        mockImageBuffer,
        mockCropArea
      );

      expect(mockUploadToGCS).toHaveBeenCalledTimes(2);
      expect(mockUploadToGCS).toHaveBeenNthCalledWith(1, {
        buffer: expect.any(Buffer),
        filename: 'ja-female-casual.jpg',
        contentType: 'image/jpeg',
        folder: 'avatars/speakers',
      });
      expect(mockUploadToGCS).toHaveBeenNthCalledWith(2, {
        buffer: mockImageBuffer,
        filename: 'original-ja-female-casual.jpg',
        contentType: 'image/jpeg',
        folder: 'avatars/speakers',
      });
      expect(mockPrisma.speakerAvatar.upsert).toHaveBeenCalledWith({
        where: { filename: 'ja-female-casual.jpg' },
        create: {
          filename: 'ja-female-casual.jpg',
          croppedUrl,
          originalUrl,
          language: 'ja',
          gender: 'female',
          tone: 'casual',
        },
        update: {
          croppedUrl,
          originalUrl,
        },
      });
      expect(result).toEqual({ croppedUrl, originalUrl });
    });
  });

  describe('recropSpeakerAvatar', () => {
    it('should fetch original and re-upload with new crop', async () => {
      const existingAvatar = {
        filename: 'ja-female-casual.jpg',
        originalUrl: 'https://storage.example.com/original.jpg',
        croppedUrl: 'https://storage.example.com/cropped.jpg',
      };
      mockPrisma.speakerAvatar.findUnique.mockResolvedValue(existingAvatar);

      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
      });

      const croppedUrl = 'https://storage.example.com/new-cropped.jpg';
      const originalUrl = 'https://storage.example.com/new-original.jpg';
      mockUploadToGCS.mockResolvedValueOnce(croppedUrl).mockResolvedValueOnce(originalUrl);

      const result = await recropSpeakerAvatar('ja-female-casual.jpg', mockCropArea);

      expect(mockPrisma.speakerAvatar.findUnique).toHaveBeenCalledWith({
        where: { filename: 'ja-female-casual.jpg' },
      });
      expect(mockFetch).toHaveBeenCalledWith(existingAvatar.originalUrl);
      expect(result).toEqual({ croppedUrl, originalUrl });
    });

    it('should throw error if avatar not found', async () => {
      mockPrisma.speakerAvatar.findUnique.mockResolvedValue(null);

      await expect(recropSpeakerAvatar('nonexistent.jpg', mockCropArea)).rejects.toThrow(
        'Speaker avatar not found in database: nonexistent.jpg'
      );
    });

    it('should throw error if fetch fails', async () => {
      mockPrisma.speakerAvatar.findUnique.mockResolvedValue({
        filename: 'ja-female-casual.jpg',
        originalUrl: 'https://storage.example.com/original.jpg',
      });
      mockFetch.mockResolvedValue({
        ok: false,
      });

      await expect(recropSpeakerAvatar('ja-female-casual.jpg', mockCropArea)).rejects.toThrow(
        'Failed to fetch original image from GCS: ja-female-casual.jpg'
      );
    });
  });

  describe('getSpeakerAvatarOriginalUrl', () => {
    it('should return original URL from database', async () => {
      mockPrisma.speakerAvatar.findUnique.mockResolvedValue({
        originalUrl: 'https://storage.example.com/original.jpg',
      });

      const result = await getSpeakerAvatarOriginalUrl('ja-female-casual.jpg');

      expect(mockPrisma.speakerAvatar.findUnique).toHaveBeenCalledWith({
        where: { filename: 'ja-female-casual.jpg' },
        select: { originalUrl: true },
      });
      expect(result).toBe('https://storage.example.com/original.jpg');
    });

    it('should throw error if avatar not found', async () => {
      mockPrisma.speakerAvatar.findUnique.mockResolvedValue(null);

      await expect(getSpeakerAvatarOriginalUrl('nonexistent.jpg')).rejects.toThrow(
        'Speaker avatar not found in database: nonexistent.jpg'
      );
    });
  });

  describe('getAllSpeakerAvatars', () => {
    it('should return all avatars ordered by language, gender, tone', async () => {
      const mockAvatars = [
        { filename: 'ja-female-casual.jpg', language: 'ja', gender: 'female', tone: 'casual' },
        { filename: 'ja-male-formal.jpg', language: 'ja', gender: 'male', tone: 'formal' },
      ];
      mockPrisma.speakerAvatar.findMany.mockResolvedValue(mockAvatars);

      const result = await getAllSpeakerAvatars();

      expect(mockPrisma.speakerAvatar.findMany).toHaveBeenCalledWith({
        orderBy: [{ language: 'asc' }, { gender: 'asc' }, { tone: 'asc' }],
      });
      expect(result).toEqual(mockAvatars);
    });
  });

  describe('getSpeakerAvatar', () => {
    it('should return avatar by filename', async () => {
      const mockAvatar = {
        filename: 'ja-female-casual.jpg',
        croppedUrl: 'https://storage.example.com/cropped.jpg',
      };
      mockPrisma.speakerAvatar.findUnique.mockResolvedValue(mockAvatar);

      const result = await getSpeakerAvatar('ja-female-casual.jpg');

      expect(mockPrisma.speakerAvatar.findUnique).toHaveBeenCalledWith({
        where: { filename: 'ja-female-casual.jpg' },
      });
      expect(result).toEqual(mockAvatar);
    });

    it('should return null if not found', async () => {
      mockPrisma.speakerAvatar.findUnique.mockResolvedValue(null);

      const result = await getSpeakerAvatar('nonexistent.jpg');

      expect(result).toBeNull();
    });
  });

  describe('parseVoiceIdForGender', () => {
    it('should return female for Japanese Wavenet-A voice', () => {
      expect(parseVoiceIdForGender('ja-JP-Wavenet-A')).toBe('female');
    });

    it('should return male for Japanese Wavenet-C voice', () => {
      expect(parseVoiceIdForGender('ja-JP-Wavenet-C')).toBe('male');
    });

    it('should return male for Takumi Polly voice', () => {
      expect(parseVoiceIdForGender('Takumi')).toBe('male');
    });

    it('should return female for Lucia Polly voice', () => {
      expect(parseVoiceIdForGender('Lucia')).toBe('female');
    });

    it('should return female for Chinese Wavenet-A voice', () => {
      expect(parseVoiceIdForGender('cmn-CN-Wavenet-A')).toBe('female');
    });

    it('should return male for Chinese Wavenet-B voice', () => {
      expect(parseVoiceIdForGender('cmn-CN-Wavenet-B')).toBe('male');
    });

    it('should return female for French Léa voice', () => {
      expect(parseVoiceIdForGender('Léa')).toBe('female');
    });

    it('should return male for French Rémi voice', () => {
      expect(parseVoiceIdForGender('Rémi')).toBe('male');
    });

    it('should return female for Arabic Hala voice', () => {
      expect(parseVoiceIdForGender('Hala')).toBe('female');
    });

    it('should return male for Arabic Zayd voice', () => {
      expect(parseVoiceIdForGender('Zayd')).toBe('male');
    });

    it('should default to female for unknown voice', () => {
      expect(parseVoiceIdForGender('unknown-voice')).toBe('female');
    });
  });

  describe('findSpeakerAvatarUrl', () => {
    it('should return cropped URL for matching avatar', async () => {
      mockPrisma.speakerAvatar.findFirst.mockResolvedValue({
        croppedUrl: 'https://storage.example.com/cropped.jpg',
      });

      const result = await findSpeakerAvatarUrl('ja', 'female', 'casual');

      expect(mockPrisma.speakerAvatar.findFirst).toHaveBeenCalledWith({
        where: {
          language: 'ja',
          gender: 'female',
          tone: 'casual',
        },
      });
      expect(result).toBe('https://storage.example.com/cropped.jpg');
    });

    it('should return null if no matching avatar', async () => {
      mockPrisma.speakerAvatar.findFirst.mockResolvedValue(null);

      const result = await findSpeakerAvatarUrl('xx', 'unknown', 'tone');

      expect(result).toBeNull();
    });

    it('should normalize case for matching', async () => {
      mockPrisma.speakerAvatar.findFirst.mockResolvedValue({
        croppedUrl: 'https://storage.example.com/cropped.jpg',
      });

      await findSpeakerAvatarUrl('JA', 'Female', 'CASUAL');

      expect(mockPrisma.speakerAvatar.findFirst).toHaveBeenCalledWith({
        where: {
          language: 'ja',
          gender: 'female',
          tone: 'casual',
        },
      });
    });
  });

  describe('getAvatarUrlFromVoice', () => {
    it('should find avatar for Japanese Google voice', async () => {
      mockPrisma.speakerAvatar.findFirst.mockResolvedValue({
        croppedUrl: 'https://storage.example.com/ja-female-casual.jpg',
      });

      const result = await getAvatarUrlFromVoice('ja-JP-Wavenet-A', 'casual');

      expect(mockPrisma.speakerAvatar.findFirst).toHaveBeenCalledWith({
        where: {
          language: 'ja',
          gender: 'female',
          tone: 'casual',
        },
      });
      expect(result).toBe('https://storage.example.com/ja-female-casual.jpg');
    });

    it('should find avatar for Chinese voice with language code normalization', async () => {
      mockPrisma.speakerAvatar.findFirst.mockResolvedValue({
        croppedUrl: 'https://storage.example.com/zh-male-formal.jpg',
      });

      const result = await getAvatarUrlFromVoice('cmn-CN-Wavenet-B', 'formal');

      // cmn should be normalized to zh
      expect(mockPrisma.speakerAvatar.findFirst).toHaveBeenCalledWith({
        where: {
          language: 'zh',
          gender: 'male',
          tone: 'formal',
        },
      });
      expect(result).toBe('https://storage.example.com/zh-male-formal.jpg');
    });

    it('should find avatar for Polly voice', async () => {
      mockPrisma.speakerAvatar.findFirst.mockResolvedValue({
        croppedUrl: 'https://storage.example.com/es-female-casual.jpg',
      });

      const result = await getAvatarUrlFromVoice('Lucia', 'casual');

      expect(mockPrisma.speakerAvatar.findFirst).toHaveBeenCalledWith({
        where: {
          language: 'es',
          gender: 'female',
          tone: 'casual',
        },
      });
      expect(result).toBe('https://storage.example.com/es-female-casual.jpg');
    });

    it('should return null if no matching avatar found', async () => {
      mockPrisma.speakerAvatar.findFirst.mockResolvedValue(null);

      const result = await getAvatarUrlFromVoice('ja-JP-Wavenet-A', 'unknown');

      expect(result).toBeNull();
    });
  });
});
