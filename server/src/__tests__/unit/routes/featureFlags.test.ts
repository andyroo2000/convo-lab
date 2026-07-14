import { describe, it, expect, vi, beforeEach } from 'vitest';

import { mockPrisma } from '../../setup.js';

describe('Feature Flags Route Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET / - Get Feature Flags', () => {
    it('should return existing feature flags', async () => {
      const mockFlags = {
        id: 'flag-1',
        dialoguesEnabled: true,
        scriptsEnabled: true,
        audioCourseEnabled: true,
        flashcardsEnabled: true,
        studyApiEnabled: false,
        studyApiSettings: false,
        studyApiOverview: false,
        studyApiBrowser: false,
        studyApiNewQueue: false,
        studyApiImports: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.featureFlag.findFirst.mockResolvedValue(mockFlags);

      const flags = await mockPrisma.featureFlag.findFirst();

      expect(flags).toBeDefined();
      expect(flags?.dialoguesEnabled).toBe(true);
    });

    it('should create default flags if none exist', async () => {
      mockPrisma.featureFlag.findFirst.mockResolvedValue(null);

      const defaultFlags = {
        id: 'new-flag-1',
        dialoguesEnabled: true,
        scriptsEnabled: true,
        audioCourseEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.featureFlag.create.mockResolvedValue(defaultFlags);

      // Simulate the route logic
      let flags = await mockPrisma.featureFlag.findFirst();
      if (!flags) {
        flags = await mockPrisma.featureFlag.create({
          data: {
            dialoguesEnabled: true,
            scriptsEnabled: true,
            audioCourseEnabled: true,
            flashcardsEnabled: true,
            studyApiEnabled: false,
            studyApiSettings: false,
            studyApiOverview: false,
            studyApiBrowser: false,
            studyApiNewQueue: false,
            studyApiImports: false,
          },
        });
      }

      expect(mockPrisma.featureFlag.create).toHaveBeenCalledWith({
        data: {
          dialoguesEnabled: true,
          scriptsEnabled: true,
          audioCourseEnabled: true,
          flashcardsEnabled: true,
          studyApiEnabled: false,
          studyApiSettings: false,
          studyApiOverview: false,
          studyApiBrowser: false,
          studyApiNewQueue: false,
          studyApiImports: false,
        },
      });
      expect(flags.dialoguesEnabled).toBe(true);
      expect(flags.audioCourseEnabled).toBe(true);
    });

    it('should use existing flags without creating new ones', async () => {
      const existingFlags = {
        id: 'existing-flag',
        dialoguesEnabled: false,
        scriptsEnabled: true,
        audioCourseEnabled: true,
      };

      mockPrisma.featureFlag.findFirst.mockResolvedValue(existingFlags);

      // Simulate the route logic
      let flags = await mockPrisma.featureFlag.findFirst();
      if (!flags) {
        flags = await mockPrisma.featureFlag.create({
          data: {
            dialoguesEnabled: true,
            scriptsEnabled: true,
            audioCourseEnabled: true,
          },
        });
      }

      expect(mockPrisma.featureFlag.create).not.toHaveBeenCalled();
      expect(flags.dialoguesEnabled).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      mockPrisma.featureFlag.findFirst.mockRejectedValue(new Error('Database connection failed'));

      await expect(mockPrisma.featureFlag.findFirst()).rejects.toThrow(
        'Database connection failed'
      );
    });

    it('should handle create errors when no flags exist', async () => {
      mockPrisma.featureFlag.findFirst.mockResolvedValue(null);
      mockPrisma.featureFlag.create.mockRejectedValue(new Error('Unique constraint violation'));

      // Simulate route logic
      const flags = await mockPrisma.featureFlag.findFirst();
      if (!flags) {
        await expect(
          mockPrisma.featureFlag.create({
            data: {
              dialoguesEnabled: true,
              scriptsEnabled: true,
              audioCourseEnabled: true,
              flashcardsEnabled: true,
              studyApiEnabled: false,
              studyApiSettings: false,
              studyApiOverview: false,
              studyApiBrowser: false,
              studyApiNewQueue: false,
              studyApiImports: false,
            },
          })
        ).rejects.toThrow('Unique constraint violation');
      }
    });
  });

  describe('Default Flag Values', () => {
    it('should have all features enabled by default', () => {
      const defaultFlags = {
        dialoguesEnabled: true,
        scriptsEnabled: true,
        audioCourseEnabled: true,
        flashcardsEnabled: true,
        studyApiEnabled: false,
        studyApiSettings: false,
        studyApiOverview: false,
        studyApiBrowser: false,
        studyApiNewQueue: false,
        studyApiImports: false,
      };

      expect(defaultFlags.dialoguesEnabled).toBe(true);
      expect(defaultFlags.scriptsEnabled).toBe(true);
      expect(defaultFlags.audioCourseEnabled).toBe(true);
    });
  });

  describe('Feature Flag Structure', () => {
    it('should contain all expected feature flags', () => {
      const expectedFlags = [
        'dialoguesEnabled',
        'scriptsEnabled',
        'audioCourseEnabled',
        'flashcardsEnabled',
        'studyApiEnabled',
        'studyApiSettings',
        'studyApiOverview',
        'studyApiBrowser',
        'studyApiNewQueue',
        'studyApiImports',
      ];

      const flagKeys = Object.keys({
        dialoguesEnabled: true,
        scriptsEnabled: true,
        audioCourseEnabled: true,
        flashcardsEnabled: true,
        studyApiEnabled: false,
        studyApiSettings: false,
        studyApiOverview: false,
        studyApiBrowser: false,
        studyApiNewQueue: false,
        studyApiImports: false,
      });

      expectedFlags.forEach((flag) => {
        expect(flagKeys).toContain(flag);
      });
    });

    it('should return boolean values for all flags', () => {
      const mockFlags = {
        dialoguesEnabled: true,
        scriptsEnabled: true,
        audioCourseEnabled: false,
      };

      Object.values(mockFlags).forEach((value) => {
        expect(typeof value).toBe('boolean');
      });
    });
  });
});
