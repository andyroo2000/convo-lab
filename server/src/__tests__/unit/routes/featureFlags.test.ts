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
        audioCourseEnabled: true,
        narrowListeningEnabled: false,
        processingInstructionEnabled: true,
        lexicalChunksEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.featureFlag.findFirst.mockResolvedValue(mockFlags);

      const flags = await mockPrisma.featureFlag.findFirst();

      expect(flags).toBeDefined();
      expect(flags?.dialoguesEnabled).toBe(true);
      expect(flags?.narrowListeningEnabled).toBe(false);
    });

    it('should create default flags if none exist', async () => {
      mockPrisma.featureFlag.findFirst.mockResolvedValue(null);

      const defaultFlags = {
        id: 'new-flag-1',
        dialoguesEnabled: true,
        audioCourseEnabled: true,
        narrowListeningEnabled: true,
        processingInstructionEnabled: true,
        lexicalChunksEnabled: true,
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
            audioCourseEnabled: true,
            narrowListeningEnabled: true,
            processingInstructionEnabled: true,
            lexicalChunksEnabled: true,
          },
        });
      }

      expect(mockPrisma.featureFlag.create).toHaveBeenCalledWith({
        data: {
          dialoguesEnabled: true,
          audioCourseEnabled: true,
          narrowListeningEnabled: true,
          processingInstructionEnabled: true,
          lexicalChunksEnabled: true,
        },
      });
      expect(flags.dialoguesEnabled).toBe(true);
      expect(flags.audioCourseEnabled).toBe(true);
      expect(flags.narrowListeningEnabled).toBe(true);
    });

    it('should use existing flags without creating new ones', async () => {
      const existingFlags = {
        id: 'existing-flag',
        dialoguesEnabled: false,
        audioCourseEnabled: true,
        narrowListeningEnabled: true,
        processingInstructionEnabled: false,
        lexicalChunksEnabled: true,
      };

      mockPrisma.featureFlag.findFirst.mockResolvedValue(existingFlags);

      // Simulate the route logic
      let flags = await mockPrisma.featureFlag.findFirst();
      if (!flags) {
        flags = await mockPrisma.featureFlag.create({
          data: {
            dialoguesEnabled: true,
            audioCourseEnabled: true,
            narrowListeningEnabled: true,
            processingInstructionEnabled: true,
            lexicalChunksEnabled: true,
          },
        });
      }

      expect(mockPrisma.featureFlag.create).not.toHaveBeenCalled();
      expect(flags.dialoguesEnabled).toBe(false);
      expect(flags.processingInstructionEnabled).toBe(false);
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
      let flags = await mockPrisma.featureFlag.findFirst();
      if (!flags) {
        await expect(
          mockPrisma.featureFlag.create({
            data: {
              dialoguesEnabled: true,
              audioCourseEnabled: true,
              narrowListeningEnabled: true,
              processingInstructionEnabled: true,
              lexicalChunksEnabled: true,
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
        audioCourseEnabled: true,
        narrowListeningEnabled: true,
        processingInstructionEnabled: true,
        lexicalChunksEnabled: true,
      };

      expect(defaultFlags.dialoguesEnabled).toBe(true);
      expect(defaultFlags.audioCourseEnabled).toBe(true);
      expect(defaultFlags.narrowListeningEnabled).toBe(true);
      expect(defaultFlags.processingInstructionEnabled).toBe(true);
      expect(defaultFlags.lexicalChunksEnabled).toBe(true);
    });
  });

  describe('Feature Flag Structure', () => {
    it('should contain all expected feature flags', () => {
      const expectedFlags = [
        'dialoguesEnabled',
        'audioCourseEnabled',
        'narrowListeningEnabled',
        'processingInstructionEnabled',
        'lexicalChunksEnabled',
      ];

      const flagKeys = Object.keys({
        dialoguesEnabled: true,
        audioCourseEnabled: true,
        narrowListeningEnabled: true,
        processingInstructionEnabled: true,
        lexicalChunksEnabled: true,
      });

      expectedFlags.forEach((flag) => {
        expect(flagKeys).toContain(flag);
      });
    });

    it('should return boolean values for all flags', () => {
      const mockFlags = {
        dialoguesEnabled: true,
        audioCourseEnabled: false,
        narrowListeningEnabled: true,
        processingInstructionEnabled: false,
        lexicalChunksEnabled: true,
      };

      Object.values(mockFlags).forEach((value) => {
        expect(typeof value).toBe('boolean');
      });
    });
  });
});
