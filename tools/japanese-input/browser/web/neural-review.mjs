const preprocess = (text) => text.replaceAll(' ', '\u3000').replaceAll('\n', '');
function topTokens(probabilities, count) {
  const best = [];
  for (let token = 0; token < probabilities.length; token++) {
    const p = probabilities[token];
    if (best.length === count && p <= best.at(-1).p) continue;
    best.push({ token, p });
    best.sort((a, b) => b.p - a.p);
    best.length = Math.min(best.length, count);
  }
  return best;
}
export async function review(model, request) {
  const prompt = await model.tokenize(`\uEE00${preprocess(request.reading)}\uEE01`, true);
  const candidate = await model.tokenize(preprocess(request.text));
  const alternatives = [];
  let score = 0;
  for (let index = 0; index < candidate.length; index++) {
    const prefix = candidate.slice(0, index);
    const probabilities = await model.probabilities([...prompt, ...prefix]);
    const best = topTokens(probabilities, request.rich ? 3 : 1);
    const bytes = await model.model.detokenize(prefix);
    if (best[0].token !== candidate[index]) {
      if (best[0].token === model.model.getEOS())
        return { kind: 'whole', text: new TextDecoder().decode(bytes) };
      const suffix = await model.model.detokenize([best[0].token]);
      return { kind: 'fix', prefix: Array.from(new Uint8Array([...bytes, ...suffix])) };
    }
    score += Math.log(best[0].p);
    for (const item of best.slice(1)) {
      alternatives.push({
        probabilityRatio: item.p / best[0].p,
        prefixConstraint: [...bytes, ...(await model.model.detokenize([item.token]))],
      });
    }
  }
  alternatives.sort((a, b) => b.probabilityRatio - a.probabilityRatio);
  return { kind: 'pass', score, alternatives: alternatives.slice(0, 5) };
}
