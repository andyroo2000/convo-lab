# Browser neural conversion comparison

Measured on 2026-11-17 on an Apple M3 Mac. This is a local playground experiment, not a production deployment.

## Result

The browser matched the native playground’s first choice and complete ordinary candidate ordering for all 24 existing test phrases. The four adjusted-boundary cases also matched the native first choice and preserved all 160 candidate texts in each pool. Neural scores and the ordering of lower-ranked boundary alternatives differ between inference backends; this is not bit-for-bit ranking parity.

The same model tensors and normal-effort setting (inference limit 1) are used. Dictionary/lattice conversion and constrained whole-phrase search run as compiled Swift WebAssembly; neural evaluation runs locally through wllama. Conversion works after disconnecting the network.

## Timing

| Measurement                | Native (Metal) | Browser (Chromium, Wasm CPU) |
| -------------------------- | -------------: | ---------------------------: |
| Ordinary conversion median |        24.9 ms |                      99.0 ms |
| Ordinary conversion range  |   15.9–35.2 ms |                34.6–269.0 ms |

One sequential pass of the unchanged corpus, with caches retained between requests. These are engine-reported durations, excluding the UI debounce, initial asset download, and page rendering. The native process was already running. The browser opened a fresh page using loopback-hosted assets; its 848 ms ready time does not represent an internet first visit or first-inference latency. Timings vary with device and browser.

### Adjusted sections, full 160-candidate neural ranking

| Reading                | Boundary after kana | Native | Browser | Same ranked positions |
| ---------------------- | ------------------: | -----: | ------: | --------------------: |
| はしでたべました       |                   1 | 1.30 s |  6.74 s |                71/160 |
| はしでたべました       |                   2 | 1.25 s |  2.15 s |                56/160 |
| きょうはいいてんきです |                   3 | 1.30 s |  6.78 s |                54/160 |
| かみをきりました       |                   2 | 1.16 s |  5.93 s |                63/160 |

The second はし request reuses scores from the first request; its 2.15 s time is a partially cached boundary adjustment, not an independent cold ranking. The other full-ranking requests took roughly 6–7 seconds. WebKit exploratory runs took roughly 19–23 seconds for a first full ranking. Firefox exceeded the 65-second conversion timeout even with one model thread. These delays need improvement before main Journal integration.

## Phrase results

| Reading                                                | First choice (both engines)                | Native ms | Browser ms |
| ------------------------------------------------------ | ------------------------------------------ | --------: | ---------: |
| きのうえいがをみました                                 | 昨日映画を観ました                         |      26.1 |      136.2 |
| きょうはいいてんきです                                 | 今日はいい天気です                         |      27.2 |       71.8 |
| あたらしいほんをかいました                             | 新しい本を買いました                       |      27.3 |      111.5 |
| にほんごをべんきょうしています                         | 日本語を勉強しています                     |      21.7 |      126.6 |
| そのあとともだちにあいました                           | そのあと友達に会いました                   |      25.8 |      118.4 |
| あしたはやくおきます                                   | 明日早く起きます                           |      20.1 |       85.8 |
| きんようびにかえります                                 | 金曜日に帰ります                           |      28.2 |       89.3 |
| くるまをうんてんしました                               | 車を運転しました                           |      17.7 |       89.6 |
| えいごのじまくがありました                             | 英語の字幕がありました                     |      25.8 |      110.4 |
| ひこうきがとべなくなりました                           | 飛行機が飛べなくなりました                 |      28.4 |      126.1 |
| はしをわたりました                                     | 橋を渡りました                             |      20.8 |       74.8 |
| はしでたべました                                       | 箸で食べました                             |      25.1 |       35.2 |
| あめがふっています                                     | 雨が降っています                           |      17.7 |       80.5 |
| あめをたべました                                       | 飴を食べました                             |      18.0 |       34.6 |
| かみをきりました                                       | 髪を切りました                             |      20.0 |       69.7 |
| きしゃがきしゃできしゃにきた                           | 記者が記者で記者に来た                     |      23.4 |      118.6 |
| とうきょうえきでまちあわせしました                     | 東京駅で待ち合わせしました                 |      26.6 |      142.6 |
| しんじゅくにいきました                                 | 新宿に行きました                           |      26.1 |       92.1 |
| らーめんをたべました                                   | ラーメンを食べました                       |      15.9 |       94.8 |
| こーひーをのみました                                   | 珈琲を飲みました                           |      24.5 |       53.0 |
| えいがはおもしろかったです。                           | 映画は面白かったです。                     |      16.8 |      135.9 |
| わたしはがっこうにいきませんでした                     | 私は学校に行きませんでした                 |      31.1 |      141.6 |
| たべなければなりません                                 | 食べなければなりません                     |      24.7 |      103.1 |
| きのうともだちとえいがをみてからばんごはんをたべました | 昨日友達と映画を見てから晩御飯を食べました |      35.2 |      269.0 |

Both engines match 22/24 fixture target strings. For きしゃがきしゃできしゃにきた, both produce 記者が記者で記者に来た rather than the intended homophone-heavy target. Both use 珈琲 rather than the fixture’s コーヒー, a legitimate spelling variant. This small corpus establishes parity on these examples, not a general accuracy percentage.

## Compatibility and verification

- 25 existing unit/protocol tests passed.
- 26 original native-backed browser tests passed.
- 11 browser-only interaction tests passed in Chromium and the same 11 passed in WebKit.
- Firefox is not a passing platform: exhaustive neural ranking times out.
- Tokenizer parity: 85/85 sequences match the native implementation, including spaces, mixed scripts, special tags, punctuation and emoji.
- Interaction checks cover live conversion, section navigation, Shift-arrow boundary changes, expanded candidates, pinned choices, commit/cancel, editing in the middle, undo/redo, romaji shortcuts, native composition events, stale responses, offline conversion, autosave, model retry, and mobile popup bounds.
- Desktop and mobile-width screenshots were inspected. Real iPhone/Android hardware performance has not been measured. WebKit desktop automation is not a substitute for that.

## Remaining work before shipping

The engine, dictionary and model total about 165 MB uncompressed, before the small UI and additional inference runtime. The model is about 72 MB of that. Download/packaging work and real-device memory testing remain necessary. Model downloads are cached when browser storage permits; this prototype is not a fully installable offline PWA.

Keep the existing native playground available while optimizing full-list ranking. Follow-up issue `convo-lab-r51i` tracks batching/acceleration, Firefox latency, initial payload and device testing. Candidate pools and neural quality should be preserved while improving speed. Main Journal integration remains deferred.

## Reproduction and evidence

- [Build and run instructions](../browser/README.md)
- [Complete native/browser comparison data](browser-comparison.json)
- [Tokenizer parity data](browser-tokenizer.json)
- `npm run benchmark:browser` regenerates the comparison against native port 5188 and browser port 5189.
