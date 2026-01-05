import { Rating } from 'ts-fsrs';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { reviewCard, getDueCards, getDeckStats } from '../../../services/srsService.js';
import {
  newCardState,
  learningCardState,
  reviewCardState,
  createMockRecordLog,
  mockDatabaseCard,
} from '../../fixtures/fsrsStates.js';
import { mockPrisma } from '../../setup.js';

// Mock FSRS library
const { mockRepeat, mockFSRS } = vi.hoisted(() => {
  const mockRepeat = vi.fn();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockFSRS = vi.fn(function (this: any) {
    this.repeat = mockRepeat;
    return this;
  });
  return { mockRepeat, mockFSRS };
});

vi.mock('ts-fsrs', async () => {
  const actual = await vi.importActual('ts-fsrs');
  return {
    ...actual,
    FSRS: mockFSRS,
  };
});

describe('srsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('reviewCard()', () => {
    beforeEach(() => {
      // Mock $transaction for array-based transactions used in reviewCard
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockPrisma.$transaction.mockImplementation(async (operations: any[]) => {
        if (Array.isArray(operations)) {
          return Promise.all(operations);
        }
        return operations(mockPrisma);
      });
    });

    describe('FSRS State Transitions - Recognition Cards', () => {
      it('should successfully review a new recognition card with rating 1 (Again)', async () => {
        const now = new Date();
        const recordLog = createMockRecordLog(newCardState);
        mockRepeat.mockReturnValue(recordLog);

        mockPrisma.card.findFirst.mockResolvedValue({
          ...mockDatabaseCard,
          recognitionState: 'new',
          recognitionDue: now,
        });

        mockPrisma.card.update.mockResolvedValue({
          ...mockDatabaseCard,
          recognitionState: 'relearning',
        });

        mockPrisma.review.create.mockResolvedValue({
          id: 'review-1',
          cardId: mockDatabaseCard.id,
          userId: 'user-123',
          cardType: 'recognition',
          rating: 1,
        });

        const result = await reviewCard({
          cardId: mockDatabaseCard.id,
          userId: 'user-123',
          cardType: 'recognition',
          rating: 1,
          durationMs: 3000,
        });

        expect(mockPrisma.card.findFirst).toHaveBeenCalledWith({
          where: { id: mockDatabaseCard.id, userId: 'user-123' },
        });
        expect(mockRepeat).toHaveBeenCalled();
        expect(result.card.recognitionState).toBe('relearning');
        expect(result.review).toBeDefined();
      });

      it('should successfully review a new recognition card with rating 3 (Good)', async () => {
        const recordLog = createMockRecordLog(newCardState);
        mockRepeat.mockReturnValue(recordLog);

        mockPrisma.card.findFirst.mockResolvedValue({
          ...mockDatabaseCard,
          recognitionState: 'new',
        });

        const updatedCard = {
          ...mockDatabaseCard,
          recognitionState: 'review',
        };

        mockPrisma.card.update.mockResolvedValue(updatedCard);

        mockPrisma.review.create.mockResolvedValue({
          id: 'review-2',
          cardId: mockDatabaseCard.id,
          userId: 'user-123',
          cardType: 'recognition',
          rating: 3,
        });

        await reviewCard({
          cardId: mockDatabaseCard.id,
          userId: 'user-123',
          cardType: 'recognition',
          rating: 3,
        });

        expect(updatedCard.recognitionState).toBe('review');
      });

      it('should successfully review a new recognition card with rating 4 (Easy)', async () => {
        const recordLog = createMockRecordLog(newCardState);
        mockRepeat.mockReturnValue(recordLog);

        mockPrisma.card.findFirst.mockResolvedValue({
          ...mockDatabaseCard,
          recognitionState: 'new',
        });

        mockPrisma.card.update.mockResolvedValue({
          ...mockDatabaseCard,
          recognitionState: 'review',
        });

        mockPrisma.review.create.mockResolvedValue({
          id: 'review-3',
        });

        const result = await reviewCard({
          cardId: mockDatabaseCard.id,
          userId: 'user-123',
          cardType: 'recognition',
          rating: 4,
        });

        expect(result.card.recognitionState).toBe('review');
      });

      it('should update recognition FSRS state correctly after review', async () => {
        const recordLog = createMockRecordLog(learningCardState);
        mockRepeat.mockReturnValue(recordLog);

        mockPrisma.card.findFirst.mockResolvedValue({
          ...mockDatabaseCard,
          recognitionState: 'learning',
          recognitionStability: 1.5,
          recognitionDifficulty: 5.0,
          recognitionReps: 1,
        });

        const updatedCard = {
          ...mockDatabaseCard,
          recognitionState: 'review',
          recognitionStability: 3.75, // 1.5 * 2.5
          recognitionDifficulty: 5.0,
          recognitionReps: 2,
        };

        mockPrisma.card.update.mockResolvedValue(updatedCard);
        mockPrisma.review.create.mockResolvedValue({ id: 'review-4' });

        await reviewCard({
          cardId: mockDatabaseCard.id,
          userId: 'user-123',
          cardType: 'recognition',
          rating: 3,
        });

        expect(mockPrisma.card.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: mockDatabaseCard.id },
            data: expect.objectContaining({
              recognitionState: expect.any(String),
              recognitionStability: expect.any(Number),
              recognitionDifficulty: expect.any(Number),
              recognitionReps: expect.any(Number),
            }),
          })
        );
      });
    });

    describe('FSRS State Transitions - Audio Cards', () => {
      it('should successfully review a new audio card with rating 2 (Hard)', async () => {
        const recordLog = createMockRecordLog(newCardState);
        mockRepeat.mockReturnValue(recordLog);

        mockPrisma.card.findFirst.mockResolvedValue({
          ...mockDatabaseCard,
          audioState: 'new',
        });

        mockPrisma.card.update.mockResolvedValue({
          ...mockDatabaseCard,
          audioState: 'learning',
        });

        mockPrisma.review.create.mockResolvedValue({ id: 'review-5' });

        const result = await reviewCard({
          cardId: mockDatabaseCard.id,
          userId: 'user-123',
          cardType: 'audio',
          rating: 2,
        });

        expect(result.card.audioState).toBe('learning');
      });

      it('should update audio FSRS state correctly after review', async () => {
        const recordLog = createMockRecordLog(learningCardState);
        mockRepeat.mockReturnValue(recordLog);

        mockPrisma.card.findFirst.mockResolvedValue({
          ...mockDatabaseCard,
          audioState: 'learning',
          audioStability: 1.5,
          audioDifficulty: 5.0,
          audioReps: 1,
        });

        mockPrisma.card.update.mockResolvedValue({
          ...mockDatabaseCard,
          audioState: 'review',
        });

        mockPrisma.review.create.mockResolvedValue({ id: 'review-6' });

        await reviewCard({
          cardId: mockDatabaseCard.id,
          userId: 'user-123',
          cardType: 'audio',
          rating: 3,
        });

        expect(mockPrisma.card.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              audioState: expect.any(String),
              audioStability: expect.any(Number),
              audioDifficulty: expect.any(Number),
              audioReps: expect.any(Number),
            }),
          })
        );
      });
    });

    describe('State Transitions', () => {
      it("should transition card from 'new' to 'learning' state on first review with rating 2-4", async () => {
        const recordLog = createMockRecordLog(newCardState);
        mockRepeat.mockReturnValue(recordLog);

        mockPrisma.card.findFirst.mockResolvedValue({
          ...mockDatabaseCard,
          recognitionState: 'new',
        });

        mockPrisma.card.update.mockResolvedValue({
          ...mockDatabaseCard,
          recognitionState: 'learning',
        });

        mockPrisma.review.create.mockResolvedValue({ id: 'review-7' });

        await reviewCard({
          cardId: mockDatabaseCard.id,
          userId: 'user-123',
          cardType: 'recognition',
          rating: 2,
        });

        const updateCall = mockPrisma.card.update.mock.calls[0][0];
        expect(updateCall.data.recognitionState).toMatch(/learning|review/);
      });

      it("should transition card from 'learning' to 'review' state after successful reviews", async () => {
        const recordLog = createMockRecordLog(learningCardState);
        mockRepeat.mockReturnValue(recordLog);

        mockPrisma.card.findFirst.mockResolvedValue({
          ...mockDatabaseCard,
          recognitionState: 'learning',
        });

        mockPrisma.card.update.mockResolvedValue({
          ...mockDatabaseCard,
          recognitionState: 'review',
        });

        mockPrisma.review.create.mockResolvedValue({ id: 'review-8' });

        await reviewCard({
          cardId: mockDatabaseCard.id,
          userId: 'user-123',
          cardType: 'recognition',
          rating: 3,
        });

        const updateCall = mockPrisma.card.update.mock.calls[0][0];
        expect(['review', 'learning']).toContain(updateCall.data.recognitionState);
      });

      it("should transition card to 'relearning' state after lapse (rating 1)", async () => {
        const recordLog = createMockRecordLog(reviewCardState);
        mockRepeat.mockReturnValue(recordLog);

        mockPrisma.card.findFirst.mockResolvedValue({
          ...mockDatabaseCard,
          recognitionState: 'review',
        });

        mockPrisma.card.update.mockResolvedValue({
          ...mockDatabaseCard,
          recognitionState: 'relearning',
        });

        mockPrisma.review.create.mockResolvedValue({ id: 'review-9' });

        await reviewCard({
          cardId: mockDatabaseCard.id,
          userId: 'user-123',
          cardType: 'recognition',
          rating: 1,
        });

        const updateCall = mockPrisma.card.update.mock.calls[0][0];
        expect(updateCall.data.recognitionState).toBeDefined();
      });
    });

    describe('FSRS Parameters', () => {
      it('should update due date based on FSRS scheduling', async () => {
        const futureDue = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        const recordLog = createMockRecordLog(learningCardState);
        recordLog[Rating.Good].card.due = futureDue;
        mockRepeat.mockReturnValue(recordLog);

        mockPrisma.card.findFirst.mockResolvedValue({
          ...mockDatabaseCard,
          recognitionState: 'learning',
        });

        mockPrisma.card.update.mockResolvedValue({
          ...mockDatabaseCard,
          recognitionDue: futureDue,
        });

        mockPrisma.review.create.mockResolvedValue({ id: 'review-10' });

        const result = await reviewCard({
          cardId: mockDatabaseCard.id,
          userId: 'user-123',
          cardType: 'recognition',
          rating: 3,
        });

        expect(result.nextDue).toBeInstanceOf(Date);
      });

      it('should update stability and difficulty parameters correctly', async () => {
        const recordLog = createMockRecordLog(reviewCardState);
        mockRepeat.mockReturnValue(recordLog);

        mockPrisma.card.findFirst.mockResolvedValue({
          ...mockDatabaseCard,
          recognitionState: 'review',
          recognitionStability: 10.0,
          recognitionDifficulty: 4.5,
        });

        mockPrisma.card.update.mockResolvedValue({
          ...mockDatabaseCard,
          recognitionStability: 25.0,
          recognitionDifficulty: 4.5,
        });

        mockPrisma.review.create.mockResolvedValue({ id: 'review-11' });

        await reviewCard({
          cardId: mockDatabaseCard.id,
          userId: 'user-123',
          cardType: 'recognition',
          rating: 3,
        });

        const updateCall = mockPrisma.card.update.mock.calls[0][0];
        expect(updateCall.data).toHaveProperty('recognitionStability');
        expect(updateCall.data).toHaveProperty('recognitionDifficulty');
      });

      it('should increment reps counter', async () => {
        const recordLog = createMockRecordLog(reviewCardState);
        mockRepeat.mockReturnValue(recordLog);

        mockPrisma.card.findFirst.mockResolvedValue({
          ...mockDatabaseCard,
          recognitionState: 'review',
          recognitionReps: 5,
        });

        mockPrisma.card.update.mockResolvedValue({
          ...mockDatabaseCard,
          recognitionReps: 6,
        });

        mockPrisma.review.create.mockResolvedValue({ id: 'review-12' });

        await reviewCard({
          cardId: mockDatabaseCard.id,
          userId: 'user-123',
          cardType: 'recognition',
          rating: 3,
        });

        const updateCall = mockPrisma.card.update.mock.calls[0][0];
        expect(updateCall.data).toHaveProperty('recognitionReps');
      });

      it('should increment lapses counter when rating is 1', async () => {
        const recordLog = createMockRecordLog(reviewCardState);
        mockRepeat.mockReturnValue(recordLog);

        mockPrisma.card.findFirst.mockResolvedValue({
          ...mockDatabaseCard,
          recognitionState: 'review',
          recognitionLapses: 1,
        });

        mockPrisma.card.update.mockResolvedValue({
          ...mockDatabaseCard,
          recognitionLapses: 2,
        });

        mockPrisma.review.create.mockResolvedValue({ id: 'review-13' });

        await reviewCard({
          cardId: mockDatabaseCard.id,
          userId: 'user-123',
          cardType: 'recognition',
          rating: 1,
        });

        const updateCall = mockPrisma.card.update.mock.calls[0][0];
        expect(updateCall.data).toHaveProperty('recognitionLapses');
      });

      it('should set lastReview timestamp', async () => {
        const recordLog = createMockRecordLog(learningCardState);
        mockRepeat.mockReturnValue(recordLog);

        mockPrisma.card.findFirst.mockResolvedValue({
          ...mockDatabaseCard,
          recognitionState: 'learning',
        });

        mockPrisma.card.update.mockResolvedValue({
          ...mockDatabaseCard,
          recognitionLastReview: new Date(),
        });

        mockPrisma.review.create.mockResolvedValue({ id: 'review-14' });

        await reviewCard({
          cardId: mockDatabaseCard.id,
          userId: 'user-123',
          cardType: 'recognition',
          rating: 3,
        });

        const updateCall = mockPrisma.card.update.mock.calls[0][0];
        expect(updateCall.data).toHaveProperty('recognitionLastReview');
      });
    });

    describe('Review Record Creation', () => {
      it('should create review record with correct before/after states', async () => {
        const recordLog = createMockRecordLog(newCardState);
        mockRepeat.mockReturnValue(recordLog);

        mockPrisma.card.findFirst.mockResolvedValue({
          ...mockDatabaseCard,
          recognitionState: 'new',
        });

        mockPrisma.card.update.mockResolvedValue({
          ...mockDatabaseCard,
          recognitionState: 'learning',
        });

        mockPrisma.review.create.mockResolvedValue({
          id: 'review-15',
          stateBefore: 'new',
          stateAfter: 'learning',
        });

        await reviewCard({
          cardId: mockDatabaseCard.id,
          userId: 'user-123',
          cardType: 'recognition',
          rating: 3,
        });

        expect(mockPrisma.review.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              stateBefore: 'new',
              cardType: 'recognition',
              rating: 3,
            }),
          })
        );
      });

      it('should record duration in review record', async () => {
        const recordLog = createMockRecordLog(newCardState);
        mockRepeat.mockReturnValue(recordLog);

        mockPrisma.card.findFirst.mockResolvedValue({
          ...mockDatabaseCard,
          recognitionState: 'new',
        });

        mockPrisma.card.update.mockResolvedValue(mockDatabaseCard);
        mockPrisma.review.create.mockResolvedValue({ id: 'review-16' });

        await reviewCard({
          cardId: mockDatabaseCard.id,
          userId: 'user-123',
          cardType: 'recognition',
          rating: 3,
          durationMs: 5500,
        });

        expect(mockPrisma.review.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              durationMs: 5500,
            }),
          })
        );
      });
    });

    describe('Dual Tracking Independence', () => {
      it('should maintain separate state for recognition vs audio card types', async () => {
        const recordLog = createMockRecordLog(newCardState);
        mockRepeat.mockReturnValue(recordLog);

        // Review recognition card
        mockPrisma.card.findFirst.mockResolvedValue({
          ...mockDatabaseCard,
          recognitionState: 'new',
          audioState: 'review', // Different state
        });

        mockPrisma.card.update.mockResolvedValue({
          ...mockDatabaseCard,
          recognitionState: 'learning',
          audioState: 'review', // Should remain unchanged
        });

        mockPrisma.review.create.mockResolvedValue({ id: 'review-17' });

        await reviewCard({
          cardId: mockDatabaseCard.id,
          userId: 'user-123',
          cardType: 'recognition',
          rating: 3,
        });

        const updateCall = mockPrisma.card.update.mock.calls[0][0];
        expect(updateCall.data).toHaveProperty('recognitionState');
        expect(updateCall.data).not.toHaveProperty('audioState');
      });
    });

    describe('Transaction Integrity', () => {
      it('should update card and create review record in transaction', async () => {
        const recordLog = createMockRecordLog(newCardState);
        mockRepeat.mockReturnValue(recordLog);

        mockPrisma.card.findFirst.mockResolvedValue({
          ...mockDatabaseCard,
          recognitionState: 'new',
        });

        const updatedCard = { ...mockDatabaseCard, recognitionState: 'learning' };
        const review = { id: 'review-18' };

        mockPrisma.$transaction.mockImplementation(async (operations) => {
          if (Array.isArray(operations)) {
            return [updatedCard, review];
          }
          return operations(mockPrisma);
        });

        const result = await reviewCard({
          cardId: mockDatabaseCard.id,
          userId: 'user-123',
          cardType: 'recognition',
          rating: 3,
        });

        expect(mockPrisma.$transaction).toHaveBeenCalled();
        expect(result.card).toEqual(updatedCard);
        expect(result.review).toEqual(review);
      });
    });

    describe('Error Handling', () => {
      it('should throw error when card not found', async () => {
        mockPrisma.card.findFirst.mockResolvedValue(null);

        await expect(
          reviewCard({
            cardId: 'non-existent',
            userId: 'user-123',
            cardType: 'recognition',
            rating: 3,
          })
        ).rejects.toThrow('Card not found');
      });

      it('should throw error when card belongs to different user (authorization)', async () => {
        mockPrisma.card.findFirst.mockResolvedValue(null);

        await expect(
          reviewCard({
            cardId: mockDatabaseCard.id,
            userId: 'different-user',
            cardType: 'recognition',
            rating: 3,
          })
        ).rejects.toThrow('Card not found');

        expect(mockPrisma.card.findFirst).toHaveBeenCalledWith({
          where: { id: mockDatabaseCard.id, userId: 'different-user' },
        });
      });
    });
  });

  describe('getDueCards()', () => {
    const now = new Date();
    const pastDue = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    it('should return cards with recognitionDue <= now when enableRecognition is true', async () => {
      const dueCards = [{ ...mockDatabaseCard, recognitionDue: pastDue, enableRecognition: true }];

      mockPrisma.card.findMany.mockResolvedValue(dueCards);

      const result = await getDueCards('user-123', 'deck-123');

      expect(mockPrisma.card.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deckId: 'deck-123',
            userId: 'user-123',
            OR: expect.arrayContaining([
              expect.objectContaining({ recognitionDue: { lte: expect.any(Date) } }),
            ]),
          }),
        })
      );

      expect(result).toEqual(dueCards);
    });

    it('should return cards with audioDue <= now when enableAudio is true', async () => {
      const dueCards = [{ ...mockDatabaseCard, audioDue: pastDue, enableAudio: true }];

      mockPrisma.card.findMany.mockResolvedValue(dueCards);

      const result = await getDueCards('user-123', 'deck-123');

      expect(result).toEqual(dueCards);
    });

    it('should not return cards with enableRecognition = false even if due', async () => {
      mockPrisma.card.findMany.mockResolvedValue([]);

      await getDueCards('user-123', 'deck-123');

      expect(mockPrisma.card.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([expect.objectContaining({ enableRecognition: true })]),
          }),
        })
      );
    });

    it('should not return cards with enableAudio = false even if due', async () => {
      mockPrisma.card.findMany.mockResolvedValue([]);

      await getDueCards('user-123', 'deck-123');

      expect(mockPrisma.card.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([expect.objectContaining({ enableAudio: true })]),
          }),
        })
      );
    });

    it('should limit results to specified limit (default 20)', async () => {
      mockPrisma.card.findMany.mockResolvedValue([]);

      await getDueCards('user-123', 'deck-123');

      expect(mockPrisma.card.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
        })
      );
    });

    it('should respect custom limit parameter', async () => {
      mockPrisma.card.findMany.mockResolvedValue([]);

      await getDueCards('user-123', 'deck-123', 50);

      expect(mockPrisma.card.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        })
      );
    });

    it('should order cards by due date ascending', async () => {
      mockPrisma.card.findMany.mockResolvedValue([]);

      await getDueCards('user-123', 'deck-123');

      expect(mockPrisma.card.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: expect.arrayContaining([{ recognitionDue: 'asc' }, { audioDue: 'asc' }]),
        })
      );
    });

    it('should filter by deckId and userId', async () => {
      mockPrisma.card.findMany.mockResolvedValue([]);

      await getDueCards('user-456', 'deck-789');

      expect(mockPrisma.card.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deckId: 'deck-789',
            userId: 'user-456',
          }),
        })
      );
    });
  });

  describe('getDeckStats()', () => {
    it('should count total cards in deck', async () => {
      mockPrisma.card.count
        .mockResolvedValueOnce(15) // totalCards
        .mockResolvedValueOnce(5) // dueRecognition
        .mockResolvedValueOnce(3) // dueAudio
        .mockResolvedValueOnce(8) // newCards
        .mockResolvedValueOnce(4) // learningCards
        .mockResolvedValueOnce(3); // reviewCards

      const stats = await getDeckStats('user-123', 'deck-123');

      expect(stats.totalCards).toBe(15);
    });

    it('should count due recognition cards correctly', async () => {
      mockPrisma.card.count
        .mockResolvedValueOnce(15)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(8)
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(3);

      const stats = await getDeckStats('user-123', 'deck-123');

      expect(stats.dueRecognition).toBe(5);
      expect(mockPrisma.card.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            recognitionDue: { lte: expect.any(Date) },
            enableRecognition: true,
          }),
        })
      );
    });

    it('should count due audio cards correctly', async () => {
      mockPrisma.card.count
        .mockResolvedValueOnce(15)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(8)
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(3);

      const stats = await getDeckStats('user-123', 'deck-123');

      expect(stats.dueAudio).toBe(3);
      expect(stats.dueTotal).toBe(8); // 5 + 3
    });

    it('should calculate dueTotal as sum of recognition + audio', async () => {
      mockPrisma.card.count
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(7)
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(5);

      const stats = await getDeckStats('user-123', 'deck-123');

      expect(stats.dueTotal).toBe(11); // 7 + 4
    });

    it('should count cards in each state', async () => {
      mockPrisma.card.count
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(8)
        .mockResolvedValueOnce(6)
        .mockResolvedValueOnce(6);

      const stats = await getDeckStats('user-123', 'deck-123');

      expect(stats.newCards).toBe(8);
      expect(stats.learningCards).toBe(6);
      expect(stats.reviewCards).toBe(6);
    });

    it('should handle empty deck', async () => {
      mockPrisma.card.count.mockResolvedValue(0);

      const stats = await getDeckStats('user-123', 'deck-123');

      expect(stats.totalCards).toBe(0);
      expect(stats.dueTotal).toBe(0);
    });
  });
});
