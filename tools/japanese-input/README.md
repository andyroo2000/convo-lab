# Japanese typing playground

An isolated, local experiment for ConvoLab. It does not change Journal routes,
create entries, or call the production API. It uses the site's existing tutor
asset and notebook colors.

## Run

Requires Apple Silicon macOS, Xcode, Node 22+, and Swift 6.1+
(tested with Apple Swift 6.2.4 on an M3 Mac).

```sh
cd tools/japanese-input
npm ci
npm run setup
npm run setup:neural
npm start
```

Open **http://127.0.0.1:5188**. Set `PORT` to use another local port. Initial setup
downloads the pinned upstream source, dictionaries, Swift dependencies, and
upstream binary artifacts; it needs network access and several hundred MB.
No API keys or ConvoLab environment files are needed.

The server starts normal-effort Zenzai (inference limit 1) immediately and warms
it with three synthetic phrases before accepting conversion requests. Wait for
**Ready to write · Neural conversion**. First use can take several seconds;
the model stays loaded between phrases and page reloads. If loading fails, the
page offers **Try again**. Ensure `npm run setup:neural` completed successfully.
Readiness is available at `GET /api/v1/engine`; `POST /api/v1/engine/retry` starts
a fresh warmup. Saved notebook and pending-phrase text are retained during retry.

Type romaji **directly in the notebook**. Kana appears immediately; after a
250 ms pause on a complete kana sound, normal-effort Zenzai suggests kanji for
the **entire unfinished phrase**. The underlined text remains uncommitted.
This delay is a UI heuristic, not a calibrated confidence threshold.

- Space opens section choices (and advances through them when already open).
- Left/Right selects a section; Up/Down changes that section's spelling.
- Shift + Left shortens the selected section by one reading character;
  Shift + Right extends it into the next section. Consuming the next section
  merges it; shortening the final section creates a new one. Neither action
  commits text. Requested breaks and unaffected choices survive further typing.
- The candidate window prefers the space above the active section, falling below
  when there is not enough room. It scrolls, with kana above the best suggestion.
- Enter commits the whole composition; another Enter inserts a newline.
- Escape restores the whole reading to kana. Keep kana also commits that reading.
- Continuing to type extends the original reading and re-converts it with its
  complete context. Explicit section choices are retained. If a new engine
  boundary overlaps a chosen section, the overlapping remainder stays kana.
- Clicking elsewhere or switching to ABC commits the displayed text.

AzooKey's public `Candidate.makePrefixClauseCandidate` supplies the primary
clause boundaries. Its dictionary units align alternative whole-phrase candidates
to those boundaries (literal kana edges may be split, never guessed kanji
readings). Alternatives therefore retain their whole-phrase ranking; no section
is converted in isolation. Kana and katakana are additional explicit spelling
choices. Opening a section menu requests a richer neural candidate pass plus a wider
128-path dictionary beam over the same full reading. Existing neural choices
remain first; supplemental dictionary choices use AzooKey's whole-phrase
statistical scoring, not neural scoring. Kana/katakana remain explicit options.
Candidates preserve lexical cores, kana particles, and verb endings to suppress
fragment recombinations. This is broader, but bounded rather than an exhaustive
native dictionary lookup. Some rare spellings or alternative word boundaries
may still be absent. Expansion never changes the selected spelling or section.

Manual breaks use the same complete reading. A constrained dictionary lattice
removes edges crossing a requested break while retaining whole-phrase scoring.
In neural builds, up to 160 unique, complete, boundary-compatible sentences are
then reranked by the **same pinned Zenz-v3-small model**, using conditional
log-likelihood of the full output plus EOS given the full kana reading. The
response includes `neuralScore` on these candidates. A separate preloaded model
context isolates scoring from live conversion; it uses additional memory and
currently recomputes each sentence rather than batching or sharing prefix work.
Normal live conversion still uses inference limit 1 unchanged.

The initial native reranker takes roughly one second for a broad menu on this M3
in a small four-phrase probe; this is not a cross-device performance benchmark.
Resizing responds immediately with safely aligned cached choices, then updates
pending sections when ranked results arrive. Explicit choices made while waiting
are preserved. No section is sent for isolated conversion, and opaque kanji
splits temporarily fall back to kana. Dictionary-only builds retain their
statistical ranking. A neural scoring failure returns a recoverable error;
it is never silently presented as successful neural ranking.

Live typing coalesces into the newest pending phrase. Menu expansion is a
separate on-demand request, reused while navigating the same composition; it
is invalidated by further typing or committing. Only one request per lane runs
at a time, and the shared worker processes requests sequentially. Stale results after edits, commit, or native IME activation are ignored.
A visual overlay adds section underlines while the real textarea retains native
selection, clipboard, accessibility, and automatic height behavior.

Use the 日本語 / ABC toggle for English text. In Japanese mode, period/comma and
question/exclamation marks become 。、？！, and slash `/` becomes the middle dot `・`
(as in ハリー・ポッター). Use ABC mode for a literal slash. Your existing OS Japanese IME passes
through unchanged. Paste remains literal. Select existing kana and press Space
to convert it again. Cursor edits and replacement selections preserve the rest
of the notebook. Undo/redo covers committed compositions and ordinary edits;
up to 100 snapshots are kept for the current page session.

Notebook text is saved in this browser's local storage, including the currently
visible composition. Reload keeps the text but ends the active composition.
If the previous separate phrase box had unfinished text, a Restore unfinished
phrase button lets you recover it explicitly. Copy text exports the notebook.
Conversion runs locally in a persistent subprocess; the neural model runs on this
Mac, with no Google conversion API or persistent learning. The page loads its
font styles from Google Fonts, as the existing site does.

This is an **inline notebook input experiment**, not a system-wide keyboard.
There is no phrase-boundary resizing, reverse conversion of committed kanji,
or WaniKani-aware candidate annotation yet. Native iOS/Android interfaces and
real mobile software keyboards have not been validated by the viewport tests.

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
    "id": "azookey-zenzai-limit-1",
    "version": "0.11.2",
    "revision": "80b8204f1cdfb364bb2ed355cf52c7ebb2519a0c",
    "neural": true,
    "inferenceLimit": 1,
    "learning": false
  },
  "reading": "きのうえいがをみました",
  "candidates": [{ "text": "昨日映画を見ました", "reading": "きのうえいがをみました" }],
  "engineMs": 7.2
}
```

The response above is illustrative and shows a subset of the engine metadata. `engineMs` measures conversion, not network
latency. Candidate arrays may be empty. Only full-reading candidates are returned;
partial completions must never replace and silently discard the remainder.
Requests accept one line of 1–120 characters after NFC normalization and trimming.
Optional `"boundaries": [2, 5]` supplies ordered interior UTF-16 reading offsets
for manual breaks. Offsets must land between complete graphemes in the normalized
reading. The browser sends them with `expanded: true` and always includes the
entire reading. Changing a break invalidates any earlier menu request. The
constrained adapter returns whole-phrase candidates whose dictionary units do not
cross a requested break; the browser groups those units into the selected spans.

Set `"expanded": true` on a conversion request to broaden the menu. It is optional
and strictly boolean. Expanded responses include `expansion: "whole-phrase-neural-and-dictionary"`
and at most 160 complete-phrase candidates; ordinary responses remain capped at 10.
Invalid requests return 400; a busy, missing, failed, or timed-out engine returns 503. The browser discards stale responses and keeps the pending phrase on failure.

The worker loads dictionaries once, handles requests sequentially, and resets
composition between conversions. The bridge bounds the pending queue at 16 and
times out after 60 seconds in neural mode. Readiness detects worker failure and
requires another warmup through Try again before resuming. No shared
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
The initial dictionary experiment used the pinned release's API with Zenzai
disabled. The current menu expansion adds a small, version-checked adapter:
The tracked Swift files in `engine/adapter/` are copied into the downloaded module
by both setup commands and `npm run build:engine`. It exposes the same internal
full-phrase query used by AzooKey's bundled CLI, avoiding the normal UI result
truncation. It does not change the conversion algorithm or existing upstream
files. The adapter source is committed here; the downloaded dependency remains
ignored. Neural live suggestions retain their original normal-effort settings.

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

The interactive browser now uses normal-effort Zenzai with startup preloading.
The original dictionary-only worker remains available for benchmark comparisons.
This is a local experiment, not a production or cross-platform engine selection.

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
Browser tests cover real inline neural conversion, candidate preview/selection,
mid-paragraph edits, undo/redo, Escape/backspace, native composition events,
clipboard cuts, punctuation, English mode, legacy phrase recovery, reload
persistence, stale responses, readiness/retry, notebook growth, and popup bounds. They are browser viewport tests, not simulator/native tests.

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
