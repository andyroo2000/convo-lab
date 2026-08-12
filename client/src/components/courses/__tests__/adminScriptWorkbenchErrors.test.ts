import { describe, expect, it } from 'vitest';

import getAdminScriptErrorMessage from '../adminScriptWorkbenchErrors';

describe('getAdminScriptErrorMessage', () => {
  it.each([
    ['non-JSON bodies', new Response('<html>Bad gateway</html>'), 'Request failed'],
    [
      'missing messages',
      new Response(JSON.stringify({ error: 'Bad gateway' }), {
        headers: { 'Content-Type': 'application/json' },
      }),
      'Request failed',
    ],
    [
      'blank messages',
      new Response(JSON.stringify({ message: '   ' }), {
        headers: { 'Content-Type': 'application/json' },
      }),
      'Request failed',
    ],
  ])('uses the fallback for %s', async (_description, response, fallback) => {
    await expect(getAdminScriptErrorMessage(response, fallback)).resolves.toBe(fallback);
  });

  it('trims a useful API message', async () => {
    const response = new Response(JSON.stringify({ message: '  Try again later  ' }), {
      headers: { 'Content-Type': 'application/json' },
    });

    await expect(getAdminScriptErrorMessage(response, 'Request failed')).resolves.toBe(
      'Try again later'
    );
  });
});
