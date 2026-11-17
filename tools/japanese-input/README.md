# Japanese typing playground

An isolated, local experiment for ConvoLab. It does not change Journal routes,
create entries, or call the production API. It uses the site's existing tutor
asset and notebook colors.

## Run

Requires Node 22+ and Swift 6.1+ (tested with Apple Swift 6.2.4 on arm64 macOS).

```sh
cd tools/japanese-input
npm ci
npm run setup
npm start
```

Open **http://127.0.0.1:5188**. Set `PORT` to use another local port. Initial setup
downloads the pinned upstream source, dictionaries, Swift dependencies, and
upstream binary artifacts; it needs network access and several hundred MB.
No API keys or ConvoLab environment files are needed.

Type romaji in the phrase field; WanaKana converts it to kana locally. Space or
Convert requests candidates. Arrow keys or Space cycle choices; Enter or clicking
a candidate inserts it at the notebook's selection. Escape dismisses candidates
without deleting the phrase. Add as kana bypasses conversion. You can edit the
notebook with ordinary text editing or your OS Japanese keyboard.

Notebook text and the pending phrase stay in this browser's local storage. Copy
text exports the notebook. Conversion runs locally in a persistent subprocess;
there is no Google conversion API, neural model inference, or persistent learning.
The page loads its font styles from Google Fonts, as the existing site does.

This is deliberately a **phrase-at-a-time playground**, not a complete inline IME.
There is no phrase-boundary resizing, reconversion of committed text, custom undo
history for insertion, or WaniKani-aware candidate annotation yet. The notebook's
native editing behavior remains available. Native iOS and Android interfaces are
not implemented in this experiment.

## Architecture and portability

The browser knows only the versioned JSON interface:

```http
POST /api/v1/convert
Content-Type: application/json

{"reading":"きのうえいがをみました"}
```

```json
{
  "schemaVersion": 1,
  "engine": {
    "id": "azookey-dictionary",
    "version": "0.11.2",
    "revision": "80b8204f1cdfb364bb2ed355cf52c7ebb2519a0c",
    "neural": false,
    "learning": false
  },
  "reading": "きのうえいがをみました",
  "candidates": [{ "text": "昨日映画を見ました", "reading": "きのうえいがをみました" }],
  "engineMs": 7.2
}
```

The response above is illustrative. `engineMs` measures conversion, not network
latency. Candidate arrays may be empty. Only full-reading candidates are returned;
partial completions must never replace and silently discard the remainder.
Requests accept one line of 1–120 characters after NFC normalization and trimming.
Invalid requests return 400; a busy, missing, failed, or timed-out engine returns 503. The browser discards stale responses and keeps the pending phrase on failure.

The worker loads dictionaries once, handles requests sequentially, and resets
composition between conversions. The bridge bounds the pending queue at 16 and
times out after 10 seconds. It restarts the worker lazily after failure. No shared
user learning, input logging, or history is enabled.

Web, Swift/iOS, and Kotlin/Android clients could all use this JSON contract. The
development server intentionally binds to loopback and rejects foreign browser
origins and hosts. A deployed service still needs authentication, rate limiting,
TLS, load testing, and proper operational monitoring. Do not expose this local
server publicly. Native offline engines are a separate decision:

| Platform | Initial path           | Later offline option                                                       |
| -------- | ---------------------- | -------------------------------------------------------------------------- |
| Web      | Own conversion service | Requires a validated browser engine/port                                   |
| iOS      | Same service           | AzooKey Swift library is a natural candidate                               |
| Android  | Same service           | Evaluate AzooKey's Swift Android integration versus Mozc's Android library |

The pinned AzooKey release has upstream Linux and Android CI configurations. We
have **not** independently validated its Linux build, Android build, or native
iOS behavior here. Its library being Swift does not force the Android client to
use Swift when using the shared service.

## Engine choice and evidence

AzooKey v0.11.2 is pinned by commit; dictionaries are pinned via its submodules,
and transitive Swift dependencies are recorded in `engine/Package.resolved`.
The adapter uses the pinned release's API rather than assuming the current
upstream README describes that release exactly. Zenzai is disabled.

The saved [initial measurement](benchmarks/azookey-macos.json) contains all 24
synthetic readings, expected alternatives, returned candidates, and timings:

- Exact expected spelling first: **18/24**.
- Exact expected spelling within first five: **23/24**.
- Warm engine median: **6.94 ms**; p95: **11.41 ms**.
- First subprocess request including startup: **49.52 ms**.

This is a small exact-string check, not a validated accuracy benchmark. For
example, the long-sentence first choice uses valid `晩ごはん` instead of the expected
`晩御飯`/`晩ご飯`; the metric counts that as a first-choice miss. More concerning
examples are `強はいい天気です`, `橋で食べました`, and `雨を食べました`, where the intended
choice is lower in the list. The deliberately difficult repeated-`きしゃ` phrase
misses the expected spelling entirely. There are no invented timing figures or
Mozc scores in that initial report.

The subsequent [Mozc comparison](benchmarks/COMPARISON.md) uses the same fixtures
and 20 timing passes per engine. AzooKey matched 18/24 first choices; Mozc OSS
matched 16/24. Mozc was much faster, but both were fast locally. All 24 Mozc
first-choice results matched its upstream conversion tool. Native mobile
behavior remains untested.

To reproduce it on Apple Silicon macOS with Xcode installed:

```sh
npm run setup:mozc
npm run benchmark:compare
```

Mozc source and Bazelisk are pinned; the downloaded executable is checksum-verified.
Only the conversion worker and OSS dictionary are built, without installing an OS
keyboard. The comparison writes ignored `comparison.local.json`, preserving the
checked-in reports. Mozc returns alternatives per phrase, so they are stored as
segments rather than misrepresented as ranked whole-sentence alternatives.

### Neural experiment

The [neural comparison report](benchmarks/NEURAL-COMPARISON.md) records 22/24 exact
first choices with Zenzai, versus 18/24 for dictionary-only AzooKey. One neural
miss is valid 珈琲 instead of コーヒー. Complete warm requests were about 30 ms
median / 42 ms p95 on this Mac; first-use startup can take seconds. Inference
limit 5 did not improve first choices over limit 1.

```sh
npm run setup:neural
npm run benchmark:neural
```

Run the ordinary `npm run setup` and `npm run setup:mozc` first. The neural setup
builds the same Swift worker with the optional `Neural` trait into a separate
ignored build directory. Its dependency enables upstream's GPU-backed `Zenzai`
trait. It downloads the pinned, checksum-verified zenz-v3-small Q5_K_M model
(72,298,816 bytes), without changing the browser playground's dictionary-only
worker. The model manifest records its revision, checksum, and license.

The neural benchmark compares dictionary-only AzooKey, Mozc, and Zenzai with
inference limits 1 and 5. It uses the same 24 unchanged fixtures, 20 alternating
passes, and five fresh-process startup trials. No personalized context or history
is supplied. `stopComposition()` resets the neural session and conversion cache
before every phrase. Model-loading failure terminates the worker instead of
silently reporting dictionary fallback as neural conversion. Results go to ignored
`neural-comparison.local.json`.

The browser still uses dictionary-only AzooKey; these are local engine experiments,
not a production or cross-platform engine selection.

Useful upstream references:

- [Pinned AzooKey release](https://github.com/azooKey/AzooKeyKanaKanjiConverter/tree/v0.11.2)
- [AzooKey Android/Linux CI](https://github.com/azooKey/AzooKeyKanaKanjiConverter/blob/v0.11.2/.github/workflows/swift.yml)
- [Mozc converter interface](https://github.com/google/mozc/blob/master/src/converter/converter_interface.h)
- [Mozc Android build](https://github.com/google/mozc/blob/master/docs/build_mozc_for_android.md)
- [Mozc versus Google Japanese Input](https://github.com/google/mozc/blob/master/docs/about_branding.md)

## Verification

```sh
npm test
npx playwright install chromium
npm run test:browser
npm run benchmark
```

`npm run benchmark` writes an ignored `results.local.json`; it does not overwrite
the checked-in initial measurement. Set `SCREENSHOT_DIR` when running browser
tests to save desktop and narrow-screen screenshots outside the source tree.
Browser tests cover real conversion and keyboard selection, reload persistence,
stale requests, service errors, native composition key handling, notebook growth,
and mobile overflow. They are browser viewport tests, not simulator/native tests.

## Attribution

- AzooKeyKanaKanjiConverter: MIT; see its downloaded `LICENSE`.
- Its default dictionary: Apache-2.0; see the dictionary submodule's `LICENSE`.
- Additional bundled dictionaries/dependencies retain their own upstream notices.
- Mozc: BSD-3-Clause, with separately licensed dictionary/dependency data; see its
  downloaded `LICENSE` and `src/data/dictionary_oss` notices.
- Zenz-v3-small model: Miwa-Keita, CC-BY-SA-4.0; see
  [the model repository](https://huggingface.co/Miwa-Keita/zenz-v3-small-gguf).
  Model weights are downloaded locally and are not committed to this repository.
- WanaKana: MIT; its license is included in the installed package.
- Tutor artwork is the existing ConvoLab `client/public/images/tutor-hana.webp`.

Keep upstream notices when packaging an engine or distributing the application.
Downloaded third-party sources and build output are ignored, not vendored here.
