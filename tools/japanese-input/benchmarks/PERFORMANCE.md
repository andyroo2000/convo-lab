# Desktop, server, and iOS feasibility measurements

Measured November 17, 2026. Experimental branch: `codex/japanese-input-performance`.
No production Journal integration or TestFlight release is included.

## Recommendation

**Keep the system Japanese keyboard as the default for web for now.** Ordinary
Chrome conversion is promising, but the full requested experience includes
moving section boundaries and reranking a large candidate pool. That still
pauses for seconds. Moving the same engine to the current CPU server makes
that particular interaction slower and adds queueing between users.

Continue native-device work, with a physical iPhone benchmark before promising
phone performance. The existing Mac Metal result is encouraging; simulator CPU
measurements do not establish iPhone or Android speed. Browser GPU inference or
a dedicated GPU service remain unmeasured options, not proven impossibilities.
Neither is implemented by this experiment.

The installed Safari baseline and optimized build have now both completed with
the Mac unlocked and kept awake. Neither showed acceptable full-boundary
ranking latency. The earlier stalled, locked run remains excluded. These are
actual Safari measurements, in addition to the separate WebKit functional tests.

## Measured responsiveness

| Configuration                                         | Ordinary median | Ordinary p95 | Fresh full boundary ranking |
| ----------------------------------------------------- | --------------: | -----------: | --------------------------: |
| Installed Chrome, original browser port               |          105 ms |       178 ms |                   5.5–6.6 s |
| Installed Chrome, batched + shared-prefix scoring     |           99 ms |       163 ms |                   5.4–5.9 s |
| Installed Safari, original browser port               |          356 ms |       626 ms |                 19.3–23.4 s |
| Installed Safari, batched + shared-prefix scoring     |          353 ms |       543 ms |                 19.2–23.3 s |
| Existing server, CPU, including measured network trip |          203 ms |       374 ms |                 23.7–28.9 s |
| iOS simulator, CPU fallback on this Mac               |          100 ms |       121 ms |                 11.0–13.0 s |

Chrome is version **157.0.8103.79**; Safari **26.6.2**. Host: Apple M3 Mac.
Every row uses three passes, 72 samples. Chrome and Safari workers restart
between passes; server and
simulator use native composition reset before every request. Models are
preloaded. p95 is nearest-rank, not interpolation. These small samples are
comparative experiments, not service-level guarantees.

Full boundary ranking means all 160 candidates receive whole-phrase neural
scores. Browser boundary request two uses the same phrase as request one and
can reuse scores: **2.07 s original / 1.93 s optimized** in the final Chrome
runs. Safari took **7.21 s original / 7.27 s optimized** for this partially
cached request. It is excluded from the fresh-ranking ranges above. The server and
simulator do not use this new browser prefix-score cache.

Growing-prefix Chrome requests took **17–58 ms original / 17–55 ms optimized**
for the eight prefixes of すしをたべました. This is why ordinary typing can feel
much better than a full boundary rerank. Safari growing-prefix requests took **63–187 ms original / 64–188 ms optimized**.
The measurements exclude the UI conversion debounce and paint time.

The earlier native Mac Metal experiment measured approximately **30 ms median /
42 ms p95 complete ordinary requests**. Its later full boundary ranking test
was about **1.2–1.3 seconds**. Those are separate runs, not simultaneous controls
for this table. Even native full-pool ranking deserves interaction work.

## Optimization results

The implementation batches output-token scoring inside Wasm, keeps the full
vocabulary probability normalizer, and caches likelihoods for shared candidate
prefixes. Normal-effort inference, the model weights, and the candidate pool
remain unchanged. Review requests transfer only the three probabilities they
actually inspect; full candidate scores still use every vocabulary logit.

The controlled Chrome rerun shows a **modest** improvement, not a dramatic
breakthrough. In Safari, median ordinary and fresh-ranking times were nearly
unchanged; batching and prefix caching did not solve the bottleneck. Earlier runs during toolchain preparation were slower; their raw
files are retained but are not used to claim an inflated speedup. The first
single-thread batch-only experiment was slower still (285 ms ordinary median,
roughly 18–21 seconds for fresh ranking), and is not the recommended variant.
A build flag issue in the multithread worker pool was fixed and the complete
custom build script was rerun successfully.

A direct numerical test compares the optimized scorer with token-by-token
full-vocabulary scoring across shared prefixes, changed prompts, and cache
hits. All five scores agreed within **0.002 log-likelihood units**. Separate
unit tests cover prompt separation, bounded caches, and invalid inference.

## Conversion quality

Against the original native Mac corpus:

- Final Chrome and Safari original and optimized runs, server, and iOS CPU simulator each
  matched the native **first choice on all 72 ordinary requests**.
- All four boundary cases matched the native **first choice** on each platform.
- Chrome, Safari, and server preserved all **160 candidate texts** in each boundary pool.
- iOS retained 160 candidates per pool, but one pool shared **159/160** texts
  with the Mac reference. iOS uses `Float16` dictionary candidate values; that
  is a plausible source of the difference, not a confirmed causal diagnosis.
- Lower-ranked order differs between inference backends. These results do not
  establish bit-for-bit ranking parity, or general Japanese accuracy beyond
  the 24 existing fixtures.

The iOS adapter now explicitly converts platform score types. Neural sorting
uses full `Float` scores before storing them in the platform candidate type,
so sorting does not introduce additional Float16 ties. Typo correction is
explicitly off on every platform for consistent direct-kana fixture input.

## Server experiment

The actual existing DigitalOcean host has two vCPUs, 8 GiB RAM, and no GPU.
The isolated runtime was capped at **one CPU / 1 GiB RAM**, preserving headroom
for production. This is not a measurement of a dedicated GPU server or the
maximum performance obtainable by using every host resource.

Requests used HTTP through a persistent SSH tunnel. Measured baseline network
round trip was **22 ms median** (20–56 ms range). This includes WAN travel but
not public API routing/TLS, and represents one client location. Other locations
and a real public service may incur additional delay.

| Simultaneous ordinary requests | Slowest completion |
| ------------------------------ | -----------------: |
| 2                              |             397 ms |
| 4                              |             873 ms |
| 8                              |           1,559 ms |

A full boundary rerank followed 100 ms later by a short typing request caused
**both to take about 26.8 seconds** on the shared worker. Faster hardware alone
would not eliminate the need for request scheduling, cancellation, per-user
isolation, and load controls. This test is not a sustained capacity benchmark.

Only public fixtures were sent. The listener bound to loopback; no public
routes, credentials, database records, or production containers were changed.
The temporary runtime, build container, newly pulled Swift image, and remote
experiment files were removed afterward. Host free disk returned to 7.5 GiB;
production and staging health checks both passed.

## iOS findings and limits

The actual iOS simulator executable builds and runs the same dictionary,
normal-effort neural model, and section-boundary adapter. The simulator is
**iOS 26.2, iPhone 17 Pro profile**, running on the Mac's hardware.

The initial Metal configuration failed during model loading, reporting an
Apple iOS simulator GPU with zero available memory and a model-load error.
The failure repeated with the Mac unlocked and after the new simulator fully
finished booting, so unlocking did not resolve it. The cause has not been
isolated. This is a command-line worker launched through `simctl`, not a UIKit
app. Do not conclude that the same model cannot run on a physical iPhone.

A separate, explicitly labelled **one-thread CPU fallback** completed the
corpus and all boundary cases. Its roughly 100 ms ordinary median measures
host-Mac CPU behavior under the iOS runtime, not an iPhone. No physical-device
latency, energy, thermal, Android, or TestFlight result is claimed.

## Reproduction and evidence

See [experiment setup and commands](../performance/README.md). The original
model revision, dictionary pins, and baseline fixtures remain unchanged. The
browser port's approximately 165 MB initial assets remain a separate delivery
concern; local ready times of a few hundred milliseconds exclude a real first
internet download.

Primary raw files:

- [Chrome original final run](https://github.com/andyroo2000/convo-lab/blob/8d3156cc/tools/japanese-input/benchmarks/performance-chrome-baseline-final.json)
- [Chrome optimized final run](https://github.com/andyroo2000/convo-lab/blob/8d3156cc/tools/japanese-input/benchmarks/performance-chrome-prefix-final.json)
- [Unlocked Safari original run](https://github.com/andyroo2000/convo-lab/blob/8d3156cc/tools/japanese-input/benchmarks/performance-safari-baseline-unlocked.json)
- [Unlocked Safari optimized run](https://github.com/andyroo2000/convo-lab/blob/8d3156cc/tools/japanese-input/benchmarks/performance-safari-prefix-unlocked.json)
- [Actual server, network and concurrency](https://github.com/andyroo2000/convo-lab/blob/8d3156cc/tools/japanese-input/benchmarks/performance-server.json)
- [iOS simulator CPU fallback](https://github.com/andyroo2000/convo-lab/blob/8d3156cc/tools/japanese-input/benchmarks/performance-ios-cpu.json)
- [Unlocked simulator Metal failure](performance-ios-metal.json)

The older Chrome baseline includes cached second and third passes. Do not
aggregate those into an uncached latency number. The failed, locked Safari
optimization run is kept only in ignored local diagnostic output.

Validation: 25 existing unit tests, 26 native-playground browser tests, 11
optimized Chromium tests, 11 optimized WebKit tests, four prefix-cache tests,
and one direct neural-score comparison passed. The iOS and server release
builds and the custom Wasm build completed. The rebuilt Mac worker also preserved all 24 ordinary and four boundary first
choices. The CodeScene MCP staged safeguard passed with **21/21 eligible source
files checked**, no new findings or declines. The two shell scripts are
unsupported by CodeScene; both passed shell syntax checks and actual builds.
