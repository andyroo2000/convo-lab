import {
  STUDY_MILESTONE_DEFINITIONS,
  type StudyMilestoneAward,
  type StudyMilestoneId,
  type StudyMilestoneSnapshot,
} from '../components/study/studyMilestoneModel';
import { requestJson } from './apiClient';
import { studyApiPath } from './studyApi';

const knownMilestoneIds = new Set<StudyMilestoneId>(
  STUDY_MILESTONE_DEFINITIONS.map(({ id }) => id)
);

const decodeAward = (value: unknown): StudyMilestoneAward => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Milestone response contained an invalid award.');
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== 'string' ||
    !knownMilestoneIds.has(record.id as StudyMilestoneId) ||
    typeof record.earnedAt !== 'string' ||
    (typeof record.presentedAt !== 'string' && record.presentedAt !== null)
  ) {
    throw new Error('Milestone response contained an invalid award.');
  }

  return {
    id: record.id as StudyMilestoneId,
    earnedAt: record.earnedAt,
    presentedAt: record.presentedAt,
  };
};

export const evaluateStudyMilestones = async (): Promise<StudyMilestoneSnapshot> => {
  const response = await requestJson<unknown>(studyApiPath('/milestones/evaluate'), {
    method: 'POST',
  });
  if (typeof response !== 'object' || response === null || Array.isArray(response)) {
    throw new Error('Milestone response was invalid.');
  }

  const record = response as Record<string, unknown>;
  if (!Array.isArray(record.milestones) || !Array.isArray(record.pendingMilestones)) {
    throw new Error('Milestone response was invalid.');
  }

  return {
    milestones: record.milestones.map(decodeAward),
    pendingMilestones: record.pendingMilestones.map(decodeAward),
  };
};

export const presentStudyMilestones = async (milestoneIds: StudyMilestoneId[]): Promise<void> => {
  if (milestoneIds.length === 0) return;

  await requestJson<void>(
    studyApiPath('/milestones/present'),
    {
      method: 'POST',
      body: JSON.stringify({ milestoneIds }),
    },
    { acceptedEmptyStatuses: [204] }
  );
};
