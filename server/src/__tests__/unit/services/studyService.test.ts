import { describe, expect, it } from 'vitest';

import * as studyMediaService from '../../../services/studyMediaService.js';
import * as studySchedulerService from '../../../services/studySchedulerService.js';
import * as studyService from '../../../services/studyService.js';

describe('studyService barrel', () => {
  it('re-exports media functions from the media service', () => {
    expect(studyService.getStudyMediaAccess).toBe(studyMediaService.getStudyMediaAccess);
    expect(studyService.prepareStudyCardAnswerAudio).toBe(
      studyMediaService.prepareStudyCardAnswerAudio
    );
  });

  it('re-exports scheduler functions from the scheduler service', () => {
    expect(studyService.getStudyOverview).toBe(studySchedulerService.getStudyOverview);
    expect(studyService.recordStudyReview).toBe(studySchedulerService.recordStudyReview);
    expect(studyService.undoStudyReview).toBe(studySchedulerService.undoStudyReview);
    expect(studyService.performStudyCardAction).toBe(studySchedulerService.performStudyCardAction);
    expect(studyService.updateStudyCard).toBe(studySchedulerService.updateStudyCard);
    expect(studyService.createStudyCard).toBe(studySchedulerService.createStudyCard);
    expect(studyService.deleteStudyCard).toBe(studySchedulerService.deleteStudyCard);
    expect(studyService.getStudySettings).toBe(studySchedulerService.getStudySettings);
    expect(studyService.updateStudySettings).toBe(studySchedulerService.updateStudySettings);
    expect(studyService.getStudyNewCardQueue).toBe(studySchedulerService.getStudyNewCardQueue);
    expect(studyService.reorderStudyNewCardQueue).toBe(
      studySchedulerService.reorderStudyNewCardQueue
    );
  });
});
