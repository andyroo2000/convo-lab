# Chrome WebGPU experiment

This is an opt-in experiment, not the Journal production input engine. It ports
native iOS optimizations without changing the model, normal effort level, or
160-candidate boundary pool. See `../../benchmarks/WEBGPU.md` for measured results
and the candidate-order caveat. The follow-up shared-prompt optimization is
measured in `../../benchmarks/WEBGPU-SHARED.md`.

## Implementation

- Reuse the dictionary conversion result when only the requested section boundary
  changes. The reading still determines the full-phrase context.
- Keep model contexts alive; the original browser port already did this.
- Cache complete sentence scores for the current reading. Repeated adjustments
  reuse them; a different reading invalidates them.
- Evaluate the exact shared reading prompt once, retain its KV rows in a
  prompt-only sequence, and share those rows with each independent candidate.
  Every candidate suffix and EOS is still scored. This is enabled by default
  for the GPU experiment; `GPU_SHARE_PROMPT=0` restores the earlier full-batch
  path for comparison.
- Send the complete candidate pool across the worker bridge once, and batch up to
  16 independent sentences / 512 total tokens per neural decode. Every candidate
  is scored against the full vocabulary, including EOS. Nothing is truncated to
  make the benchmark faster.
- Use the exact browser-adapted Zenz Q5_K_M file from the existing port. The main
  prefix context retains its original 1,024-token capacity. Like the native batch
  scorer, an individual boundary-scoring sentence above 512 tokens fails explicitly.
- The new wllama release removed its public low-level scoring API. The small C++
  bridge restores tokenize, detokenize, prefix probabilities, and full-sentence
  scoring. It uses the same loaded model for the separate batch context. Boundary
  errors are serialized instead of allowing the upstream worker to misread a
  null response. WebGPU is requested explicitly; verify the offload logs.

## Reproduce

Use the prerequisites in `../../browser/README.md`. Run these commands from
`tools/japanese-input`. Keep the baseline browser assets before rebuilding the
optimized Swift bridge:

```sh
npm ci
npm run build:browser
cp -R .engines/browser-assets .engines/browser-baseline-assets
IOS_OPTIMIZED=1 npm run build:browser

git clone https://github.com/ngxson/wllama.git .engines/webgpu-source
git -C .engines/webgpu-source checkout 6647c1ea3837b2f0205a300c3bf5ff644aaa06bf
git -C .engines/webgpu-source submodule update --init --recursive

git clone https://github.com/emscripten-core/emsdk.git .engines/webgpu-emsdk
.engines/webgpu-emsdk/emsdk install 4.0.20
.engines/webgpu-emsdk/emsdk activate 4.0.20
bash performance/webgpu/build.sh
```

CMake must be on PATH. The build pins Dawn to `v20260317.182325`; the wllama
submodule pins llama.cpp to `7d7f0287530bc8981690f361d8c1627dbae1c99a`.
It builds the JavaScript runtime without upstream TypeScript declarations, whose
DOM-type compilation fails in this pinned release. Generated runtime files,
weights, dictionaries, compilers, and downloaded dependencies stay ignored.

Run each server in its own terminal:

```sh
PORT=5201 BROWSER_ASSETS=.engines/browser-baseline-assets node browser/server.mjs
PORT=5202 IOS_BROWSER=1 node browser/server.mjs
PORT=5203 NEURAL_GPU=gpu node browser/server.mjs
PORT=5204 NEURAL_GPU=cpu node browser/server.mjs
PORT=5205 NEURAL_GPU=gpu NEURAL_SCALAR=1 node browser/server.mjs
```

Open `http://127.0.0.1:5203` in desktop Chrome for the accelerated playground.
All conversion stays on the computer. This server only serves static assets;
there is no remote conversion service or conversion-history storage.

Run benchmarks sequentially with other heavy work stopped. To reproduce the
original `WEBGPU.md` measurements, start the GPU server with `GPU_SHARE_PROMPT=0`;
the new default enables the follow-up optimization:

```sh
BROWSER_URL=http://127.0.0.1:5201 VARIANT=baseline node performance/webgpu/benchmark.mjs
BROWSER_URL=http://127.0.0.1:5202 VARIANT=ios-reuse node performance/webgpu/benchmark.mjs
BROWSER_URL=http://127.0.0.1:5203 VARIANT=gpu node performance/webgpu/benchmark.mjs
BROWSER_URL=http://127.0.0.1:5204 VARIANT=runtime-cpu node performance/webgpu/benchmark.mjs
BROWSER_URL=http://127.0.0.1:5205 VARIANT=gpu-incremental node performance/webgpu/benchmark.mjs
node performance/webgpu/parity.mjs baseline ios-reuse gpu runtime-cpu gpu-incremental
NEURAL_GPU=gpu CHROME_CHANNEL=chrome HEADED=1 node --test browser/test/*.test.mjs
node --test test/*.test.mjs
```

`runtime-cpu` uses the new runtime with one whole sentence per decode, and
`gpu-incremental` scores token prefixes individually on the GPU. These controls
separate runtime and batching effects; neither is the recommended fallback.
The original wllama 2 CPU path remains available without `NEURAL_GPU`.

Compile the native tokenizer probe following `../../browser/README.md`, then
run `node performance/webgpu/tokenizer.mjs` against server 5203. This compares
all 85 original diagnostic samples, including ASCII spaces and special tokens.

## Shared-prompt follow-up

`GPU_BATCH_TOKENS` (512–2048) and `GPU_SEQUENCES` (1–160) expose bounded
experimental batch configurations. The selected defaults remain 512 and 16:
larger full-sentence batches did not improve latency. `GPU_PROFILE=1` logs only
counts and timings, including decode and normalization time; it does not log
candidate text. Profiling is off in the normal playground.

```sh
# Uses installed Chrome and starts its own temporary local static server.
node performance/webgpu/sweep.mjs
CONFIGS='[[512,16,true],[512,32,true],[1024,64,true],[2048,128,true]]' REPORT=webgpu-shared-sweep node performance/webgpu/sweep.mjs
CONFIGS='[[512,16,false],[512,16,true]]' TRIALS=1 FULL_CORPUS=1 REPORT=webgpu-shared-quality node performance/webgpu/sweep.mjs

# With server 5203 running using the new defaults:
BROWSER_URL=http://127.0.0.1:5203 VARIANT=gpu-shared-final node performance/webgpu/benchmark.mjs
node performance/webgpu/verify-shared.mjs
node --test performance/webgpu/shared.test.mjs
```

The verifier compares full candidate sets and section structures, all ordinary
candidate orders, and the top five constrained alternatives. It reports rather
than hides the small lower-ranked ordering differences. The edge tests cover
EOS-only suffixes, batch sizes, invalid shapes, and recovery after errors.
