# Japanese input performance experiments

These are isolated benchmark tools, not production Journal endpoints. See
[the findings](../benchmarks/PERFORMANCE.md) for measurements and limitations.
Run commands from `tools/japanese-input`.

## Installed Chrome and Safari

Start the normal browser server (`node browser/server.mjs`, port 5189). Chrome
uses Playwright's **installed Chrome channel**, not bundled Chromium. Safari
uses Apple's `/usr/bin/safaridriver -p 5195`; enable Remote Automation yourself.
Keep the Mac unlocked and awake throughout timing runs. Do not compile other
experiments concurrently.

```sh
node performance/benchmark-browser.mjs
BROWSER=safari node performance/benchmark-browser.mjs
```

`TRIALS` defaults to three passes of the 24 unchanged fixtures. Each pass resets
both workers so repeated phrases do not become a misleading cache benchmark.
The model stays loaded within each pass. Eight growing prefixes and four full
160-candidate boundary rankings follow. The second boundary request shares its
phrase with the first, so it can reuse scores. `VARIANT` controls the output
filename; `BROWSER_URL` selects the experimental server.

## Batched and shared-prefix scoring

This experiment retains the original model weights, normal effort, full
vocabulary normalizer, and candidate pool. It moves candidate likelihood
calculation into one Wasm call and reuses cumulative likelihoods of identical
prefixes. The earlier, unsuccessful single-thread batch-only run is preserved.

Prerequisites beyond the base browser-port setup:

- Emscripten **4.0.3** installed at `.engines/emsdk`.
- CMake **4.4.0** and Ninja in `.engines/build-tools/bin` (a local Python venv).
- wllama **2.3.7**, revision `5e63e3b226a077b33dc7c608f1fe630f3d21f539`,
  cloned recursively to `.engines/wllama-source`; its pinned llama submodule is
  `4abef75f2cf2eee75eb5083b30a94cf981587394`.

```sh
bash performance/batch/build.sh
NEURAL_BATCH=prefix WLLAMA_DIRECTORY=.engines/wllama-source/esm PORT=5193 node browser/server.mjs
BROWSER_URL=http://127.0.0.1:5193 VARIANT=prefix node performance/benchmark-browser.mjs
BROWSER=safari BROWSER_URL=http://127.0.0.1:5193 VARIANT=prefix node performance/benchmark-browser.mjs
node --test performance/prefix-model.test.mjs
NEURAL_BATCH=prefix WLLAMA_DIRECTORY=.engines/wllama-source/esm node --test performance/scoring.test.mjs
NEURAL_BATCH=prefix WLLAMA_DIRECTORY=.engines/wllama-source/esm node --test browser/test/playground.test.mjs
BROWSER=webkit NEURAL_BATCH=prefix WLLAMA_DIRECTORY=.engines/wllama-source/esm node --test browser/test/playground.test.mjs
```

`NEURAL_BATCH=1` selects batching without prefix caching. Chrome uses four Wasm
threads; Safari/WebKit uses one. Nothing enables these changes by default in
Journal or the original native playground.

## Linux server

`node performance/prepare-server.mjs` creates a minimal Swift package under
`.engines/server-swift`, using the same engine and adapter. Personalization is
disabled, so its unused dependencies are stubbed. The CPU model split mode is
`LAYER`, with zero GPU layers; `NONE` in this llama revision requires a GPU.
Inference threads are fixed to one.

The measured temporary environment used `swift:6.1.3-jammy`, digest
`sha256:25982986f6452a3ec404bd5544492b8c35e9f5a48be0abcbcf381adb4f77750f`.
Inside that image, install `cmake` and `clang`, place the generated package at
`/experiment/server-swift`, and run `performance/server/build.sh`. It builds
azooKey's llama **b4846** with CPU support. Copy the pinned original GGUF to
`/experiment/ggml-model-Q5_K_M.gguf` and the playground files to
`/experiment/playground`. Node **22.14.0** ran the server.

The runtime container was capped at **one CPU / 1 GiB RAM**. It mounted the
experiment directory read-only, set `LD_LIBRARY_PATH=/experiment/llama-build/bin`,
and ran `node /experiment/playground/performance/server/serve.mjs`. The service
binds **127.0.0.1:5191**, never a public interface. A persistent SSH local tunnel
forwarded that port to the benchmarking Mac:

```sh
node performance/benchmark-server.mjs
```

Only public test phrases were sent. The server experiment and its newly pulled
image were removed after measurement; production routes and databases were
untouched. Recreating it is an explicit experiment, not part of normal startup.

## iOS simulator

The ordinary native package now declares iOS support and handles the upstream
iOS `Float16` candidate type. Ranking comparisons still use full `Float`
likelihoods; only the serialized candidate score uses the platform storage type.
Typo correction is explicitly disabled to match the Mac/browser fixture input.

```sh
node install-engine-adapter.mjs
xcrun swift build --package-path engine --scratch-path .engines/ios-simulator -c release --traits Neural --triple arm64-apple-ios16.0-simulator --sdk "$(xcrun --sdk iphonesimulator --show-sdk-path)"
```

Create and boot a dedicated iPhone simulator through `simctl`. Set its identifier
in `SIMULATOR_ID` and run:

```sh
SIMULATOR_ID=your-test-simulator node performance/benchmark-ios.mjs
```

The pinned Metal framework failed to load the model in this simulator, including
a retry after unlocking the Mac and waiting for boot completion. The CPU
fallback verifies iOS execution without pretending it measures phone GPU speed:

```sh
node performance/prepare-ios-cpu.mjs
xcrun swift build --package-path .engines/ios-cpu -c release --triple arm64-apple-ios16.4-simulator --sdk "$(xcrun --sdk iphonesimulator --show-sdk-path)"
SIMULATOR_ID=your-test-simulator IOS_MODE=cpu node performance/benchmark-ios.mjs
```

The simulator runs on the host Mac. These results cannot establish iPhone
latency, thermal behavior, battery use, or native Android performance. A physical
iPhone benchmark is a separate next step; no TestFlight build is published here.
