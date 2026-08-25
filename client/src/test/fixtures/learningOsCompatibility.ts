import dailyAudioFixtureJson from './learning-os/Compatibility/daily-audio-practice-v1.json';
import googleCalendarFixtureJson from './learning-os/Compatibility/google-calendar-connection-v1.json';
import weeklyRecapFixtureJson from './learning-os/Compatibility/personal-weekly-recap-v1.json';
import studyAnalyticsFixtureJson from './learning-os/Compatibility/study-activity-analytics-v1.json';
import studyCardFixtureJson from './learning-os/Compatibility/study-card-summary-v1.json';

export interface LearningOsCompatibilityCase {
  id: string;
  description: string;
  payload: unknown;
}

export interface LearningOsCompatibilityFixture {
  schemaVersion: number;
  contract: {
    id: string;
    producer: string;
    canonicalRepository: string;
  };
  cases: LearningOsCompatibilityCase[];
}

export const studyCardCompatibilityFixture = studyCardFixtureJson as LearningOsCompatibilityFixture;
export const googleCalendarCompatibilityFixture =
  googleCalendarFixtureJson as LearningOsCompatibilityFixture;
export const studyAnalyticsCompatibilityFixture =
  studyAnalyticsFixtureJson as LearningOsCompatibilityFixture;
export const dailyAudioCompatibilityFixture =
  dailyAudioFixtureJson as LearningOsCompatibilityFixture;
export const weeklyRecapCompatibilityFixture =
  weeklyRecapFixtureJson as LearningOsCompatibilityFixture;

export const learningOsCompatibilityFixtures = [
  studyCardCompatibilityFixture,
  googleCalendarCompatibilityFixture,
  studyAnalyticsCompatibilityFixture,
  dailyAudioCompatibilityFixture,
  weeklyRecapCompatibilityFixture,
] as const;
