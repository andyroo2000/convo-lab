import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  LEARNING_OS_IMPORT_UPLOAD_PUBLIC_PATH_PATTERN,
  LEARNING_OS_IMPORT_UPLOAD_PUBLIC_PATH_SOURCE,
  STUDY_IMPORT_UPLOAD_PATH_PATTERN,
} from '../../../../routes/learningOs/studyRouteContract.js';

const VALID_ULID = '01ARZ3NDEKTSV4RRFFQ69G5FAW';

describe('Learning OS study route contract', () => {
  it('uses the same strict upload shape for router-relative and public paths', () => {
    expect(STUDY_IMPORT_UPLOAD_PATH_PATTERN.test(`/imports/${VALID_ULID}/upload`)).toBe(true);
    expect(
      LEARNING_OS_IMPORT_UPLOAD_PUBLIC_PATH_PATTERN.test(
        `/api/learning-os/study/imports/${VALID_ULID}/upload`
      )
    ).toBe(true);

    for (const invalidPath of [
      '/api/learning-os/study/imports/not-an-id/upload',
      `/api/learning-os/study/imports/${VALID_ULID}/complete`,
      `/api/learning-os/study/imports/${VALID_ULID}/upload/extra`,
    ]) {
      expect(LEARNING_OS_IMPORT_UPLOAD_PUBLIC_PATH_PATTERN.test(invalidPath)).toBe(false);
    }
  });

  it('keeps the nginx streaming location synchronized with the public path contract', () => {
    const routerTemplatePath = fileURLToPath(
      new URL('../../../../../../deploy/prod-router.conf.template', import.meta.url)
    );
    const routerTemplate = readFileSync(routerTemplatePath, 'utf8');
    const locationMatch = routerTemplate.match(/^\s*location\s+~\s+"([^"]+)"\s+\{$/m);

    expect(locationMatch?.[1]).toBe(LEARNING_OS_IMPORT_UPLOAD_PUBLIC_PATH_SOURCE);
  });
});
