# Safari 27.2 follow-up — 2026-11-20

Installed the standalone Safari 27.2 update on macOS 26.6.2. No macOS upgrade.
SafariDriver reports 27.2 (21625.2.8.18.4). Same Apple M3 / 24 GB Mac as the
previous unlocked comparison. This remains an experimental playground.

## Compatibility

Safari 27 exposes WebAssembly.Suspending (JSPI), but rejects memory64 modules
with "Memory64 is not enabled". Its memory constructor accepts the i64 option,
so the upstream feature check incorrectly selected the Chrome runtime. The
wrapper now validates an actual minimal memory64 module. A new wasm32/JSPI
compatibility build loads successfully and native logs confirm the Apple WebGPU
adapter and 13/13 layers offloaded. Chrome retains memory64/JSPI; Safari 26's
wasm32/Asyncify assets remain available, although that browser could not be
rerun after the system update.

Same browser-adapted Zenz-v3 Q5_K_M weights, normal effort, shared-context scorer,
512-token / 16-sequence batch settings and full candidate pools. Safari retains
one CPU worker and Chrome four. This is not a controlled test isolating JSPI
alone: browser versions and exception-handling runtimes also differ.

## Speed

Two Safari runs, followed sequentially by headed Chrome using the identical
in-page benchmark module. Mac unlocked, tabs visible, no concurrent builds or
inference. Normal background apps remained running.

| Operation | Safari 27 run 1 | Safari 27 run 2 | Chrome control |
| --- | ---: | ---: | ---: |
| Ordinary conversion median, 72 requests | 286 ms | 287 ms | 117 ms |
| Growing-prefix median, 8 requests | 108 ms | 91 ms | 43 ms |
| Fresh はしでたべました, boundary 1 | 3,433 ms | 3,874 ms | 888 ms |
| Same reading, boundary 2, partial cache | 1,593 ms | 1,609 ms | 383 ms |
| Fresh きょうはいいてんきです, boundary 3 | 3,860 ms | 3,803 ms | 998 ms |
| Fresh かみをきりました, boundary 2 | 3,386 ms | 3,491 ms | 859 ms |
| Model-worker restart median, 3 restarts | 740 ms | 656 ms | 453 ms |

Safari's eight immediate identical boundary repeats ranged from 17–1,079 ms;
three had approximately one-second stalls, despite cached scoring. Chrome's
four repeats were 20–38 ms. Do not equate cached-repeat times with fresh work.
The reason for Safari's occasional repeat stalls has not been profiled.

These are local cached-asset worker restart measurements, not first-visit
Internet downloads. Latency measures engine conversion and worker communication,
excluding UI typing debounce and rendering. Inspector was closed for most of
each Safari run; brief console interaction at the start/end is another source
of noise. All requests enforce page visibility.

Safari 26's prior fresh adjustments were 2.8–3.8 seconds, versus Chrome's
0.67–0.78 seconds. The new Chrome control was also slower than the earlier run.
We therefore do not claim a precise version regression. The robust conclusion
is that Safari 27 did not remove the multi-second section-adjustment gap.
The hypothesis that removing Asyncify would solve most of it is not supported.
Further profiling should separate GPU dispatch/readback, CPU processing and
worker scheduling before assigning a cause.

## Conversion quality

Compared both Safari runs against the new Chrome control:

- All 72 ordinary ordered candidate lists matched exactly, including units and
  sections. All eight growing-prefix lists matched exactly.
- Every boundary request retained 160 candidates. Candidate text sets,
  per-candidate units/sections and ordered top five matched.
- Lower-ranked choices still reorder between Safari and Chrome. The prior
  small cross-runtime neural score differences remain; this is not bit-identical
  scoring or a guarantee of quality outside these fixtures.

## Reproduction

Build both variants using `performance/safari/README.md`, then serve port 5206.
SafariDriver failed to establish sessions after this update despite the remote
operation setting remaining enabled. The workaround runs the same module in
both browsers and downloads local JSON; no input is uploaded.

From the playground developer console, pass the 24 readings in fixtures.json:

```js
import('/gpu/page-benchmark.mjs').then(m => m.run(readings))
```

Keep the page foreground and the Mac awake. A download link is added when the
run completes; failures are recorded in the report instead of being discarded.
For Chrome the same module was invoked with Playwright, headed channel chrome.
The Chrome control reports JSPI available and memory64 validation true; both
Safari reports show JSPI available and memory64 validation false.

Raw reports:

- `safari27-jspi.json.gz`
- `safari27-jspi-repeat.json.gz`
- `safari27-chrome-control.json.gz`
