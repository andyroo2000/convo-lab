# Mozc versus AzooKey: local conversion experiment

Measured 2026-11-17T20:46:16.938Z on Apple M3, macOS arm64.

The same 24 fixtures were used without changing their accepted spellings. Both engines ran locally in release builds with learning and neural models disabled. Each engine received 480 timed warm conversions (20 passes), with engine order alternating between passes. Five fresh-process startup trials per engine followed, with OS file caches warm.

| Measurement                         |  AzooKey | Mozc OSS |
| ----------------------------------- | -------: | -------: |
| Exact expected first choice         |    18/24 |    16/24 |
| Warm conversion median              |  3.72 ms |  0.39 ms |
| Warm conversion p95                 |  6.60 ms |  1.17 ms |
| Subprocess round-trip median        |  3.96 ms |  0.42 ms |
| Subprocess round-trip p95           |  6.89 ms |  1.21 ms |
| Fresh-process first request, median | 43.98 ms | 11.55 ms |

## Interpretation

AzooKey remains the provisional front-runner for this phrase-at-a-time playground. Mozc was about nine times faster, but both engines were comfortably below a typical 16.7 ms display frame at the warm p95 in this small local test. These measurements do not include HTTP latency, mobile hardware, concurrent users, typing-to-paint, or memory pressure.

The exact-match score is not an accuracy percentage. Mozc’s 橋をわたりました is a valid spelling variant. AzooKey’s long sentence uses valid 晩ごはん instead of the expected 晩ご飯/晩御飯. Both count as misses under the unchanged fixtures. More substantive Mozc errors include 機能 instead of 昨日 and 振っています instead of 降っています. Mozc correctly fixes the 今日 case that AzooKey misses. Both mishandle the chopsticks, candy, hair/paper, and repeated-きしゃ first choices.

All 24 first-choice sentences from the custom Mozc worker were independently checked against the upstream converter_main tool and matched. Mozc alternatives are per segment; no fabricated whole-sentence top-five score is reported. The desired chopsticks, candy, hair, and rain alternatives are present within the first four choices of their respective segments. The repeated-きしゃ phrase can also be constructed from its segment alternatives, unlike the saved AzooKey whole-sentence list.

This is open-source Mozc with its OSS dictionary, not proprietary Google Japanese Input. Upstream documents different dictionary data and placeholder-only OSS collocation data: [Mozc branding and data comparison](https://github.com/google/mozc/blob/a4541df29db443b49f81cf54665873b68fde9efa/docs/about_branding.md). This distinction may help explain weak contextual choices; this experiment does not isolate the cause.

Only macOS was built and measured. Offline iOS/Android and browser-native execution remain unvalidated. The existing browser playground still uses AzooKey; the Mozc adapter is an isolated comparison harness.

## Every first-choice result

| Reading                                                | AzooKey                                      | Mozc OSS                                     | Exact match: Azoo / Mozc |
| ------------------------------------------------------ | -------------------------------------------- | -------------------------------------------- | ------------------------ |
| きのうえいがをみました                                 | 昨日映画を見ました                           | 機能映画を見ました                           | Yes / No                 |
| きょうはいいてんきです                                 | 強はいい天気です                             | 今日はいい天気です                           | No / Yes                 |
| あたらしいほんをかいました                             | 新しい本を買いました                         | 新しい本を買いました                         | Yes / Yes                |
| にほんごをべんきょうしています                         | 日本語を勉強しています                       | 日本語を勉強しています                       | Yes / Yes                |
| そのあとともだちにあいました                           | そのあと友達に会いました                     | その後友達に会いました                       | Yes / Yes                |
| あしたはやくおきます                                   | 明日早く起きます                             | 明日早く起きます                             | Yes / Yes                |
| きんようびにかえります                                 | 金曜日に帰ります                             | 金曜日に帰ります                             | Yes / Yes                |
| くるまをうんてんしました                               | 車を運転しました                             | 車を運転しました                             | Yes / Yes                |
| えいごのじまくがありました                             | 英語の字幕がありました                       | 英語の字幕がありました                       | Yes / Yes                |
| ひこうきがとべなくなりました                           | 飛行機が飛べなくなりました                   | 飛行機が飛べなくなりました                   | Yes / Yes                |
| はしをわたりました                                     | 橋を渡りました                               | 橋をわたりました                             | Yes / No                 |
| はしでたべました                                       | 橋で食べました                               | 橋で食べました                               | No / No                  |
| あめがふっています                                     | 雨が降っています                             | 雨が振っています                             | Yes / No                 |
| あめをたべました                                       | 雨を食べました                               | 雨を食べました                               | No / No                  |
| かみをきりました                                       | 神を切りました                               | 神を切りました                               | No / No                  |
| きしゃがきしゃできしゃにきた                           | 記者が記者で記者に来た                       | 記者が記者で記者に来た                       | No / No                  |
| とうきょうえきでまちあわせしました                     | 東京駅で待ち合わせしました                   | 東京駅で待ち合わせしました                   | Yes / Yes                |
| しんじゅくにいきました                                 | 新宿に行きました                             | 新宿に行きました                             | Yes / Yes                |
| らーめんをたべました                                   | ラーメンを食べました                         | ラーメンを食べました                         | Yes / Yes                |
| こーひーをのみました                                   | コーヒーを飲みました                         | コーヒーを飲みました                         | Yes / Yes                |
| えいがはおもしろかったです。                           | 映画は面白かったです。                       | 映画は面白かったです。                       | Yes / Yes                |
| わたしはがっこうにいきませんでした                     | 私は学校に行きませんでした                   | 私は学校に行きませんでした                   | Yes / Yes                |
| たべなければなりません                                 | 食べなければなりません                       | 食べなければなりません                       | Yes / Yes                |
| きのうともだちとえいがをみてからばんごはんをたべました | 昨日友達と映画を見てから晩ごはんを食べました | 機能友達と映画を見てから晩ごはんを食べました | No / No                  |

See [raw measurements](mozc-vs-azookey-macos.json) for all timings, candidate lists, segments, engine revisions, and startup samples. The original [AzooKey-only measurement](azookey-macos.json) is unchanged.

## Reproduce

```sh
cd tools/japanese-input
npm ci
npm run setup
npm run setup:mozc
npm run benchmark:compare
```

Requires Apple Silicon macOS, Xcode, Node 22+, and Swift 6.1+. The Mozc recipe downloads checksum-verified Bazelisk 1.30.0 and pinned upstream Mozc source; upstream selects Bazel 9.0.2. It builds only a conversion worker and OSS dictionary, without installing an OS keyboard or Qt UI. Build dependencies require network access. Results go to ignored `comparison.local.json`; checked-in measurements are not overwritten.
