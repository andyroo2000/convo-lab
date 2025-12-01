import { describe, it, expect, vi } from 'vitest';

// Mock the courseItemExtractor to avoid its heavy dependencies (Prisma, Gemini)
vi.mock('../../../services/courseItemExtractor.js', () => ({
  CoreItem: {},
  extractCoreItems: vi.fn(),
  extractDialogueExchanges: vi.fn(),
}));

import { planCourse, estimateLessonDuration } from '../../../services/coursePlanner.js';

// Define CoreItem interface locally
interface CoreItem {
  id: string;
  textL2: string;
  readingL2: string | null;
  translationL1: string;
  complexityScore: number;
  sourceEpisodeId: string;
  sourceSentenceId: string;
  order: number;
  components?: any[];
}

// Factory function to create mock core items
function createMockCoreItem(id: string): CoreItem {
  return {
    id,
    textL2: `Phrase ${id}`,
    readingL2: `Reading ${id}`,
    translationL1: `Native ${id}`,
    complexityScore: 10,
    sourceEpisodeId: 'episode-1',
    sourceSentenceId: `sentence-${id}`,
    order: 0,
    components: [],
  };
}

function createMockCoreItems(count: number): CoreItem[] {
  return Array.from({ length: count }, (_, i) => createMockCoreItem(`item-${i + 1}`));
}

describe('coursePlanner', () => {
  describe('planCourse', () => {
    it('should create a course with a single lesson for few items', () => {
      const coreItems = createMockCoreItems(3);
      const course = planCourse(coreItems, 'Test Episode');

      expect(course.lessons).toHaveLength(1);
      expect(course.totalCoreItems).toEqual(coreItems);
    });

    it('should set correct lesson title', () => {
      const coreItems = createMockCoreItems(3);
      const course = planCourse(coreItems, 'Shopping Dialogue');

      expect(course.lessons[0].title).toBe('Shopping Dialogue - Lesson 1');
    });

    it('should include all 9 required sections', () => {
      const coreItems = createMockCoreItems(3);
      const course = planCourse(coreItems, 'Test');
      const lesson = course.lessons[0];

      const sectionTypes = lesson.sections.map(s => s.type);
      expect(sectionTypes).toContain('intro');
      expect(sectionTypes).toContain('core_intro');
      expect(sectionTypes).toContain('early_srs');
      expect(sectionTypes).toContain('phrase_construction');
      expect(sectionTypes).toContain('dialogue_integration');
      expect(sectionTypes).toContain('qa');
      expect(sectionTypes).toContain('roleplay');
      expect(sectionTypes).toContain('late_srs');
      expect(sectionTypes).toContain('outro');
    });

    it('should create drill events for each core item', () => {
      const coreItems = createMockCoreItems(2);
      const course = planCourse(coreItems, 'Test');
      const lesson = course.lessons[0];

      // Each item should have 5 drills (one per SRS interval)
      expect(lesson.drillEvents.length).toBe(10); // 2 items * 5 intervals
    });

    it('should sort drill events by target time', () => {
      const coreItems = createMockCoreItems(3);
      const course = planCourse(coreItems, 'Test');
      const drillEvents = course.lessons[0].drillEvents;

      for (let i = 1; i < drillEvents.length; i++) {
        expect(drillEvents[i].targetOffsetSeconds).toBeGreaterThanOrEqual(
          drillEvents[i - 1].targetOffsetSeconds
        );
      }
    });
  });

  describe('estimateLessonDuration', () => {
    it('should include section durations in estimate', () => {
      const coreItems = createMockCoreItems(3);
      const course = planCourse(coreItems, 'Test');
      const lesson = course.lessons[0];

      const sectionTotal = lesson.sections.reduce((sum, s) => sum + s.targetDurationSeconds, 0);
      const estimate = estimateLessonDuration(lesson);

      expect(estimate).toBeGreaterThanOrEqual(sectionTotal);
    });
  });
});
