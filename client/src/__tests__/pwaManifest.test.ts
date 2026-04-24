import { describe, expect, it } from 'vitest';

import pwaManifest from '../config/pwaManifest';

describe('PWA manifest', () => {
  it('launches installed web apps through the authenticated app entrypoint', () => {
    expect(pwaManifest.start_url).toBe('/app');
    expect(pwaManifest.scope).toBe('/');
  });
});
