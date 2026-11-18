import { chromium, webkit } from '@playwright/test';

async function safariSession() {
  const base = 'http://127.0.0.1:5195';
  async function call(path, body, method = 'POST') {
    const response = await fetch(base + path, {
      method,
      signal: AbortSignal.timeout(130000),
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const result = (await response.json()).value;
    if (!response.ok || result?.error) throw Error(JSON.stringify(result));
    return result;
  }
  const session = await call('/session', {
    capabilities: { alwaysMatch: { browserName: 'safari' } },
  });
  const path = `/session/${session.sessionId}`;
  await call(path + '/timeouts', { script: 120000, pageLoad: 120000 });
  return {
    version: session.capabilities.browserVersion,
    goto: (url) => call(path + '/url', { url }),
    evaluate: (fn, arg) =>
      call(path + '/execute/async', {
        script: `const done = arguments[arguments.length - 1]; Promise.resolve((${fn.toString()})(arguments[0])).then(value => done({value}), error => done({error: error.message}));`,
        args: [arg ?? null],
      }).then((result) => {
        if (result.error) throw Error(result.error);
        return result.value;
      }),
    close: () => call(path, undefined, 'DELETE'),
  };
}
export async function browserSession(name) {
  if (name === 'safari') return safariSession();
  const browser =
    name === 'webkit' ? await webkit.launch() : await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage();
  return {
    version: browser.version(),
    goto: (url) => page.goto(url),
    evaluate: (fn, arg) => page.evaluate(fn, arg),
    close: () => browser.close(),
  };
}
export async function ready(session) {
  return session.evaluate(async () => {
    const start = performance.now();
    while (window.browserEngine?.state !== 'ready') {
      if (window.browserEngine?.state === 'error') throw Error(window.browserEngine.error);
      if (performance.now() - start > 110000) throw Error('Startup timeout');
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return performance.now() - start;
  });
}
