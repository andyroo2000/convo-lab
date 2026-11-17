import { cachedAsset } from './asset-cache.mjs';
import { Wllama } from '/vendor/wllama/index.js';

export class NeuralModel {
  cache = new Map();
  scores = new Map();
  tokens = [];
  constructor() {
    this.model = new Wllama(
      {
        'single-thread/wllama.wasm': '/vendor/wllama/single-thread/wllama.wasm',
        'multi-thread/wllama.wasm': '/vendor/wllama/multi-thread/wllama.wasm',
      },
      {
        allowOffline: true,
        suppressNativeLog: true,
        logger: { debug() {}, log() {}, warn: console.warn, error: console.error },
      }
    );
  }
  async load() {
    const response = await cachedAsset('/assets/model.gguf?adapter=2');
    await this.model.loadModel([await response.blob()], {
      n_ctx: 1024,
      n_threads: /Chrome|Chromium|Edg\//.test(navigator.userAgent) ? 4 : 1,
    });
    if (this.model.getEOS() !== 3 || this.model.getBOS() !== 2)
      throw Error('Unexpected model token metadata');
  }
  async tokenize(text, bos = false) {
    // The pinned native vocabulary emits UNK (0) for ASCII spaces; newer
    // GPT-2 tokenizers drop them. Preserve that behavior before BOS handling.
    const tokens = [];
    for (const [index, part] of text.split(' ').entries()) {
      if (index) tokens.push(0);
      tokens.push(...(await this.model.tokenize(part, false)));
    }
    return bos && this.model.mustAddBosToken() ? [this.model.getBOS(), ...tokens] : tokens;
  }
  sharedPrefix(prefix) {
    const limit = Math.min(prefix.length, this.tokens.length);
    for (let index = 0; index < limit; index++) {
      if (prefix[index] !== this.tokens[index]) return index;
    }
    return limit;
  }
  async probabilities(prefix) {
    const key = prefix.join(',');
    if (this.cache.has(key)) return this.cache.get(key);
    let shared = this.sharedPrefix(prefix);
    // Decoding the last prefix token recreates its logits after a cache hit.
    shared = Math.min(shared, prefix.length - 1);
    if (shared < this.tokens.length) await this.model.kvRemove(shared, this.tokens.length - shared);
    await this.model.decode(prefix.slice(shared), { skipLogits: false });
    this.tokens = [...prefix];
    const values = await this.model.getLogits(-1);
    const probabilities = new Float32Array(this.model.getLoadedContextInfo().n_vocab);
    for (const item of values) probabilities[item.token] = item.p;
    this.cache.set(key, probabilities);
    if (this.cache.size > 512) this.cache.delete(this.cache.keys().next().value);
    return probabilities;
  }
  async score(text, prompt) {
    const key = JSON.stringify([text, prompt]);
    if (this.scores.has(key)) return this.scores.get(key);
    const tokens = [...(await this.tokenize(text, true)), this.model.getEOS()];
    const start = (await this.tokenize(prompt, true)).length;
    let score = 0;
    for (let i = start; i < tokens.length; i++) {
      const probabilities = await this.probabilities(tokens.slice(0, i));
      score += Math.log(Math.max(probabilities[tokens[i]], 1e-38));
    }
    const result = { kind: 'score', score };
    this.scores.set(key, result);
    if (this.scores.size > 512) this.scores.delete(this.scores.keys().next().value);
    return result;
  }
}
