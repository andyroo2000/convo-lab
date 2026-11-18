import { BatchedNeuralModel } from '/browser/batched-neural-model.mjs';
export class PrefixNeuralModel extends BatchedNeuralModel {
  prefixScores = new Map();
  prefixKey(tokens, start, end) {
    return `${start}:${tokens.slice(0, end).join(',')}`;
  }
  cachedPrefix(tokens, start) {
    let next = start,
      score = 0;
    while (next < tokens.length) {
      const key = this.prefixKey(tokens, start, next + 1);
      if (!this.prefixScores.has(key)) break;
      score = this.prefixScores.get(key);
      next++;
    }
    return { next, score };
  }
  remember(tokens, start, cached, probabilities) {
    let score = cached.score;
    for (const [index, logProbability] of probabilities.entries()) {
      score += logProbability;
      this.prefixScores.set(this.prefixKey(tokens, start, cached.next + index + 1), score);
    }
    while (this.prefixScores.size > 4096)
      this.prefixScores.delete(this.prefixScores.keys().next().value);
    return score;
  }
  async score(text, prompt) {
    const tokens = [...(await this.tokenize(text, true)), this.model.getEOS()];
    const start = (await this.tokenize(prompt, true)).length;
    const cached = this.cachedPrefix(tokens, start);
    if (cached.next === tokens.length) return { kind: 'score', score: cached.score };
    const result = await this.model.proxy.wllamaAction('neural_score', {
      _name: 'nscorreq',
      tokens,
      start: cached.next,
    });
    if (!Number.isFinite(result.score)) throw Error('Invalid neural score');
    this.tokens = tokens.slice(0, -1);
    this.model.nCachedTokens = result.n_past;
    const score = this.remember(tokens, start, cached, result.log_probs);
    return { kind: 'score', score };
  }
}
export { PrefixNeuralModel as NeuralModel };
