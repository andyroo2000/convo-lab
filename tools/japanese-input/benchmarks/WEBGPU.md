# Chrome neural-input experiment — 2026-11-19

## Result

WebGPU plus the iOS-style full-candidate batch scorer makes new section rankings
about **4× faster** on this Mac. Ordinary conversion improves modestly. The exact
model and candidate pool are preserved, but **candidate order is not numerically
identical to the old runtime**. Keep this as a local experiment before choosing a
production browser implementation.

| Configuration                           | Ordinary median / p95 | Fresh full boundary ranking¹ | Same-boundary repeat |
| --------------------------------------- | --------------------- | ---------------------------- | -------------------- |
| Existing browser CPU                    | 115 / 203 ms          | 6.41–7.04 s                  | 29–45 ms             |
| iOS reuse/cache changes, existing CPU   | 119 / 226 ms          | 6.60–6.97 s                  | 20–32 ms             |
| **WebGPU + full batching**              | **90 / 147 ms**       | **1.56–1.79 s**              | **19–29 ms**         |
| New runtime, CPU whole-sentence control | 119 / 218 ms          | 13.52–16.57 s                | 21–32 ms             |
| WebGPU, token-at-a-time control         | 96 / 146 ms           | 6.71–10.56 s                 | 21–33 ms             |

¹ Three different readings. The fourth boundary case changes the split again on
an already-scored reading, so it benefits from cached scores: **2.20 s → 0.70 s**.
It is deliberately excluded from the fresh-reading range. All requests return
160 candidates with full-phrase neural scores; no smaller pool was timed.

| Boundary request                               | Existing CPU | WebGPU batch |
| ---------------------------------------------- | -----------: | -----------: |
| はしでたべました, first section length 1       |     7,040 ms |     1,637 ms |
| Same reading, first section length 2           |     2,203 ms |       696 ms |
| きょうはいいてんきです, first section length 3 |     6,820 ms |     1,790 ms |
| かみをきりました, first section length 2       |     6,411 ms |     1,557 ms |

Startup measured from local page navigation to ready was **1.10 s** for WebGPU,
versus **1.35 s** for the baseline. Warm worker restarts were **325–343 ms** versus
**374–384 ms**. These are local-asset timings, not internet download estimates.
The roughly 165 MB uncompressed core asset payload remains, plus the inference
runtime. Preloading helps hide initialization but does not remove the first
visit download.

## Quality and integrity

- **24 original phrases × 3 trials: 72/72 identical first choices, complete
  ordinary candidate lists, and section/unit structures** versus the old browser
  runtime. This is parity with the reference, not a claim of perfect Japanese
  accuracy on arbitrary writing.
- **4 constrained boundary cases:** the same first choice, all **160/160 candidate
  texts**, and the same section/unit structures for each candidate. The eight
  results in the raw files include immediate repeated requests.
- **85/85 tokenizer samples** match the original native tokenizer, including
  mixed Japanese/English, ASCII spaces, punctuation, special tags, and emoji.
- Original model SHA-256:
  `501f605d088f5b988791a00ae19ed46985ed7c48144f364b2f3f1f951c9b2083`.
  Browser metadata-adapted model SHA-256 in both old and new runs:
  `1066c65d6e0ee746fb749634fd8c60e927dbf4e1313a54ce709a517f5d0ab779`.
  The adapter changes tokenizer metadata, not tensor weights, exactly as in the
  earlier browser port. No new model or quantization was introduced here.
- Normal effort remains inference limit 1. The same AzooKey dictionary, upstream
  candidate generation, full-phrase prompt, and 160-candidate cap remain in use.
- Runtime logs confirm Apple WebGPU and **13/13 model layers offloaded**. Some
  operations still execute on CPU; this is not a claim that every operation is
  a GPU kernel. The raw GPU report stores the device/offload messages.

### Candidate-order caveat

The full boundary ordering differs. Across the four cases, **71, 54, 56, and 60
of 160 positions** exactly match the old runtime. Candidates typically move a
few places; maximum shifts are **7, 11, 13, and 7** respectively. The largest
absolute whole-sentence score delta is about **0.92**.

The earliest visible difference is the fifth alternative for
`きょうはいいてんきです`: the old runtime ranks `今日は良い転機です` there,
while the GPU ranks `京はいい天気です` there. The first four choices agree.
For the other cases, the first difference is at positions 10, 17, and 11.

The token-at-a-time GPU control also changes these rankings, so batching alone
is not the explanation. Comparing the GPU batch and incremental paths gives
154, 150, 148, and 149 matching positions out of 160, with the same top five in
all four cases. The newer CPU runtime also changes the rankings. These controls
point to numerical differences between inference runtimes/backends in addition
to batch-shape effects; they do not prove that no quality regression is possible.
The reuse-only old-runtime variant has **exact full-order and score parity**.

## What was ported

The optimized Swift bridge reuses ordinary dictionary results when only section
boundaries change. The model stays loaded; scores for the same reading are
reused. The new boundary scorer shares the model weights with a separate,
retained batch context and scores up to 16 independent full sentences per
512-token batch. It uses full-vocabulary log probabilities, not top-k estimates.
The ordinary prefix context retains the baseline 1,024-token capacity.

This required an experimental low-level bridge because wllama 3 removed the
public decoding/logit API used by the original wllama 2 port. Build instructions,
controls and pins are in `../performance/webgpu/README.md`.

## Method and limits

- Apple M3, 24 GB RAM; installed desktop Google Chrome **157.0.8103.79**;
  adapter `apple / metal-3`; normal headed browser with no unsafe GPU flags.
- Sequential runs, no compilation during timed measurements. Three ordinary
  corpus passes (72 samples), eight growing prefixes, and four boundary cases
  with immediate repeats per configuration. Boundary ranges are case timings,
  not a large-sample latency distribution.
- A preliminary GPU build with a smaller ordinary context measured 95 ms median
  and 1.65–1.98 s fresh ranking. The final values above are from the preserved
  1,024-token ordinary-context build. Do not treat small timing differences as a
  statistically established startup gain.
- All input and inference are local. Offline conversion was exercised.
- This does not establish support or speed on Windows, Android, mobile Chrome,
  Safari, other GPUs, low-memory machines, or real network connections. The new
  runtime needs modern WebAssembly/JSPI and WebGPU support. There is no automatic
  production fallback or main Journal integration in this branch.
- A ~1.6–1.8-second fresh boundary adjustment is still visibly delayed and remains
  slower than the approximately 612 ms measured earlier on the physical iPhone.
  Different devices and builds make that an orientation point, not a controlled
  hardware comparison.

## Recommendation

Keep the Chrome experiment available for hands-on evaluation. It is substantially
more viable than the earlier CPU-only browser path, but it is not yet an iOS-like
experience for uncached section adjustments. Before shipping, validate more
ambiguous phrases, real target devices, cancellation/rapid edits under GPU load,
and startup delivery. A responsive kana preview while ranking happens in the
background could hide some latency without changing the model or candidate pool.
Do not call the full ranking identical or promise the iPhone speed on desktop.

## Verification

- 25 existing unit/protocol tests passed.
- 11 browser interaction tests passed in installed Chrome with WebGPU: offline
  conversion, section resizing, full candidate menus, selection preservation,
  commit/cancel, native IME events, middle-of-text edits, undo, autosave,
  auto-growing layout, and worker restart.
- SwiftWasm and custom WebGPU runtime release builds completed.
- CodeScene MCP: all 16 supported changed source files score 10/10 with no
  findings. Shell is unsupported; `build.sh` passed syntax validation and the
  actual build. Both the staged safeguard and change-set review passed, each
  confirming coverage of all 16 eligible source files.

Raw reports: `webgpu-baseline.json`, `webgpu-ios-reuse.json`, `webgpu-gpu.json`,
`webgpu-runtime-cpu.json`, `webgpu-gpu-incremental.json`, `webgpu-tokenizer.json`,
and the derived `WEBGPU-SUMMARY.json`.
