import { NeuralModel } from './neural-model.mjs';
import { review } from './neural-review.mjs';
// wllama 2.x resolves asset URLs through document.baseURI, even in a worker.
globalThis.document = { baseURI: location.href };
const model = new NeuralModel();
let control, output;
const encode = new TextEncoder();
function answer(value) {
  const bytes = encode.encode(JSON.stringify(value));
  output.set(bytes);
  Atomics.store(control, 1, bytes.length);
  Atomics.store(control, 0, 1);
  Atomics.notify(control, 0);
}
self.onmessage = async ({ data }) => {
  try {
    if (data.op === 'init') {
      control = new Int32Array(data.buffer, 0, 2);
      output = new Uint8Array(data.buffer, 8);
      await model.load();
      postMessage({ ready: true });
    } else {
      const result =
        data.op === 'score' ? await model.score(data.text, data.prompt) : await review(model, data);
      answer(result);
    }
  } catch (error) {
    if (data.op === 'init') {
      console.error(error.stack || error);
      postMessage({ error: error.message });
    } else answer({ kind: 'error', error: error.message });
  }
};
