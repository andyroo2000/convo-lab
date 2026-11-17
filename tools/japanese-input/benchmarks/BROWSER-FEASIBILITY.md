# Browser neural feasibility probe — 2026-11-17

The existing Zenz-v3-small Q5_K_M weights can execute inside a browser. This is
not yet a browser port of AzooKey or an integrated Journal input method.

## Local probe

- Apple M3, macOS; Playwright Chromium 143 (headless).
- `@wllama/wllama` 3.13.0, bundled WebAssembly runtime, four CPU threads,
  `n_gpu_layers: 0`, context 512. No WebGPU in this measurement.
- The existing 72,298,816-byte pinned GGUF from `neural-model.json`.
- Static files served over loopback with COOP/COEP headers; no inference API.
- Raw prompts: U+EE00 + full katakana reading + U+EE01; temperature 0,
  `max_tokens: 30`. Three sequential requests, one pass, no statistical claims.
- Browser package/model downloads used ignored `.engines/browser-probe` files.

| Input                  | Output             | End-to-end browser generation |
| ---------------------- | ------------------ | ----------------------------: |
| ハシデタベマシタ       | 箸で食べました     |                        184 ms |
| キョウハイイテンキデス | 今日はいい天気です |                        158 ms |
| カミヲキリマシタ       | 髪を切りました     |                        120 ms |

Loading the model from the local static server took 687 ms. This excludes a real
internet download, cold device/storage conditions, and the full dictionary.

## Tokenizer qualification

The unmodified GGUF fails to load in stock wllama 2.4.0 and 3.13.0: its
`tokenizer.ggml.pre = gpt2-small-japanese-char` name is not recognized. The
AzooKey llama.cpp fork assigns that pre-tokenizer the same regex branch as GPT-2
in `src/llama-vocab.cpp`.

For this **feasibility probe only**, a separate ignored GGUF copy changes that
metadata value to `gpt-2`. Header padding is adjusted to preserve the tensor data
start, and the entire tensor-data region was checked byte-for-byte unchanged
(72,098,976 bytes). The original model remains untouched. This establishes that
the weights execute; it does **not** establish tokenizer equivalence across all
Japanese, Latin text, spaces, punctuation, or special tokens.

The runtime also warns about a missing newline token and EOS/EOG configuration.
Resolve and test those semantics before adopting this adapter. A first attempt
with wllama's `kv_overrides` option aborted, so no production design should rely
on that option without separate investigation.

## Remaining work before Journal integration

1. Verify token IDs, prompt handling, EOS behavior and scores against the native
   engine; build a supported tokenizer adapter rather than relying on the probe.
2. Bring dictionary lookup, constrained whole-phrase search and section handling
   into the browser alongside neural inference. Raw neural generation alone
   does not implement the current converter or guarantee reading preservation.
3. Expose and test candidate likelihood scoring, not only text generation.
4. Measure the full input loop, startup, memory, cache recovery and mobile
   performance across Chrome, Safari and Firefox, with WebGPU where available.
5. Keep inference in a worker; cache/preload the model and dictionary without
   blocking typing. Keep a usable fallback for unavailable engines.
6. Then integrate the per-device keyboard preference below Appearance in Journal.

The user prefers working toward this browser route over rushing a hosted engine.
No production Journal or hosting configuration was changed by this probe.

Sources: [wllama](https://github.com/ngxson/wllama),
[AzooKey llama.cpp tokenizer](https://github.com/azooKey/llama.cpp/blob/master/src/llama-vocab.cpp).
