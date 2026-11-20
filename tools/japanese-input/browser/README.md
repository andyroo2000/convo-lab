# Browser-only Japanese typing playground

Run `npm run start:browser` in `tools/japanese-input`, then open
<http://127.0.0.1:5189>. The original native playground remains on port 5188.
The browser server serves static files only. It has no conversion endpoint and
never starts a native inference process. After loading, conversion also works
with the network disconnected.

## What runs in the browser

- Pinned AzooKey 0.11.2 dictionary, lattice, normal-effort neural review loop,
  clause boundaries, expanded alternatives and constrained full-phrase search,
  compiled from Swift to WebAssembly.
- The same Zenz-v3-small Q5_K_M tensors through wllama 2.3.7. This version retains
  the low-level scoring API and the 32-bit Wasm build needed by WebKit.
- The existing notebook UI, romaji shortcuts, live conversion, arrow selection,
  Shift-arrow boundaries, commit/cancel, undo, autosave and auto-growing editor.
- A separate neural worker and dictionary worker. A bounded shared-memory reply
  buffer bridges the synchronous Swift evaluator to asynchronous model calls.
  Whole-phrase scores and prefix distributions are cached in memory only.

The page requires COOP `same-origin` and COEP `require-corp`. Model downloads are
cached when browser storage is available; private-storage failures fall back to
a direct download. This is not an installed offline PWA: a cold page reload still
needs the static site. The notebook text uses the existing local autosave.

Chromium uses four model threads. WebKit uses one because nested multithreaded
inference hangs in the tested WebKit runtime. Firefox also uses one, but its
160-candidate ranking still exceeds the conversion timeout. Do not ship the
main Journal integration based on this prototype yet; see `convo-lab-r51i`.

## Reproduce the build

1. Run `npm ci` in `tools/japanese-input`.
2. Populate the pinned upstream sources and model with the existing
   `npm run setup` and `npm run setup:neural` workflows. These also build the
   native comparison engine. Do not substitute a newer model or dictionary.
3. Install the **Swift.org 6.4.2** toolchain and its matching WebAssembly SDK.
   Apple's Xcode toolchain alone is insufficient. The SDK archive is:
   `https://download.swift.org/swift-6.4.2-release/wasm-sdk/swift-6.4.2-RELEASE/swift-6.4.2-RELEASE_wasm.artifactbundle.tar.gz`
   with SHA-256 `83baca83553f8c443cda7b84800912e6e709c3acd2e7ebf277794ca5836c0da5`.
4. Set `SWIFT_WASM` to that toolchain's `usr/bin/swift` if it is not the selected
   `swift`. Run `npm run build:browser`.
5. Run `npm run start:browser`. Run the native playground separately on 5188 when
   comparing engines.

`prepare-swift.mjs` creates a separate ignored build tree. It does not change
upstream sources used by the native playground. The adaptations are explicit:
resource URLs point to the worker's read-only virtual dictionary; unused atomic
file writes use WASI-compatible options; personalization remains disabled; the
native model context is replaced by the browser inference bridge. The real
conversion and candidate-section sources are reused, not rewritten in JS.

`model-adapter.mjs` verifies the original model checksum and preserves every
weight byte. It changes the unsupported pre-tokenizer name to `gpt-2` and sets
BOS/EOS to 2/3, matching the effective native vocabulary (the original GGUF says
1/2). The JS tokenizer also preserves native UNK=0 for ASCII spaces. The original
model remains unchanged. `browser-tokenizer.json` records 85 matching token
sequences, including mixed scripts, punctuation, special tags and emoji.

## Verification

- `npm test`: existing unit and protocol tests.
- `npm run test:browser`: original native-backed interaction suite.
- `npm run test:browser-port`: browser-only interactions in Chromium.
- `BROWSER=webkit npm run test:browser-port`: the same checks in WebKit.
- `BROWSER=firefox npm run test:browser-port`: currently exposes the full-ranking
  timeout; a known compatibility limitation, not a passing platform.
- `npm run benchmark:browser`: the unchanged 24-phrase corpus plus four manually
  constrained full candidate lists, against the native server on 5188.

The tokenizer diagnostic uses `browser/tokenizer-probe.cc`, compiled with the
same native llama.framework as the reference worker. Set `LLAMA_FRAMEWORK_DIR`
to the directory containing that framework, then compile with:

```sh
clang++ -std=c++17 browser/tokenizer-probe.cc -F "$LLAMA_FRAMEWORK_DIR" \
  -framework llama -Wl,-rpath,"$LLAMA_FRAMEWORK_DIR" -o .engines/tokenizer-probe
node browser/tokenizer-parity.mjs
```

See [comparison results](../benchmarks/BROWSER-COMPARISON.md) for measurements and
limits. No Journal production code, account settings, or deployment was changed.
