# Safari speed with the Mac unlocked — 2026-11-20

Measured sequentially on the same Apple M3 / 24 GB Mac, using installed Safari
26.6.2 and headed Chrome 157.0.8103.79. The desktop stayed unlocked, with sleep
temporarily inhibited. Both browsers used the same locally served model/assets,
normal effort, shared-prompt scorer and full candidate lists. Safari uses the
wasm32/Asyncify compatibility runtime; Chrome uses memory64/JSPI. No production
code, model, or runtime settings were changed in this measurement task.

## Results

| Operation | Safari | Chrome |
| --- | ---: | ---: |
| Ordinary conversion median (72 requests) | 258 ms | 90 ms |
| Ordinary conversion p95 | 358 ms | 134 ms |
| Growing-prefix update median (8 requests) | 78 ms | 36 ms |
| Growing-prefix update maximum | 137 ms | 74 ms |
| Fresh adjustment: はしでたべました, boundary 1 | 2,779 ms | 750 ms |
| Same reading, boundary 2 (partially cached) | 2,325 ms | 324 ms |
| Fresh adjustment: きょうはいいてんきです, boundary 3 | 3,282 ms | 781 ms |
| Fresh adjustment: かみをきりました, boundary 2 | 3,816 ms | 672 ms |
| Immediate identical adjustment repeat median (separate 3-run probe) | 36 ms | 21 ms |
| Model-worker restart median (same 3-run probe) | 1,335 ms | 336 ms |

The restart probe ranged from 855–2,753 ms on Safari and 313–340 ms on Chrome.
Navigation-to-ready in that probe was 1.30 s on Safari and 1.04 s on Chrome.
These startup numbers use local assets and are **not first-visit Internet
download times**. Safari's existing browser cache and Chrome's fresh automation
profile also differ; the three worker restarts are the more comparable measure.
The original corpus runners measure startup differently, so their startup
fields should not be compared directly.

Latency includes dictionary conversion, neural scoring and worker communication,
but excludes the UI's typing debounce and rendering. The ordinary corpus is 24
phrases repeated across three model-worker lifetimes. Prefixes are eight growing
strings ending in すしをたべました. The follow-up probe restarts the worker three
times, performs an ordinary conversion, constrains はしでたべました at boundary 1,
then repeats the identical constraint immediately. Both pages reported visible
and focused; the probe checked the desktop lock state before and after each run.
Its fresh adjustments were 3.04–3.54 s on Safari versus 693–708 ms on Chrome.

## Batch-size experiment

Two passes over three fresh-reading constraints per configuration, with an
ordinary conversion before every constraint so previous candidate-score caches
cannot explain the results:

| Tokens / parallel sequences | Median | Range |
| --- | ---: | ---: |
| 512 / 16 (current default) | 2,844 ms | 2,742–3,074 ms |
| 1024 / 64 | 2,765 ms | 2,452–3,072 ms |
| 2048 / 128 | 2,925 ms | 2,554–3,017 ms |

All requests returned 160 candidates. The small, fixed-order sample does not
justify changing defaults for an approximately 3% median difference. Larger
batches do not solve the multi-second delay. Defaults remain 512 / 16.

## Quality and recommendation

- All 72 ordinary candidate lists and all eight prefix lists matched Chrome
  exactly, including order, units and sections.
- All four section cases preserved the complete 160-item text set, per-candidate
  units/sections and ordered top five.
- Lower-ranked candidates still reorder, with maximum score difference 0.015861.
  This is corpus evidence, not bit-identical neural scoring across runtimes.
- The separate repeated-adjustment probe returned identical lists on each repeat.

Safari is functional and incremental typing is promising, but fresh section
adjustments remain too slow for the intended responsive keyboard experience.
Chrome remains the better experimental target. Cached repeats are fast in both;
they should not be presented as fresh-adjustment latency. These are development
measurements on one Mac with normal background apps, not isolated laboratory or
population-level benchmarks. Safari has no special model or candidate reduction.

## Reproduction and evidence

With the local server on port 5206 and `safaridriver -p 5195`, run sequentially:

```sh
BROWSER=safari BROWSER_URL=http://127.0.0.1:5206 VARIANT=webgpu-unlocked node performance/benchmark-browser.mjs
BROWSER_URL=http://127.0.0.1:5206 VARIANT=safari-comparison-chrome node performance/webgpu/benchmark.mjs
node performance/safari/sweep.mjs
```

Raw reports (JSON, losslessly compressed where large):

- `performance-safari-webgpu-unlocked.json.gz`
- `webgpu-safari-comparison-chrome.json.gz`
- `safari-gpu-sweep.json.gz`
- `safari-startup-repeat-unlocked.json`

The earlier `safari-compat-quality.json.gz` remains quality-only evidence. Its
locked-desktop timings were removed and are not used here. No source code was
edited in this follow-up; the compatibility branch's CodeScene checks remain
unchanged (three source files, 10/10, no findings).
