import { describe, expect, it } from 'vitest';

import * as studyBrowserService from '../../../services/studyBrowserService.js';
import * as studyExportService from '../../../services/studyExportService.js';
import * as studyImportService from '../../../services/studyImportService.js';
import * as studyMediaService from '../../../services/studyMediaService.js';
import * as studySchedulerService from '../../../services/studySchedulerService.js';
import * as studyService from '../../../services/studyService.js';

describe('studyService barrel', () => {
  it('re-exports import functions from the import service', () => {
    expect(studyService.importJapaneseStudyColpkg).toBe(
      studyImportService.importJapaneseStudyColpkg
    );
    expect(studyService.getStudyImportJob).toBe(studyImportService.getStudyImportJob);
  });

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
    expect(studyService.getStudySettings).toBe(studySchedulerService.getStudySettings);
    expect(studyService.updateStudySettings).toBe(studySchedulerService.updateStudySettings);
    expect(studyService.getStudyNewCardQueue).toBe(studySchedulerService.getStudyNewCardQueue);
    expect(studyService.reorderStudyNewCardQueue).toBe(
      studySchedulerService.reorderStudyNewCardQueue
    );
  });

  it('re-exports browser and export functions from their domain services', () => {
    expect(studyService.getStudyHistory).toBe(studyBrowserService.getStudyHistory);
    expect(studyService.getStudyCardOptions).toBe(studyBrowserService.getStudyCardOptions);
    expect(studyService.getStudyBrowserList).toBe(studyBrowserService.getStudyBrowserList);
    expect(studyService.getStudyBrowserNoteDetail).toBe(
      studyBrowserService.getStudyBrowserNoteDetail
    );
    expect(studyService.exportStudyData).toBe(studyExportService.exportStudyData);
    expect(studyService.exportStudyCardsSection).toBe(studyExportService.exportStudyCardsSection);
    expect(studyService.exportStudyReviewLogsSection).toBe(
      studyExportService.exportStudyReviewLogsSection
    );
    expect(studyService.exportStudyMediaSection).toBe(studyExportService.exportStudyMediaSection);
    expect(studyService.exportStudyImportsSection).toBe(
      studyExportService.exportStudyImportsSection
    );
  });
});
