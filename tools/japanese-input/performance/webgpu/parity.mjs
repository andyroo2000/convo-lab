import { readFile, writeFile } from 'node:fs/promises';
const directory = new URL('../../benchmarks/', import.meta.url);
const read = async (name) => JSON.parse(await readFile(new URL(name, directory)));
const baseline = await read('webgpu-baseline.json');
const median = (items) => (items[Math.floor(items.length / 2)] + items[Math.ceil(items.length / 2) - 1]) / 2;
const shape = (candidate) => JSON.stringify([candidate.text, candidate.sections, candidate.units]);
const results = {};
for (const variant of process.argv.slice(2)) {
  const report = await read(`webgpu-${variant}.json`);
  const times = report.trials.map((r) => r.wallMs).sort((a,b) => a-b);
  const sameText = (a,b) => a.candidates[0]?.text === b.candidates[0]?.text;
  const fullList = (a,b) => JSON.stringify(a.candidates.map((c)=>c.text)) === JSON.stringify(b.candidates.map((c)=>c.text));
  const sameSet = (a,b) => JSON.stringify(a.candidates.map((c)=>c.text).sort()) === JSON.stringify(b.candidates.map((c)=>c.text).sort());
  const boundaryDiffs = report.boundaries.map((r,i) => {
    const reference = baseline.boundaries[i];
    const scores = new Map(reference.candidates.map((c)=>[c.text,c.neuralScore]));
    const errors = r.candidates.filter((c)=>scores.has(c.text)).map((c)=>Math.abs(c.neuralScore-scores.get(c.text)));
    return { input:r.input, repeat:r.repeat, ms:r.wallMs, count:r.candidates.length,
      sameFirst:sameText(r,reference),sameSet:sameSet(r,reference),sameOrder:fullList(r,reference),maxScoreDelta:Math.max(...errors),
      sameSections: r.candidates.every((c) => shape(c) === shape(reference.candidates.find((v) => v.text === c.text))),
      sameTopFive: r.candidates.slice(0,5).every((c,i) => c.text === reference.candidates[i].text),
      matchingPositions: r.candidates.filter((c,i) => c.text === reference.candidates[i].text).length };
  });
  results[variant] = {version:report.version,adapter:report.adapter,startup:report.startup,
    ordinaryMedianMs:median(times),ordinaryP95Ms:times[Math.ceil(times.length*.95)-1],
    ordinaryFirstMatches:report.trials.filter((r,i)=>sameText(r,baseline.trials[i])).length,
    ordinaryFullListMatches:report.trials.filter((r,i)=>fullList(r,baseline.trials[i])).length,
    ordinarySectionsMatch: report.trials.every((r,i) => r.candidates.every((c,j) => shape(c) === shape(baseline.trials[i].candidates[j]))),
    samples:times.length,prefixMs:report.prefixes.map((r)=>r.wallMs),boundaryDiffs,errors:report.errors,failure:report.failure};
}
await writeFile(new URL('WEBGPU-SUMMARY.json',directory),JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
