import { BrowserRuntime } from '/browser/runtime.mjs';
const runtime = new BrowserRuntime();
const engine = {
  id: 'azookey-browser-wasm',
  neural: true,
  inferenceLimit: 1,
  accelerator: 'WebAssembly CPU',
  learning: false,
};
// Exposed only on the isolated playground for repeatable benchmark/test runs.
window.browserEngine = runtime;
window.addEventListener('pagehide', () => runtime.close());
window.addEventListener('pageshow', (event) => {
  if (event.persisted) runtime.preload();
});
export async function engineFetch(path, options = {}) {
  if (path.endsWith('/retry')) {
    runtime.preload();
    return Response.json({ state: runtime.state });
  }
  if (path.endsWith('/engine'))
    return Response.json({ ...engine, state: runtime.state, error: runtime.error });
  try {
    const input = JSON.parse(options.body);
    const result = { ...(await runtime.convert(input)), engine, reading: input.reading };
    window.dispatchEvent(new CustomEvent('browser-conversion', { detail: result }));
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 503 });
  }
}
