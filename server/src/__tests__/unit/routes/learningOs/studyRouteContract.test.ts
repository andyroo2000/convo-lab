import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  LEARNING_OS_IMPORT_UPLOAD_PUBLIC_PATH_PATTERN,
  LEARNING_OS_IMPORT_UPLOAD_PUBLIC_PATH_SOURCE,
  STUDY_IMPORT_UPLOAD_PATH_PATTERN,
} from '../../../../routes/learningOs/studyRouteContract.js';

const VALID_ULID = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
const NGINX_CONTRACT_COMMENT =
  '# Keep this regex synchronized with studyRouteContract.ts; its contract test enforces equality.';

describe('Learning OS study route contract', () => {
  it('mounts only the Learning OS-backed Study API', () => {
    const serverEntryPath = fileURLToPath(new URL('../../../../index.ts', import.meta.url));
    const serverEntry = readFileSync(serverEntryPath, 'utf8');

    expect(serverEntry).toContain("app.use('/api/learning-os/study', learningOsStudyRoutes)");
    expect(serverEntry).not.toMatch(/app\.use\(['"]\/api\/study['"]/);
    expect(serverEntry).not.toMatch(/from ['"]\.\/routes\/study\.js['"]/);
  });

  it('uses the same strict upload shape for router-relative and public paths', () => {
    expect(STUDY_IMPORT_UPLOAD_PATH_PATTERN.test(`/imports/${VALID_ULID}/upload`)).toBe(true);
    expect(
      LEARNING_OS_IMPORT_UPLOAD_PUBLIC_PATH_PATTERN.test(
        `/api/learning-os/study/imports/${VALID_ULID}/upload`
      )
    ).toBe(true);
    expect(
      LEARNING_OS_IMPORT_UPLOAD_PUBLIC_PATH_PATTERN.test(
        `/api/learning-os/study/imports/${VALID_ULID.toLowerCase()}/upload`
      )
    ).toBe(true);

    for (const invalidPath of [
      '/api/learning-os/study/imports/not-an-id/upload',
      `/API/learning-os/study/imports/${VALID_ULID}/upload`,
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
    const contractCommentIndex = routerTemplate.indexOf(NGINX_CONTRACT_COMMENT);

    expect(contractCommentIndex).toBeGreaterThanOrEqual(0);

    const contractBlock = routerTemplate.slice(contractCommentIndex);
    const locationMatch = contractBlock.match(/^\s*location\s+~\s+"([^"]+)"\s+\{$/m);

    expect(locationMatch?.[1]).toBe(LEARNING_OS_IMPORT_UPLOAD_PUBLIC_PATH_SOURCE);
  });
});
