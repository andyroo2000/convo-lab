# Expanded menu check — 2026-11-17

Apple M3, release Neural build, pinned AzooKey 0.11.2 and Zenz-v3-small.
Normal-effort inference limit remains 1. No learning or external text context.

The ordinary live result runs unchanged. Opening a menu adds a rich neural pass
and a dictionary full-phrase beam (`N_best: 128`). Original neural candidates
stay first. Dictionary suggestions are context-scored statistically, not all
neural-ranked. A lexical/ending filter suppresses fragmented combinations such
as 派 + 史 for はし and unrelated kanji substitutions in verb endings. The result
is capped at 160 complete phrase candidates before per-section deduplication.

A warm worker was checked on all 24 existing comparison phrases plus こうしょう.
Each phrase ran ordinary conversion followed by expansion. All 24 original top
choices matched the saved neural benchmark, and all 25 expanded top choices
matched their ordinary result. Expanded requests took a median **121.7 ms** and
p95 **164.2 ms** end-to-end through the subprocess. This is a single sequential
pass on one Mac, not a concurrency/mobile performance benchmark.

| Active reading in context     | Ordinary menu choices | Expanded menu choices |
| ----------------------------- | --------------------: | --------------------: |
| こうしょう                    |                    12 |                    63 |
| かみを (かみをきりました)     |                     3 |                     5 |
| きりました (かみをきりました) |                     3 |                     5 |
| はしで (はしでたべました)     |                     4 |                     6 |

Counts include kana/katakana spellings. Added examples include 神を / 紙を,
斬りました / 伐りました, and 公証 / 哄笑 / 工匠. Broader does not mean exhaustive:
beam bounds and compatibility filtering can omit rare words and alternative
segmentations. No isolated-section query is used.

The integration uses a small committed adapter to expose the full-phrase query
already used by AzooKey's CLI. The regular public API truncates sentence
results, so increasing `N_best` alone does not expose the broad list.

Upstream references at the pinned version:

- [Rich candidate option and N-best setting](https://github.com/azooKey/AzooKeyKanaKanjiConverter/blob/v0.11.2/Sources/KanaKanjiConverterModule/ConverterAPI/ConvertRequestOptions.swift)
- [Full-phrase result processing](https://github.com/azooKey/AzooKeyKanaKanjiConverter/blob/v0.11.2/Sources/KanaKanjiConverterModule/ConverterAPI/KanaKanjiConverter.swift)
