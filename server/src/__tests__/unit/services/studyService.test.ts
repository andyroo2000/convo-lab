import { describe, expect, it } from 'vitest';

import * as studyMediaService from '../../../services/studyMediaService.js';
import * as studyService from '../../../services/studyService.js';

describe('studyService barrel', () => {
  it('re-exports media functions from the media service', () => {
    expect(studyService.getStudyMediaAccess).toBe(studyMediaService.getStudyMediaAccess);
  });
});
