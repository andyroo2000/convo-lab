import { initializeWorker } from './worker-channel.mjs';
import { validateConversionRequest } from '/contract.mjs';
export class BrowserRuntime {
  state = 'loading';
  pending = new Map();
  counter = 0;
  generation = 0;
  startup = new Map();
  constructor() {
    this.preload();
  }
  async preload() {
    this.close();
    this.state = 'loading';
    const generation = this.generation;
    try {
      if (!crossOriginIsolated)
        throw Error('This browser needs cross-origin isolation for the conversion workers.');
      const shared = new SharedArrayBuffer(65544);
      this.neural = new Worker('/browser/neural-worker.mjs', { type: 'module' });
      await this.initialize(this.neural, shared);
      if (generation !== this.generation) return;
      this.dictionary = new Worker('/browser/dictionary-worker.mjs', { type: 'module' });
      await this.initialize(this.dictionary, shared);
      if (generation === this.generation) this.state = 'ready';
    } catch (error) {
      if (generation !== this.generation) return;
      this.close();
      this.error = error.message;
      this.state = 'error';
      console.error(error);
    }
  }
  initialize(worker, buffer) {
    return initializeWorker(
      worker,
      buffer,
      {
        neural: (request) => this.neural.postMessage(request),
        result: (result) => this.finish(result),
        failure: (error) => this.fail(error),
      },
      this.startup
    );
  }
  finish(data) {
    const pending = this.pending.get(data.id);
    if (!pending) return;
    this.pending.delete(data.id);
    clearTimeout(pending.timer);
    const error = data.error || data.result?.error;
    if (error) {
      pending.reject(Error(error));
      if (data.error) this.fail(Error(error));
    } else pending.resolve(data.result);
  }
  convert(input) {
    input = validateConversionRequest(input);
    if (this.state !== 'ready') return Promise.reject(Error(this.error || 'Model is not ready'));
    return new Promise((resolve, reject) => {
      const id = String(++this.counter);
      const timer = setTimeout(
        () => this.fail(Error('Conversion timed out; retry the model.')),
        65000
      );
      this.pending.set(id, { resolve, reject, timer });
      this.dictionary.postMessage({ ...input, id });
    });
  }
  fail(error) {
    this.close();
    this.error = error.message;
    this.state = 'error';
  }
  close() {
    this.generation++;
    for (const stop of this.startup.values()) stop(Error('Model restarted'));
    this.startup.clear();
    this.neural?.terminate();
    this.dictionary?.terminate();
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(Error('Model restarted'));
    }
    this.pending.clear();
  }
}
