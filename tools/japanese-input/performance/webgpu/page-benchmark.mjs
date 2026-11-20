// Run from the playground's developer console when WebDriver cannot connect.
// Pass fixtures.json's readings; the report is downloaded, never sent remotely.
async function convert(input) {
  if (document.visibilityState !== 'visible') throw Error('Keep the benchmark tab visible');
  const start = performance.now();
  return { ...await browserEngine.convert(input), wallMs: performance.now() - start };
}
async function restart(report) {
  const start = performance.now();
  await browserEngine.preload();
  if (browserEngine.state !== 'ready') throw Error(browserEngine.error);
  report.startup.push(performance.now() - start);
}
async function ordinary(report, readings) {
  for (let trial = 0; trial < 3; trial++) {
    await restart(report);
    for (const reading of readings) report.trials.push({ trial, reading, ...await convert({ reading }) });
    console.log('Benchmark ordinary pass complete', trial);
  }
}
async function sections(report) {
  for (const [reading, boundaries] of [
    ['はしでたべました', [1]], ['はしでたべました', [2]],
    ['きょうはいいてんきです', [3]], ['かみをきりました', [2]],
  ]) {
    for (let repeat = 0; repeat < 2; repeat++) {
      const input = { reading, boundaries, expanded: true };
      report.boundaries.push({ input, repeat, ...await convert(input) });
    }
  }
}
function download(report) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'safari27-typing-benchmark.json';
  link.textContent = 'Download benchmark results';
  document.body.prepend(link);
  link.click();
}
export async function run(readings) {
  const report = { userAgent: navigator.userAgent, jspi: typeof WebAssembly.Suspending,
    memory64: WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,5,3,1,4,1])),
    startup: [], trials: [], prefixes: [], boundaries: [] };
  try {
    await ordinary(report, readings);
    for (const reading of ['す','すし','すしを','すしをた','すしをたべ','すしをたべま','すしをたべまし','すしをたべました']) {
      report.prefixes.push({ reading, ...await convert({ reading }) });
    }
    await sections(report);
    console.log('Benchmark complete');
  } catch (error) { report.failure = String(error); }
  finally { window.typingBenchmark = report; download(report); }
  return report;
}
