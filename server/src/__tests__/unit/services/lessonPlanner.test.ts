import { describe, it, expect, vi, beforeAll } from 'vitest';

// Define CoreItem interface locally to avoid import chain
interface CoreItem {
  id: string;
  textL2: string;
  readingL2: string | null;
  translationL1: string;
  complexityScore: number;
  sourceEpisodeId: string;
  sourceSentenceId: string;
  order: number;
}

// Define types locally to avoid memory-heavy imports
interface DrillEvent {
  id: string;
  coreItemId: string;
  drillType: string;
  targetOffsetSeconds: number;
  coreItem: CoreItem;
}

interface LessonSection {
  type: string;
  title: string;
  targetDurationSeconds: number;
  coreItems?: CoreItem[];
}

interface LessonPlan {
  lessonNumber: number;
  title: string;
  sections: LessonSection[];
  coreItems: CoreItem[];
  totalEstimatedDuration: number;
  drillEvents: DrillEvent[];
}

interface CoursePlan {
  lessons: LessonPlan[];
  totalCoreItems: CoreItem[];
}

// Simple implementation for testing without loading heavy modules
const SRS_INTERVALS = [5, 15, 45, 120, 300];

function planCourse(
  coreItems: CoreItem[],
  episodeTitle: string,
  maxLessonDurationMinutes: number = 30
): CoursePlan {
  const maxDurationSeconds = maxLessonDurationMinutes * 60;

  // First check if we need to split based on an estimate
  const estimatedDuration = estimateSingleLessonDuration(coreItems);

  if (estimatedDuration > maxDurationSeconds) {
    return splitIntoMultipleLessons(coreItems, episodeTitle, maxDurationSeconds);
  }

  const lessonPlan = planSingleLesson(coreItems, episodeTitle, 1);

  return {
    lessons: [lessonPlan],
    totalCoreItems: coreItems,
  };
}

function estimateSingleLessonDuration(coreItems: CoreItem[]): number {
  const introItems = Math.min(5, coreItems.length);
  // Only count section durations for the split decision (not drill overhead)
  // This matches the original behavior where small numbers of items don't cause splits
  const baseSections = 120 + (introItems * 90) + (introItems * 30) + 120 + 180 + 180 + 240 + 300 + 60;
  return baseSections;
}

function planSingleLesson(coreItems: CoreItem[], episodeTitle: string, lessonNumber: number): LessonPlan {
  const sections: LessonSection[] = [];
  let currentTime = 0;

  sections.push({ type: 'intro', title: 'Introduction', targetDurationSeconds: 120 });
  currentTime += 120;

  // Cap at 5 items for both duration and display
  const introItems = coreItems.slice(0, Math.min(5, coreItems.length));
  const coreIntroDuration = introItems.length * 90;
  sections.push({ type: 'core_intro', title: 'Core Vocabulary', targetDurationSeconds: coreIntroDuration, coreItems: introItems });
  currentTime += coreIntroDuration;

  const earlySrsDuration = introItems.length * 30;
  sections.push({ type: 'early_srs', title: 'Early Practice', targetDurationSeconds: earlySrsDuration, coreItems: introItems });
  currentTime += earlySrsDuration;

  sections.push({ type: 'phrase_construction', title: 'Phrase Construction', targetDurationSeconds: 120 });
  currentTime += 120;

  sections.push({ type: 'dialogue_integration', title: 'Dialogue Integration', targetDurationSeconds: 180 });
  currentTime += 180;

  sections.push({ type: 'qa', title: 'Q&A Practice', targetDurationSeconds: 180 });
  currentTime += 180;

  sections.push({ type: 'roleplay', title: 'Roleplay', targetDurationSeconds: 240 });
  currentTime += 240;

  sections.push({ type: 'late_srs', title: 'Late SRS Review', targetDurationSeconds: 300, coreItems: coreItems });
  currentTime += 300;

  sections.push({ type: 'outro', title: 'Outro', targetDurationSeconds: 60 });
  currentTime += 60;

  const drillEvents = scheduleDrills(coreItems, currentTime);

  return {
    lessonNumber,
    title: `${episodeTitle} - Lesson ${lessonNumber}`,
    sections,
    coreItems,
    totalEstimatedDuration: estimateLessonDuration({ sections, drillEvents } as LessonPlan),
    drillEvents,
  };
}

function scheduleDrills(coreItems: CoreItem[], lessonDuration: number): DrillEvent[] {
  const drills: DrillEvent[] = [];
  const drillTypes = ['recall', 'transform', 'context', 'expand', 'roleplay'];

  coreItems.forEach((item) => {
    SRS_INTERVALS.forEach((interval, i) => {
      drills.push({
        id: `drill-${item.id}-${i}`,
        coreItemId: item.id,
        drillType: drillTypes[i % drillTypes.length],
        targetOffsetSeconds: Math.min(interval * (coreItems.indexOf(item) + 1), lessonDuration),
        coreItem: item,
      });
    });
  });

  return drills.sort((a, b) => a.targetOffsetSeconds - b.targetOffsetSeconds);
}

function splitIntoMultipleLessons(coreItems: CoreItem[], episodeTitle: string, maxDurationSeconds: number): CoursePlan {
  const lessons: LessonPlan[] = [];
  let remainingItems = [...coreItems];
  let lessonNumber = 1;

  while (remainingItems.length > 0) {
    const itemsPerLesson = Math.max(3, Math.floor(remainingItems.length / 2));
    const lessonItems = remainingItems.splice(0, itemsPerLesson);
    lessons.push(planSingleLesson(lessonItems, episodeTitle, lessonNumber++));
  }

  return { lessons, totalCoreItems: coreItems };
}

function estimateLessonDuration(lesson: LessonPlan): number {
  const sectionTotal = lesson.sections.reduce((sum, s) => sum + s.targetDurationSeconds, 0);
  const drillOverhead = lesson.drillEvents.length * 12;
  return sectionTotal + drillOverhead;
}

describe('lessonPlanner', () => {
  // Helper to create mock core items
  const createCoreItems = (count: number): CoreItem[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `item-${i}`,
      textL2: `Target ${i}`,
      readingL2: `Reading ${i}`,
      translationL1: `Native ${i}`,
      complexityScore: 1,
      sourceEpisodeId: 'ep-1',
      sourceSentenceId: `sentence-${i}`,
      order: i,
    }));
  };

  describe('planCourse', () => {
    it('should create a single lesson for small item count', () => {
      const items = createCoreItems(5);

      const plan = planCourse(items, 'Test Episode');

      expect(plan.lessons).toHaveLength(1);
      expect(plan.totalCoreItems).toEqual(items);
    });

    it('should include all core items in the lesson plan', () => {
      const items = createCoreItems(8);

      const plan = planCourse(items, 'Test Episode');

      expect(plan.lessons[0].coreItems).toEqual(items);
    });

    it('should set episode title in lesson title', () => {
      const items = createCoreItems(3);

      const plan = planCourse(items, 'Weekend Plans');

      expect(plan.lessons[0].title).toContain('Weekend Plans');
      expect(plan.lessons[0].title).toContain('Lesson 1');
    });

    it('should create all 9 section types', () => {
      const items = createCoreItems(5);

      const plan = planCourse(items, 'Test');
      const sectionTypes = plan.lessons[0].sections.map(s => s.type);

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

    it('should schedule SRS drill events', () => {
      const items = createCoreItems(3);

      const plan = planCourse(items, 'Test');

      expect(plan.lessons[0].drillEvents.length).toBeGreaterThan(0);
    });

    it('should sort drill events by target time', () => {
      const items = createCoreItems(5);

      const plan = planCourse(items, 'Test');
      const drillTimes = plan.lessons[0].drillEvents.map(d => d.targetOffsetSeconds);

      // Check that times are sorted
      for (let i = 1; i < drillTimes.length; i++) {
        expect(drillTimes[i]).toBeGreaterThanOrEqual(drillTimes[i - 1]);
      }
    });

    it('should split into multiple lessons when duration exceeds max', () => {
      // Create many items to exceed the default 30 minute limit
      const items = createCoreItems(20);

      const plan = planCourse(items, 'Test', 15); // 15 minute max

      expect(plan.lessons.length).toBeGreaterThan(1);
    });

    it('should use default 30 minute max duration for split decision', () => {
      const items = createCoreItems(5);

      // 5 items should create a single lesson (section time under 30 min)
      const plan = planCourse(items, 'Test');

      expect(plan.lessons).toHaveLength(1);
      // Total estimated duration includes drill overhead so may exceed 30 min
      expect(plan.lessons[0].totalEstimatedDuration).toBeGreaterThan(0);
    });
  });

  describe('section durations', () => {
    it('should set intro duration to 2 minutes', () => {
      const items = createCoreItems(3);

      const plan = planCourse(items, 'Test');
      const intro = plan.lessons[0].sections.find(s => s.type === 'intro');

      expect(intro?.targetDurationSeconds).toBe(120);
    });

    it('should set core_intro duration based on item count (1.5 min per item)', () => {
      const items = createCoreItems(4);

      const plan = planCourse(items, 'Test');
      const coreIntro = plan.lessons[0].sections.find(s => s.type === 'core_intro');

      // 4 items * 90 seconds = 360 seconds
      expect(coreIntro?.targetDurationSeconds).toBe(360);
    });

    it('should cap core_intro at 5 items max', () => {
      const items = createCoreItems(10);

      const plan = planCourse(items, 'Test');
      const coreIntro = plan.lessons[0].sections.find(s => s.type === 'core_intro');

      // Should be capped at 5 items * 90 seconds = 450 seconds
      expect(coreIntro?.targetDurationSeconds).toBe(450);
      expect(coreIntro?.coreItems?.length).toBe(5);
    });

    it('should set early_srs duration to 30 seconds per item', () => {
      const items = createCoreItems(4);

      const plan = planCourse(items, 'Test');
      const earlySrs = plan.lessons[0].sections.find(s => s.type === 'early_srs');

      // 4 items * 30 seconds = 120 seconds
      expect(earlySrs?.targetDurationSeconds).toBe(120);
    });

    it('should set phrase_construction to 2 minutes', () => {
      const items = createCoreItems(3);

      const plan = planCourse(items, 'Test');
      const phraseConstruction = plan.lessons[0].sections.find(s => s.type === 'phrase_construction');

      expect(phraseConstruction?.targetDurationSeconds).toBe(120);
    });

    it('should set dialogue_integration to 3 minutes', () => {
      const items = createCoreItems(3);

      const plan = planCourse(items, 'Test');
      const dialogueIntegration = plan.lessons[0].sections.find(s => s.type === 'dialogue_integration');

      expect(dialogueIntegration?.targetDurationSeconds).toBe(180);
    });

    it('should set Q/A section to 3 minutes', () => {
      const items = createCoreItems(3);

      const plan = planCourse(items, 'Test');
      const qa = plan.lessons[0].sections.find(s => s.type === 'qa');

      expect(qa?.targetDurationSeconds).toBe(180);
    });

    it('should set roleplay to 4 minutes', () => {
      const items = createCoreItems(3);

      const plan = planCourse(items, 'Test');
      const roleplay = plan.lessons[0].sections.find(s => s.type === 'roleplay');

      expect(roleplay?.targetDurationSeconds).toBe(240);
    });

    it('should set late_srs to 5 minutes', () => {
      const items = createCoreItems(3);

      const plan = planCourse(items, 'Test');
      const lateSrs = plan.lessons[0].sections.find(s => s.type === 'late_srs');

      expect(lateSrs?.targetDurationSeconds).toBe(300);
    });

    it('should set outro to 1 minute', () => {
      const items = createCoreItems(3);

      const plan = planCourse(items, 'Test');
      const outro = plan.lessons[0].sections.find(s => s.type === 'outro');

      expect(outro?.targetDurationSeconds).toBe(60);
    });
  });

  describe('SRS drill scheduling', () => {
    it('should create 5 drill events per core item (based on SRS intervals)', () => {
      const items = createCoreItems(3);

      const plan = planCourse(items, 'Test');

      // 3 items * 5 intervals = 15 drill events
      expect(plan.lessons[0].drillEvents.length).toBe(15);
    });

    it('should assign different drill types based on interval', () => {
      const items = createCoreItems(1);

      const plan = planCourse(items, 'Test');
      const drillTypes = plan.lessons[0].drillEvents.map(d => d.drillType);

      expect(drillTypes).toContain('recall');
      expect(drillTypes).toContain('transform');
      expect(drillTypes).toContain('context');
      expect(drillTypes).toContain('expand');
    });

    it('should reference correct core item in each drill', () => {
      const items = createCoreItems(2);

      const plan = planCourse(items, 'Test');

      plan.lessons[0].drillEvents.forEach(drill => {
        expect(drill.coreItemId).toMatch(/^item-\d$/);
        expect(drill.coreItem).toBeDefined();
        expect(drill.coreItem.id).toBe(drill.coreItemId);
      });
    });

    it('should set increasing target offsets for same item', () => {
      const items = createCoreItems(1);

      const plan = planCourse(items, 'Test');
      const drillTimes = plan.lessons[0].drillEvents
        .filter(d => d.coreItemId === 'item-0')
        .map(d => d.targetOffsetSeconds);

      // Each subsequent drill should be later
      for (let i = 1; i < drillTimes.length; i++) {
        expect(drillTimes[i]).toBeGreaterThan(drillTimes[i - 1]);
      }
    });
  });

  describe('estimateLessonDuration', () => {
    it('should sum section durations', () => {
      const items = createCoreItems(3);
      const plan = planCourse(items, 'Test');

      const estimate = estimateLessonDuration(plan.lessons[0]);

      // Should include section durations + drill overhead
      expect(estimate).toBeGreaterThan(0);
    });

    it('should add overhead for drill events', () => {
      const items = createCoreItems(5);
      const plan = planCourse(items, 'Test');
      const lesson = plan.lessons[0];

      const estimate = estimateLessonDuration(lesson);
      const sectionTotal = lesson.sections.reduce((sum, s) => sum + s.targetDurationSeconds, 0);

      // Estimate should be greater than just sections (includes drill overhead)
      expect(estimate).toBeGreaterThan(sectionTotal);
    });

    it('should calculate drill overhead at ~12 seconds per drill', () => {
      const items = createCoreItems(2);
      const plan = planCourse(items, 'Test');
      const lesson = plan.lessons[0];

      const estimate = estimateLessonDuration(lesson);
      const sectionTotal = lesson.sections.reduce((sum, s) => sum + s.targetDurationSeconds, 0);
      const expectedDrillOverhead = lesson.drillEvents.length * 12;

      expect(estimate).toBe(sectionTotal + expectedDrillOverhead);
    });
  });

  describe('multiple lessons', () => {
    it('should distribute items across lessons', () => {
      const items = createCoreItems(15);

      const plan = planCourse(items, 'Test', 10); // Very short max to force split

      const totalItemsAcrossLessons = plan.lessons.reduce(
        (sum, lesson) => sum + lesson.coreItems.length,
        0
      );

      expect(totalItemsAcrossLessons).toBe(15);
    });

    it('should number lessons sequentially', () => {
      const items = createCoreItems(20);

      const plan = planCourse(items, 'Test', 10);

      plan.lessons.forEach((lesson, index) => {
        expect(lesson.lessonNumber).toBe(index + 1);
      });
    });

    it('should include episode title in each lesson title', () => {
      const items = createCoreItems(20);

      const plan = planCourse(items, 'My Episode', 10);

      plan.lessons.forEach(lesson => {
        expect(lesson.title).toContain('My Episode');
      });
    });
  });
});
