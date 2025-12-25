import { CoreItem } from './courseItemExtractor.js';

export interface DrillEvent {
  id: string;
  coreItemId: string;
  drillType: 'recall' | 'transform' | 'expand' | 'context' | 'roleplay';
  targetOffsetSeconds: number; // When this drill should occur
  coreItem: CoreItem;
}

export interface LessonSection {
  type: 'intro' | 'core_intro' | 'early_srs' | 'phrase_construction' |
        'dialogue_integration' | 'qa' | 'roleplay' | 'late_srs' | 'outro';
  title: string;
  targetDurationSeconds: number;
  coreItems?: CoreItem[]; // Items featured in this section
  drillEvents?: DrillEvent[]; // Scheduled drills for this section
}

export interface LessonPlan {
  lessonNumber: number;
  title: string;
  sections: LessonSection[];
  coreItems: CoreItem[];
  totalEstimatedDuration: number; // seconds
  drillEvents: DrillEvent[]; // All drills for this lesson
}

export interface CoursePlan {
  lessons: LessonPlan[];
  totalCoreItems: CoreItem[];
}

// SRS intervals in seconds (Pimsleur-style graduated recall)
const SRS_INTERVALS = [5, 15, 45, 120, 300]; // 5s, 15s, 45s, 2min, 5min

/**
 * Plan a complete course from core items and episode data
 * Splits into multiple lessons if needed to stay under maxLessonDurationMinutes
 */
export function planCourse(
  coreItems: CoreItem[],
  episodeTitle: string,
  maxLessonDurationMinutes: number = 30
): CoursePlan {
  const maxDurationSeconds = maxLessonDurationMinutes * 60;

  // For MVP: create a single lesson with all core items
  // Future: split intelligently across multiple lessons
  const lessonPlan = planSingleLesson(coreItems, episodeTitle, 1);

  // Check if we need to split
  if (lessonPlan.totalEstimatedDuration > maxDurationSeconds) {
    // Split into multiple lessons
    return splitIntoMultipleLessons(coreItems, episodeTitle, maxDurationSeconds);
  }

  return {
    lessons: [lessonPlan],
    totalCoreItems: coreItems,
  };
}

/**
 * Plan a single lesson with all 9 sections
 */
function planSingleLesson(
  coreItems: CoreItem[],
  episodeTitle: string,
  lessonNumber: number
): LessonPlan {
  const sections: LessonSection[] = [];
  let currentTime = 0;

  // 1. INTRO (2 minutes)
  sections.push({
    type: 'intro',
    title: 'Introduction',
    targetDurationSeconds: 120,
  });
  currentTime += 120;

  // 2. CORE VOCABULARY INTRO (1.5 min per item for first 5 items)
  const introItems = coreItems.slice(0, Math.min(5, coreItems.length));
  const coreIntroDuration = introItems.length * 90; // 1.5 min per item
  sections.push({
    type: 'core_intro',
    title: 'Core Vocabulary',
    targetDurationSeconds: coreIntroDuration,
    coreItems: introItems,
  });
  currentTime += coreIntroDuration;

  // 3. EARLY SRS (30 seconds per item)
  const earlySrsDuration = introItems.length * 30;
  sections.push({
    type: 'early_srs',
    title: 'Early Practice',
    targetDurationSeconds: earlySrsDuration,
    coreItems: introItems,
  });
  currentTime += earlySrsDuration;

  // 4. PHRASE CONSTRUCTION (2 minutes)
  sections.push({
    type: 'phrase_construction',
    title: 'Building Phrases',
    targetDurationSeconds: 120,
    coreItems: coreItems.slice(0, 3),
  });
  currentTime += 120;

  // 5. DIALOGUE INTEGRATION (3 minutes)
  sections.push({
    type: 'dialogue_integration',
    title: 'Conversation Practice',
    targetDurationSeconds: 180,
    coreItems: coreItems.slice(0, Math.min(8, coreItems.length)),
  });
  currentTime += 180;

  // 6. Q/A DRILLS (3 minutes)
  sections.push({
    type: 'qa',
    title: 'Question & Answer',
    targetDurationSeconds: 180,
    coreItems: coreItems.slice(0, 5),
  });
  currentTime += 180;

  // 7. ROLE-PLAY (4 minutes)
  sections.push({
    type: 'roleplay',
    title: 'Role Play',
    targetDurationSeconds: 240,
    coreItems: coreItems.slice(0, Math.min(8, coreItems.length)),
  });
  currentTime += 240;

  // 8. LATE SRS & REVIEW (5 minutes)
  sections.push({
    type: 'late_srs',
    title: 'Review',
    targetDurationSeconds: 300,
    coreItems,
  });
  currentTime += 300;

  // 9. OUTRO (1 minute)
  sections.push({
    type: 'outro',
    title: 'Conclusion',
    targetDurationSeconds: 60,
  });
  currentTime += 60;

  // Schedule SRS drill events
  const drillEvents = scheduleSRSDrills(coreItems, sections);

  return {
    lessonNumber,
    title: `${episodeTitle} - Lesson ${lessonNumber}`,
    sections,
    coreItems,
    totalEstimatedDuration: currentTime,
    drillEvents,
  };
}

/**
 * Schedule SRS drill events for core items across the lesson
 * Each item gets drilled at intervals: +5s, +15s, +45s, +2min, +5min
 */
function scheduleSRSDrills(
  coreItems: CoreItem[],
  sections: LessonSection[]
): DrillEvent[] {
  const drillEvents: DrillEvent[] = [];
  const currentOffset = 0;

  // Track when each item is introduced
  const itemIntroTimes = new Map<string, number>();

  // Calculate intro time for each item (during core_intro section)
  const coreIntroSection = sections.find(s => s.type === 'core_intro');
  if (coreIntroSection && coreIntroSection.coreItems) {
    coreIntroSection.coreItems.forEach((item, index) => {
      // Each item gets ~90 seconds during intro
      const introTime = sections[0].targetDurationSeconds + (index * 90);
      itemIntroTimes.set(item.id, introTime);
    });
  }

  // Schedule drills for each core item
  coreItems.forEach((item, itemIndex) => {
    const introTime = itemIntroTimes.get(item.id) || 0;

    SRS_INTERVALS.forEach((interval, intervalIndex) => {
      const targetTime = introTime + interval;

      // Determine drill type based on interval
      let drillType: DrillEvent['drillType'];
      if (intervalIndex === 0) {
        drillType = 'recall'; // First recall is simple
      } else if (intervalIndex === 1) {
        drillType = 'recall';
      } else if (intervalIndex === 2) {
        drillType = 'transform'; // Transform or modify the phrase
      } else if (intervalIndex === 3) {
        drillType = 'context'; // Use in different context
      } else {
        drillType = 'expand'; // Expand into longer phrase
      }

      drillEvents.push({
        id: `drill-${item.id}-${intervalIndex}`,
        coreItemId: item.id,
        drillType,
        targetOffsetSeconds: targetTime,
        coreItem: item,
      });
    });
  });

  // Sort by target time
  drillEvents.sort((a, b) => a.targetOffsetSeconds - b.targetOffsetSeconds);

  return drillEvents;
}

/**
 * Split core items into multiple lessons if duration exceeds max
 * Strategy: divide items evenly, ensure each lesson has intro/outro
 */
function splitIntoMultipleLessons(
  coreItems: CoreItem[],
  episodeTitle: string,
  maxDurationSeconds: number
): CoursePlan {
  // Estimate items per lesson based on duration
  const estimatedDurationPerItem = 180; // ~3 minutes per core item (rough estimate)
  const lessonOverheadSeconds = 600; // Intro + outro + transitions
  const itemsPerLesson = Math.floor((maxDurationSeconds - lessonOverheadSeconds) / estimatedDurationPerItem);

  const lessons: LessonPlan[] = [];
  let lessonNumber = 1;

  for (let i = 0; i < coreItems.length; i += itemsPerLesson) {
    const lessonItems = coreItems.slice(i, i + itemsPerLesson);
    const lessonPlan = planSingleLesson(lessonItems, episodeTitle, lessonNumber);
    lessons.push(lessonPlan);
    lessonNumber++;
  }

  return {
    lessons,
    totalCoreItems: coreItems,
  };
}

/**
 * Estimate total lesson duration based on sections and content
 * More accurate than simple sum of section durations
 */
export function estimateLessonDuration(lessonPlan: LessonPlan): number {
  // Start with section durations
  let total = lessonPlan.sections.reduce((sum, s) => sum + s.targetDurationSeconds, 0);

  // Add time for SRS drills (they're injected between sections)
  // Each drill adds ~10-15 seconds (prompt + pause + answer + feedback)
  const drillOverhead = lessonPlan.drillEvents.length * 12;
  total += drillOverhead;

  return total;
}
