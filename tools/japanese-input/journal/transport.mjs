import { BrowserRuntime } from '../browser/web/runtime.mjs';

let runtime;
export function getRuntime() {
  runtime ??= new BrowserRuntime();
  return runtime;
}
export async function engineFetch(path, options = {}) {
  const engine = getRuntime();
  if (path.endsWith('/engine'))
    return Response.json({ state: engine.state, error: engine.error, learning: true });
  try {
    const input = JSON.parse(options.body);
    const result = path.endsWith('/learn')
      ? await engine.learn(input)
      : await engine.convert(input);
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 503 });
  }
}
window.addEventListener('pagehide', () => runtime?.close());
window.addEventListener('pageshow', (event) => {
  if (event.persisted) runtime?.preload();
});
