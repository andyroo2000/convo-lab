import { NeuralModel } from '/browser/base-neural-model.mjs';
export class BatchedNeuralModel extends NeuralModel {
  // Review only inspects the top three tokens. Full-vocabulary likelihoods
  // are computed inside Wasm by score(), so no probabilities are approximated.
  async readLogits() {
    return this.model.getLogits(3);
  }
  async score(text, prompt) {
    const key = JSON.stringify([text, prompt]);
    if (this.scores.has(key)) return this.scores.get(key);
    const tokens = [...(await this.tokenize(text, true)), this.model.getEOS()];
    const start = (await this.tokenize(prompt, true)).length;
    const result = await this.model.proxy.wllamaAction('neural_score', {
      _name: 'nscorreq',
      tokens,
      start,
    });
    if (!Number.isFinite(result.score)) throw Error('Invalid neural score');
    this.tokens = tokens.slice(0, -1);
    this.model.nCachedTokens = result.n_past;
    const reply = { kind: 'score', score: result.score };
    this.scores.set(key, reply);
    if (this.scores.size > 512) this.scores.delete(this.scores.keys().next().value);
    return reply;
  }
}
export { BatchedNeuralModel as NeuralModel };
