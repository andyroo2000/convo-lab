/**
 * Timing data fixtures for testing audio extraction
 * Timing data maps script units to their position in the concatenated audio file
 */

export interface TimingDataUnit {
  unitIndex: number;
  startTime: number; // milliseconds
  endTime: number; // milliseconds
}

/**
 * Sample timing data for a typical lesson
 * Represents a ~30 second lesson with multiple units and pauses
 */
export const sampleTimingData: TimingDataUnit[] = [
  { unitIndex: 0, startTime: 0, endTime: 2000 }, // 0-2s: Intro
  { unitIndex: 1, startTime: 2000, endTime: 4500 }, // 2-4.5s: Japanese word
  { unitIndex: 2, startTime: 4500, endTime: 7000 }, // 4.5-7s: Translation
  { unitIndex: 3, startTime: 7000, endTime: 8000 }, // 7-8s: Pause
  { unitIndex: 4, startTime: 8000, endTime: 10500 }, // 8-10.5s: Example sentence
  { unitIndex: 5, startTime: 10500, endTime: 13000 }, // 10.5-13s: Translation
  { unitIndex: 6, startTime: 13000, endTime: 14000 }, // 13-14s: Pause
  { unitIndex: 7, startTime: 14000, endTime: 16500 }, // 14-16.5s: Vocab word
  { unitIndex: 8, startTime: 16500, endTime: 19000 }, // 16.5-19s: Translation
  { unitIndex: 9, startTime: 19000, endTime: 22000 }, // 19-22s: Example
  { unitIndex: 10, startTime: 22000, endTime: 25000 }, // 22-25s: Translation
  { unitIndex: 11, startTime: 25000, endTime: 26000 }, // 25-26s: Pause
  { unitIndex: 12, startTime: 26000, endTime: 29000 }, // 26-29s: Closing
];

/**
 * Minimal timing data for edge case testing
 */
export const minimalTimingData: TimingDataUnit[] = [
  { unitIndex: 0, startTime: 0, endTime: 1500 },
  { unitIndex: 1, startTime: 1500, endTime: 3000 },
];

/**
 * Long lesson timing data (~5 minutes)
 */
export const longLessonTimingData: TimingDataUnit[] = Array.from({ length: 100 }, (_, i) => ({
  unitIndex: i,
  startTime: i * 3000,
  endTime: (i + 1) * 3000,
}));

/**
 * Timing data with very short segments (< 1 second)
 */
export const shortSegmentTimingData: TimingDataUnit[] = [
  { unitIndex: 0, startTime: 0, endTime: 500 }, // 0.5s
  { unitIndex: 1, startTime: 500, endTime: 800 }, // 0.3s
  { unitIndex: 2, startTime: 800, endTime: 1100 }, // 0.3s
];

/**
 * Sample script JSON matching the timing data
 */
export const sampleScriptJson = [
  { type: 'intro', text: 'Welcome to the lesson', voiceId: 'en-US-Neural2-D' },
  { type: 'word', textL2: 'こんにちは', readingL2: 'こんにちは', voiceId: 'ja-JP-Neural2-B' },
  { type: 'translation', text: 'hello', voiceId: 'en-US-Neural2-D' },
  { type: 'pause', seconds: 1 },
  {
    type: 'sentence',
    textL2: 'こんにちは、田中さん',
    readingL2: 'こんにちは、田中[たなか]さん',
    voiceId: 'ja-JP-Neural2-B',
  },
  { type: 'translation', text: 'Hello, Mr. Tanaka', voiceId: 'en-US-Neural2-D' },
  { type: 'pause', seconds: 1 },
  { type: 'word', textL2: 'ありがとう', readingL2: 'ありがとう', voiceId: 'ja-JP-Neural2-B' },
  { type: 'translation', text: 'thank you', voiceId: 'en-US-Neural2-D' },
  {
    type: 'sentence',
    textL2: 'ありがとうございます',
    readingL2: 'ありがとうございます',
    voiceId: 'ja-JP-Neural2-B',
  },
  { type: 'translation', text: 'Thank you very much', voiceId: 'en-US-Neural2-D' },
  { type: 'pause', seconds: 1 },
  { type: 'outro', text: 'Great job!', voiceId: 'en-US-Neural2-D' },
];

/**
 * Mock course with timing data
 */
export const mockCourseWithTimingData = {
  id: 'course-123',
  userId: 'user-123',
  targetLanguage: 'ja',
  title: 'Test Lesson',
  description: 'Test description',
  audioUrl: 'https://storage.googleapis.com/test-bucket/course-123.mp3',
  scriptJson: sampleScriptJson,
  timingData: sampleTimingData,
  status: 'completed' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * Mock CourseCoreItem for testing
 */
export const mockCourseCoreItem = {
  id: 'item-123',
  courseId: 'course-123',
  textL2: 'こんにちは',
  readingL2: 'こんにちは',
  translationL1: 'hello',
  sourceUnitIndex: 1, // Points to unit index 1 in timing data
  sourceSentenceId: null,
  sourceEpisodeId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  course: mockCourseWithTimingData,
};

/**
 * Mock CourseCoreItem without sourceUnitIndex (legacy)
 */
export const mockLegacyCourseCoreItem = {
  id: 'item-legacy',
  courseId: 'course-123',
  textL2: '食べる',
  readingL2: '食[た]べる',
  translationL1: 'to eat',
  sourceUnitIndex: null,
  sourceSentenceId: 'sentence-456',
  sourceEpisodeId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

/**
 * Corrupt/invalid timing data for error testing
 */
export const corruptTimingData = [
  { unitIndex: 0, startTime: 0, endTime: 2000 },
  { unitIndex: 1, startTime: 2000 }, // Missing endTime
  { unitIndex: 2, startTime: 'invalid', endTime: 5000 }, // Invalid type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
] as any;

/**
 * Out of bounds scenarios
 */
export const outOfBoundsScenarios = {
  // sourceUnitIndex exceeds timing data array length
  tooHighIndex: {
    sourceUnitIndex: 999,
    timingData: sampleTimingData,
  },
  // Negative index
  negativeIndex: {
    sourceUnitIndex: -1,
    timingData: sampleTimingData,
  },
  // Empty timing data
  emptyTimingData: {
    sourceUnitIndex: 0,
    timingData: [],
  },
};
