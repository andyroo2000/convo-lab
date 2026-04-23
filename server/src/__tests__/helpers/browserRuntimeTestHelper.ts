import { resetBrowserRuntimeState } from '../../config/browserRuntimeState.js';
import { resetAllowedApiOriginsCacheForTests } from '../../middleware/csrf.js';

export function resetBrowserRuntimeTestState() {
  resetBrowserRuntimeState();
  resetAllowedApiOriginsCacheForTests();
}
