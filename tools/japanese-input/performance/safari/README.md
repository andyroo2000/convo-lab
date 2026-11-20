# Safari compatibility experiment

Safari 26.6.2 failed to prepare the Chrome runtime with `Cannot allocate
WebAssembly.Memory`. It exposes WebGPU but not `WebAssembly.Suspending`.
The GPU playground now supplies a local wasm32 / Asyncify compatibility build
to wllama, which selects it when JSPI or memory64 is unavailable. Chrome retains
the existing runtime. Safari uses one CPU worker; GPU offload remains enabled.

This is an experimental playground, not a production Journal change. It keeps
the same browser-adapted Zenz-v3 Q5_K_M model, normal effort, shared-prompt scorer,
full-phrase context, and complete 160-candidate section-adjustment pool.

## Build and try

Complete the pinned build prerequisites in `../webgpu/README.md` first, including
the optimized Swift browser assets and the regular WebGPU build. With CMake on
PATH, run from `tools/japanese-input`:

```sh
node performance/safari/build.mjs
SAFARI_JSPI=1 node performance/safari/build.mjs
PORT=5206 NEURAL_GPU=gpu node browser/server.mjs
```

Open `http://127.0.0.1:5206` in Safari. Generated compatibility files live in
`.engines/webgpu-source/esm/compat/` (Safari 26) and `esm/compat-jspi/`
(Safari 27) and remain ignored. Both builds disable memory64 and enable WebGPU.
Safari 26 uses Asyncify; Safari 27 uses JSPI. Build both variants when serving
both browser versions. The wrapper validates a minimal memory64 module rather
than trusting the memory constructor, which gives a false positive in Safari 27. All model and
runtime assets are served locally; conversion stays on the computer.

## Verified results

On installed Safari 26.6.2, the model loaded successfully. Native runtime logs
confirmed the Apple WebGPU adapter and **13/13 layers offloaded to GPU**.

Compared with `../../benchmarks/webgpu-gpu-shared-final.json`:

- All 72 ordinary conversions (24 phrases, three trials) matched candidate order,
  text, units, and sections exactly.
- All eight growing-prefix conversions matched exactly.
- All four section-adjustment cases retained all 160 candidates, with identical
  candidate text sets, units, sections, and top five choices.
- Lower-ranked section alternatives reordered in all four cases. Neural scores
  differed by up to 0.015861 across browser GPU runtimes. This is measured parity
  on the test corpus, not a claim of bit-identical scoring or universal quality.
- The 25 unit tests and 15 Chrome browser/shared-scorer regression tests passed.

Candidate evidence is stored in `../../benchmarks/safari-compat-quality.json.gz`.
Timings were deliberately removed: the Mac was locked during the run. Do not use
that run or its batch sweep to compare Safari speed with Chrome. Defaults remain
512 tokens / 16 sequences. The subsequent unlocked comparison is recorded in
`../../benchmarks/SAFARI-UNLOCKED.md`; it supersedes the invalid timing run.

## Repeat measurements

Enable Safari remote automation and start `safaridriver -p 5195`. Keep the Mac
unlocked and Safari foreground, stop other heavy work, and run sequentially:

```sh
BROWSER=safari BROWSER_URL=http://127.0.0.1:5206 VARIANT=webgpu-compat node performance/benchmark-browser.mjs
node performance/safari/sweep.mjs
```

The sweep checks the macOS lock state before starting and before each conversion.
It compares three batch configurations without changing the model or dropping
candidates. If the desktop locks, discard the timings and rerun unlocked.

## Safari 27 follow-up

Safari 27.2 now loads with the wasm32/JSPI runtime. Two complete corpus runs and
a Chrome control retained the same quality on these fixtures, but fresh section
adjustments remained slow. See `../../benchmarks/SAFARI27.md` for results and
the in-page runner used when the updated Safari WebDriver could not connect.
