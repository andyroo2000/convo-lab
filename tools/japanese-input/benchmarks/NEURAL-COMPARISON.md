# AzooKey neural conversion experiment

Measured 2026-11-17T20:52:13.937Z on Apple M3, macOS arm64.

## Result

**Zenzai at inference limit 1 is the strongest configuration in this small experiment.** It fixes four substantive homophone errors in dictionary-only AzooKey. Raising the limit to 5 produced identical first-choice sentences for all 24 fixtures and slightly higher latency. This is evidence for continuing the neural experiment, not a production or cross-platform selection.

| Measurement                                             | AzooKey dictionary |       Mozc OSS | Zenzai limit 1 | Zenzai limit 5 |
| ------------------------------------------------------- | -----------------: | -------------: | -------------: | -------------: |
| Exact expected first choice                             |              18/24 |          16/24 |          22/24 |          22/24 |
| Expected spelling within five whole-sentence candidates |              23/24 | Not comparable |          23/24 |          23/24 |
| Internal conversion median (ms)                         |               3.71 |           0.40 |          14.47 |          15.91 |
| Internal conversion p95 (ms)                            |               7.45 |           1.16 |          26.35 |          28.17 |
| Complete subprocess request median (ms)                 |               4.02 |           0.43 |          29.74 |          31.03 |
| Complete subprocess request p95 (ms)                    |               7.60 |           1.21 |          41.52 |          43.40 |
| Fresh-process first request median, caches warm (ms)    |              44.30 |          11.75 |         112.95 |         111.95 |

## What improved

| Reading                                                | Dictionary-only AzooKey                      | Zenzai (both limits)                       |
| ------------------------------------------------------ | -------------------------------------------- | ------------------------------------------ |
| きょうはいいてんきです                                 | 強はいい天気です                             | 今日はいい天気です                         |
| はしでたべました                                       | 橋で食べました                               | 箸で食べました                             |
| あめをたべました                                       | 雨を食べました                               | 飴を食べました                             |
| かみをきりました                                       | 神を切りました                               | 髪を切りました                             |
| きのうともだちとえいがをみてからばんごはんをたべました | 昨日友達と映画を見てから晩ごはんを食べました | 昨日友達と映画を見てから晩御飯を食べました |

The first four changes correct meaning. The long sentence changes the valid spelling 晩ごはん to the expected 晩御飯; that is an exact-match improvement, not a correction of meaning.

The two neural exact-match misses are:

- `こーひーをのみました` → `珈琲を飲みました`: valid Japanese, but the unchanged fixture expects `コーヒーを飲みました`. A preference for uncommon kanji may matter for beginner-facing input.
- `きしゃがきしゃできしゃにきた` → `記者が記者で記者に来た`: still misses the intended `記者が汽車で貴社に来た`. It is an intentionally ambiguous stress case.

The strict 22/24 score therefore includes one acceptable spelling variant. This is not a general 92% accuracy estimate. The same test phrases and accepted spellings were preserved throughout; the model was not given the expected answers, user profile, or external sentence context.

## Startup and runtime

The first neural probe took 10.79 seconds inside the engine. The benchmark’s first limit-5 request also took 10.59 seconds; later fresh-process trials for both neural settings were approximately 112–113 ms median with OS/GPU caches already warm. Treat first use as potentially taking seconds. A real product would need to prepare the model before the user requests conversion. These experiments do not establish how often that warmup recurs.

The primary responsiveness measure is the complete subprocess request: roughly 30 ms median / 42 ms p95 for limit 1. Its internal timer reports about 14 ms / 26 ms, but excludes composition reset and interprocess communication. In particular, resetting a neural session adds noticeable cost, so the smaller internal number should not be presented as total response latency.

This is Apple M3 Metal acceleration. Logs confirmed all 13 model layers were offloaded to the GPU. The model download is 72,298,816 bytes (about 72.3 MB / 69.0 MiB); that is not total runtime memory. HTTP latency, service concurrency, per-keystroke interaction, battery use, CPU-only servers, iOS, Android, and in-browser execution have not been measured.

## Method and reproducibility

- Same pinned AzooKey v0.11.2, dictionary submodules, and worker code for dictionary and neural modes. The optional Swift `Neural` trait enables the dependency’s `Zenzai` trait; the normal worker remains dictionary-only.
- Model: [Miwa-Keita/zenz-v3-small-gguf](https://huggingface.co/Miwa-Keita/zenz-v3-small-gguf), Q5_K_M, revision `d48369e21adb9f49903eb7c54be1a1d9723eb805`, SHA-256 `501f605d088f5b988791a00ae19ed46985ed7c48144f364b2f3f1f951c9b2083`.
- Learning, prediction, personalization, external context, and rich-candidate generation disabled. Whole-phrase kana input, no incremental typing.
- `stopComposition()` runs before every request and clears composition and neural-session caches; the model remains loaded. Upstream model-load failure is checked to prevent silently measuring dictionary fallback.
- One initial request and a complete warmup pass, then 20 passes alternating engine order: 480 timed conversions per configuration. First-choice text remained stable on every repeated sample. Five fresh-process startup trials follow, again alternating order.
- Mozc returns segmented candidates; its whole-sentence top-five metric is deliberately omitted.
- Original [AzooKey-only](azookey-macos.json) and [Mozc comparison](https://github.com/andyroo2000/convo-lab/blob/8d3156cc/tools/japanese-input/benchmarks/mozc-vs-azookey-macos.json) reports remain intact. Timing variation between runs is expected.

```sh
cd tools/japanese-input
npm ci
npm run setup
npm run setup:mozc
npm run setup:neural
npm run benchmark:neural
```

New results go to ignored `neural-comparison.local.json`. See [all raw measurements and candidate lists](https://github.com/andyroo2000/convo-lab/blob/8d3156cc/tools/japanese-input/benchmarks/zenzai-vs-dictionary-macos.json). This comparison did not change the production app. The current interactive playground configuration is documented in [the README](../README.md).

## Every first choice

| Reading                                                | Dictionary                                   | Mozc OSS                                     | Zenzai (both limits)                       |
| ------------------------------------------------------ | -------------------------------------------- | -------------------------------------------- | ------------------------------------------ |
| きのうえいがをみました                                 | 昨日映画を見ました                           | 機能映画を見ました                           | 昨日映画を観ました                         |
| きょうはいいてんきです                                 | 強はいい天気です                             | 今日はいい天気です                           | 今日はいい天気です                         |
| あたらしいほんをかいました                             | 新しい本を買いました                         | 新しい本を買いました                         | 新しい本を買いました                       |
| にほんごをべんきょうしています                         | 日本語を勉強しています                       | 日本語を勉強しています                       | 日本語を勉強しています                     |
| そのあとともだちにあいました                           | そのあと友達に会いました                     | その後友達に会いました                       | そのあと友達に会いました                   |
| あしたはやくおきます                                   | 明日早く起きます                             | 明日早く起きます                             | 明日早く起きます                           |
| きんようびにかえります                                 | 金曜日に帰ります                             | 金曜日に帰ります                             | 金曜日に帰ります                           |
| くるまをうんてんしました                               | 車を運転しました                             | 車を運転しました                             | 車を運転しました                           |
| えいごのじまくがありました                             | 英語の字幕がありました                       | 英語の字幕がありました                       | 英語の字幕がありました                     |
| ひこうきがとべなくなりました                           | 飛行機が飛べなくなりました                   | 飛行機が飛べなくなりました                   | 飛行機が飛べなくなりました                 |
| はしをわたりました                                     | 橋を渡りました                               | 橋をわたりました                             | 橋を渡りました                             |
| はしでたべました                                       | 橋で食べました                               | 橋で食べました                               | 箸で食べました                             |
| あめがふっています                                     | 雨が降っています                             | 雨が振っています                             | 雨が降っています                           |
| あめをたべました                                       | 雨を食べました                               | 雨を食べました                               | 飴を食べました                             |
| かみをきりました                                       | 神を切りました                               | 神を切りました                               | 髪を切りました                             |
| きしゃがきしゃできしゃにきた                           | 記者が記者で記者に来た                       | 記者が記者で記者に来た                       | 記者が記者で記者に来た                     |
| とうきょうえきでまちあわせしました                     | 東京駅で待ち合わせしました                   | 東京駅で待ち合わせしました                   | 東京駅で待ち合わせしました                 |
| しんじゅくにいきました                                 | 新宿に行きました                             | 新宿に行きました                             | 新宿に行きました                           |
| らーめんをたべました                                   | ラーメンを食べました                         | ラーメンを食べました                         | ラーメンを食べました                       |
| こーひーをのみました                                   | コーヒーを飲みました                         | コーヒーを飲みました                         | 珈琲を飲みました                           |
| えいがはおもしろかったです。                           | 映画は面白かったです。                       | 映画は面白かったです。                       | 映画は面白かったです。                     |
| わたしはがっこうにいきませんでした                     | 私は学校に行きませんでした                   | 私は学校に行きませんでした                   | 私は学校に行きませんでした                 |
| たべなければなりません                                 | 食べなければなりません                       | 食べなければなりません                       | 食べなければなりません                     |
| きのうともだちとえいがをみてからばんごはんをたべました | 昨日友達と映画を見てから晩ごはんを食べました | 機能友達と映画を見てから晩ごはんを食べました | 昨日友達と映画を見てから晩御飯を食べました |
