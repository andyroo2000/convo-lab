# Faster fresh section adjustments — 2026-11-19

The Chrome playground now computes the shared reading prompt once and reuses
that neural state for every candidate. It still evaluates every candidate's
complete continuation, including EOS, with the same model and full vocabulary.
No candidate pruning, reduced effort, prefetching, or dictionary-only ranking
is used to obtain the improvement.

## Original benchmark cases

Apple M3 / 24 GB, installed Chrome 157.0.8103.79, headed browser:

| Request | Previous WebGPU | Shared prompt |
| --- | ---: | ---: |
| はしでたべました, boundary 1 | 1,637 ms | **763 ms** |
| Same reading, boundary 2 (partially cached) | 696 ms | **317 ms** |
| きょうはいいてんきです, boundary 3 | 1,790 ms | **778 ms** |
| かみをきりました, boundary 2 | 1,557 ms | **672 ms** |
| Immediate identical-boundary repeats | 19–29 ms | **18–30 ms** |
| Ordinary conversion median / p95 | 90 / 147 ms | **88 / 140 ms** |

Fresh adjustments on the original cases are about **2.1–2.3× faster**, now
roughly **0.7–0.8 seconds**. Ordinary typing is effectively unchanged. Timings
are end-to-end, including candidate generation and all neural scoring.

## Wider quality check

We additionally constrain a section boundary on every one of the 24 original
phrases: shrink the first natural section by one character, or grow a one-character
section to two. Both configurations receive the identical request, following an
ordinary conversion. Different readings invalidate the whole-sentence score cache.
The run includes the long phrase about seeing a movie and then eating dinner.
Across these 24 fresh adjustments, median latency falls from **1.87 s to
0.85 s**. The longest case falls from **4.09 s to 1.84 s**; the 95th-percentile
case in this small corpus falls from **2.44 s to 1.16 s**.

- All 24 retain the exact candidate set, per-candidate section/unit structures,
  winning candidate, and **ordered top five**.
- The 21 cases with a 160-item pool still return all 160. Three dictionary pools
  naturally contain 68, 80 and 128 candidates; these counts also remain identical.
- The 72 ordinary conversions (24 phrases × 3 runs) retain the complete ordered
  candidate lists and section structures.
- The original four constrained cases and their repeats also retain their
  candidate sets, section structures and top five.
- All 85 native tokenizer comparison samples continue to match.

Full boundary order is not bit-identical. On the original three fresh-reading
sweep cases, shared prompting changes scores by at most about 0.0201, with a few
adjacent alternatives trading places. The first differences occur at positions
15 and 66 for the first two cases; the third preserves all 160 positions. This
is a much smaller difference than the earlier old-CPU-to-WebGPU transition, but
should not be described as exact ranking parity. No top-five regression was
observed in this corpus; that is not a guarantee for every possible phrase.

The machine-readable `WEBGPU-SHARED-SUMMARY.json` contains before/after timings,
full-list counts, matching positions, and maximum score changes for the wider
corpus. Longer inputs still take longer; this optimization is not a promise of
instantaneous section changes on every device.

## Why this helps

Profiling found only about 7–11 ms in tokenization and worker communication,
versus roughly 1.5–1.7 seconds decoding the model and another 0.1 seconds
normalizing the full-vocabulary scores. Increasing full-sentence batch sizes
from 16 / 512 tokens to 32 / 1024 or 64–128 / 2048 did not help; the largest
batches were slower. Those negative results are preserved.

The selected design keeps the original 16-candidate / 512-token batch limits:

1. Verify every candidate has the exact same prompt token prefix.
2. Decode that prefix once into a dedicated prompt-only sequence.
3. Retain its final full-vocabulary scores for each candidate's first token.
4. Share the prompt KV rows with independent candidate sequences. Decode and
   score every remaining target, including EOS, against the full vocabulary.
5. Remove candidate-only rows between batches; keep the prompt rows intact.
6. Reset the shared context for a new scoring call. Reuse the existing
   reading-scoped sentence-score cache only where it already applied.

This reduces decoded tokens from 3,671 / 4,241 / 3,563 to
1,285 / 1,378 / 1,177 in the three original fresh-reading cases. EOS is scored;
we simply do not feed it back into the model after the last required probability.
Every candidate still has the full reading prompt and its own preceding text
as context, with the original token positions.

No inference weights, quantization, dictionary, tokenizer rules, or normal-effort
review limits changed. The browser model SHA-256 remains
`1066c65d6e0ee746fb749634fd8c60e927dbf4e1313a54ce709a517f5d0ab779`.
All inference remains local in the browser.

## Validation and reproduction

The final custom WebGPU runtime builds successfully. Tests pass:

- 25 existing unit/protocol tests.
- 11 installed-Chrome interaction tests, including offline conversion, resizing,
  complete candidate menus, commits, undo, autosave, and worker restart.
- 4 new scoring tests covering multiple batch sizes, EOS-only continuations,
  invalid-shape errors and recovery, and context reconstruction.
- 85 exact native-tokenizer comparisons.
- Automated corpus comparison of 72 ordinary results, 24 new boundary cases,
  and eight original boundary/repeat results.

Use `NEURAL_GPU=gpu` to enable the new default. Set `GPU_SHARE_PROMPT=0` to
compare the previous full-batch path. Profiling is opt-in with `GPU_PROFILE=1`.
CodeScene MCP reviewed all 10 changed source files at 10/10 with no findings;
the staged safeguard and change-set gate both passed with full eligible coverage.

Commands and pinned dependencies are in `../performance/webgpu/README.md`.

The sweep reports are losslessly compressed to keep the complete candidate data
without adding hundreds of thousands of generated JSON lines to review.

Raw evidence: `webgpu-batch-sweep.json.gz`, `webgpu-shared-sweep.json.gz`,
`webgpu-shared-quality.json.gz`, `webgpu-gpu-shared-final.json`, and
`WEBGPU-SHARED-SUMMARY.json`. Runs were sequential, without compilation during
measurement. The batch sweeps use two passes of three cases; the wider corpus
uses one pass per configuration. These are development measurements on one Mac,
not population-level latency estimates. The original large download and broader
browser/device compatibility work remain unchanged.

Follow-up work remains in `convo-lab-r51i`: real-device/browser coverage, first-visit
download reduction, and production integration. Local issue notes were updated
and exported. The repository's existing Beads Git sync fails with `git status`
exit 128; source and benchmark evidence are preserved on the experiment branch
independently of that tracker integration.
