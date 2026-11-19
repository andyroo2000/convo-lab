import { NeuralModel as Base } from '/browser/base-neural-model.mjs';
import { Wllama } from '/vendor/gpu/index.js';
import { cachedAsset } from '/browser/asset-cache.mjs';
import { gpu, incremental, batchTokens, sequenceCapacity, sharePrompt, profiling } from '/gpu/config.mjs';

export class NeuralModel extends Base {
  prompt = '';
  constructor() {
    super();
    this.model = new Wllama({ default: '/vendor/gpu/wasm/wllama.wasm' }, {
      suppressNativeLog: false,
      logger: { debug: console.debug, log: console.log, warn: console.warn, error: console.error },
    });
    this.model.setCompat(null);
    this.model.tokenize = (text, special) => this.call({ op: 'tokenize', text, special });
    this.model.detokenize = async (tokens) => new TextEncoder().encode(await this.call({ op: 'detokenize', tokens }));
  }
  async load() {
    const response = await cachedAsset('/assets/model.gguf?adapter=2');
    await this.model.loadModel([await response.blob()], {
      n_ctx: 1024, n_batch: 1024, n_ubatch: 512, n_parallel: 1,
      n_threads: 4, n_gpu_layers: gpu ? 99999 : 0,
      warmup: false, flash_attn: false,
    });
    if (this.model.getEOS() !== 3 || this.model.getBOS() !== 2) throw Error('Unexpected token metadata');
  }
  async call(input) {
    const reply = await this.model.proxy.wllamaAction('journal', {
      _name: 'rtsd_req', req_id: 0, data_json: JSON.stringify(input),
    });
    if (!reply.success || reply.is_error) throw Error(reply.data_json || 'Neural operation failed');
    return JSON.parse(reply.data_json);
  }
  async probabilities(tokens) {
    const key = tokens.join(',');
    if (!this.cache.has(key)) {
      this.cache.set(key, await this.call({ op: 'probabilities', tokens }));
      if (this.cache.size > 512) this.cache.delete(this.cache.keys().next().value);
    }
    return this.cache.get(key);
  }
  async scoreMany(texts, prompt) {
    if (this.prompt !== prompt) { this.scores.clear(); this.prompt = prompt; }
    if (incremental) return this.scoreIncrementally(texts, prompt);
    const missing = [...new Set(texts.filter((text) => !this.scores.has(text)))];
    if (missing.length) await this.scoreMissing(missing, prompt);
    const result = texts.map((text) => this.scores.get(text));
    while (this.scores.size > 512) this.scores.delete(this.scores.keys().next().value);
    return result;
  }
  async scoreMissing(missing, prompt) {
    const started = performance.now();
    const start = (await this.tokenize(prompt, true)).length;
    const sentences = [];
    for (const text of missing) sentences.push([
      ...(await this.tokenize(prompt + text, true)), this.model.getEOS(),
    ]);
    const tokenized = performance.now();
    const result = await this.call({ op: 'scores', sentences, start, batchTokens, sharePrompt, capacity: gpu ? sequenceCapacity : 1 });
    const values = result.scores;
    if (profiling) console.log('journal-profile', JSON.stringify({ candidates: missing.length, tokens: sentences.reduce((n,s) => n+s.length,0), tokenizeMs: tokenized-started, inferMs: performance.now()-tokenized, decodeMs: result.decodeMs, normalizeMs: result.normalizeMs, batches: result.batches, decodedTokens: result.tokens }));
    if (values.length !== missing.length || !values.every(Number.isFinite)) throw Error('Invalid scores');
    missing.forEach((text, index) => this.scores.set(text, values[index]));
  }
  async scoreIncrementally(texts, prompt) {
    const result = [];
    for (const text of texts) result.push((await Base.prototype.score.call(this, prompt + text, prompt)).score);
    return result;
  }
  async score(text, prompt) {
    return { kind: 'score', score: (await this.scoreMany([text.slice(prompt.length)], prompt))[0] };
  }
}
