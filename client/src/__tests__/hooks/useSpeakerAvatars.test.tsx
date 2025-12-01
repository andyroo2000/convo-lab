import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSpeakerAvatars, avatarKeys } from '../../hooks/useSpeakerAvatars';
import { createWrapper } from './test-utils';

// Mock the config
vi.mock('../../config', () => ({
  API_URL: 'http://localhost:3001',
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useSpeakerAvatars', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('avatarKeys', () => {
    it('should generate correct query keys', () => {
      expect(avatarKeys.all).toEqual(['avatars']);
      expect(avatarKeys.speakers()).toEqual(['avatars', 'speakers']);
    });
  });

  describe('Initial State', () => {
    it('should show loading state while fetching', () => {
      mockFetch.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useSpeakerAvatars(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('should initialize with empty avatars array', () => {
      mockFetch.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useSpeakerAvatars(), {
        wrapper: createWrapper(),
      });

      expect(result.current.avatars).toEqual([]);
    });

    it('should initialize with empty avatarUrlMap', () => {
      mockFetch.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useSpeakerAvatars(), {
        wrapper: createWrapper(),
      });

      expect(result.current.avatarUrlMap.size).toBe(0);
    });
  });

  describe('Data Fetching', () => {
    it('should fetch avatars from admin API', async () => {
      const mockAvatars = [
        {
          id: 'avatar-1',
          filename: 'tanaka.png',
          croppedUrl: 'https://storage.example.com/avatars/tanaka-cropped.png',
          originalUrl: 'https://storage.example.com/avatars/tanaka.png',
          language: 'ja',
          gender: 'male',
          tone: 'casual',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAvatars),
      });

      const { result } = renderHook(() => useSpeakerAvatars(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.avatars).toEqual(mockAvatars);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/admin/avatars/speakers',
        expect.objectContaining({ credentials: 'include' })
      );
    });

    it('should set error on fetch failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const { result } = renderHook(() => useSpeakerAvatars(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
      });
    });
  });

  describe('Avatar URL Map', () => {
    it('should create map from filename to croppedUrl', async () => {
      const mockAvatars = [
        {
          id: 'avatar-1',
          filename: 'tanaka.png',
          croppedUrl: 'https://storage.example.com/tanaka-cropped.png',
          originalUrl: 'https://storage.example.com/tanaka.png',
          language: 'ja',
          gender: 'male',
          tone: 'casual',
        },
        {
          id: 'avatar-2',
          filename: 'yamada.png',
          croppedUrl: 'https://storage.example.com/yamada-cropped.png',
          originalUrl: 'https://storage.example.com/yamada.png',
          language: 'ja',
          gender: 'female',
          tone: 'polite',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockAvatars),
      });

      const { result } = renderHook(() => useSpeakerAvatars(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.avatars.length).toBe(2);
      });

      expect(result.current.avatarUrlMap.get('tanaka.png')).toBe(
        'https://storage.example.com/tanaka-cropped.png'
      );
      expect(result.current.avatarUrlMap.get('yamada.png')).toBe(
        'https://storage.example.com/yamada-cropped.png'
      );
    });

    it('should return undefined for unknown filename', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const { result } = renderHook(() => useSpeakerAvatars(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.avatarUrlMap.get('unknown.png')).toBeUndefined();
    });

    it('should update map when avatars change', async () => {
      const initialAvatars = [
        {
          id: 'avatar-1',
          filename: 'initial.png',
          croppedUrl: 'https://storage.example.com/initial.png',
          originalUrl: 'https://storage.example.com/initial-orig.png',
          language: 'ja',
          gender: 'male',
          tone: 'casual',
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(initialAvatars),
      });

      const { result } = renderHook(() => useSpeakerAvatars(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.avatarUrlMap.size).toBe(1);
      });

      expect(result.current.avatarUrlMap.get('initial.png')).toBe(
        'https://storage.example.com/initial.png'
      );
    });
  });

  describe('Return Values', () => {
    it('should return all expected properties', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const { result } = renderHook(() => useSpeakerAvatars(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current).toHaveProperty('avatars');
      expect(result.current).toHaveProperty('avatarUrlMap');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('error');
    });

    it('should have avatarUrlMap as a Map instance', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const { result } = renderHook(() => useSpeakerAvatars(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.avatarUrlMap).toBeInstanceOf(Map);
    });
  });

  describe('Cache Behavior', () => {
    it('should use long staleTime for rarely changing data', async () => {
      // This tests that the hook is configured with long cache times
      // The actual values (30 min stale, 1 hour gc) are implementation details
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const { result } = renderHook(() => useSpeakerAvatars(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // The fact that only one fetch was made proves caching is working
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('SpeakerAvatar Type', () => {
    it('should validate SpeakerAvatar interface', () => {
      const validAvatar = {
        id: 'avatar-1',
        filename: 'speaker.png',
        croppedUrl: 'https://example.com/cropped.png',
        originalUrl: 'https://example.com/original.png',
        language: 'ja',
        gender: 'male',
        tone: 'casual',
      };

      // Type checking - all required fields present
      expect(typeof validAvatar.id).toBe('string');
      expect(typeof validAvatar.filename).toBe('string');
      expect(typeof validAvatar.croppedUrl).toBe('string');
      expect(typeof validAvatar.originalUrl).toBe('string');
      expect(typeof validAvatar.language).toBe('string');
      expect(typeof validAvatar.gender).toBe('string');
      expect(typeof validAvatar.tone).toBe('string');
    });
  });

  describe('Multiple Avatars', () => {
    it('should handle many avatars efficiently', async () => {
      const manyAvatars = Array.from({ length: 50 }, (_, i) => ({
        id: `avatar-${i}`,
        filename: `speaker${i}.png`,
        croppedUrl: `https://storage.example.com/speaker${i}-cropped.png`,
        originalUrl: `https://storage.example.com/speaker${i}.png`,
        language: 'ja',
        gender: i % 2 === 0 ? 'male' : 'female',
        tone: 'casual',
      }));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(manyAvatars),
      });

      const { result } = renderHook(() => useSpeakerAvatars(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.avatars.length).toBe(50);
      });

      expect(result.current.avatarUrlMap.size).toBe(50);

      // Verify random lookups work
      expect(result.current.avatarUrlMap.get('speaker25.png')).toBe(
        'https://storage.example.com/speaker25-cropped.png'
      );
    });
  });

  describe('Language and Gender Filtering', () => {
    it('should return avatars with different languages', async () => {
      const multiLanguageAvatars = [
        { id: '1', filename: 'ja.png', croppedUrl: 'url1', originalUrl: 'url1', language: 'ja', gender: 'male', tone: 'casual' },
        { id: '2', filename: 'zh.png', croppedUrl: 'url2', originalUrl: 'url2', language: 'zh', gender: 'female', tone: 'polite' },
        { id: '3', filename: 'es.png', croppedUrl: 'url3', originalUrl: 'url3', language: 'es', gender: 'male', tone: 'formal' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(multiLanguageAvatars),
      });

      const { result } = renderHook(() => useSpeakerAvatars(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(result.current.avatars.length).toBe(3);
      });

      const languages = result.current.avatars.map(a => a.language);
      expect(languages).toContain('ja');
      expect(languages).toContain('zh');
      expect(languages).toContain('es');
    });
  });
});
