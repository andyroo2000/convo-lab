import { NeuralModel as Base } from '/browser/base-neural-model.mjs';
export class NeuralModel extends Base {
  prompt = '';
  async scoreMany(texts, prompt) {
    if (this.prompt !== prompt) {
      this.scores.clear();
      this.prompt = prompt;
    }
    const scores = [];
    // The inference context is stateful: never run its requests concurrently.
    for (const text of texts) scores.push((await this.score(prompt + text, prompt)).score);
    return scores;
  }
}
