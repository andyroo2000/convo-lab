# Fish Audio Evaluation Plan

## Goal

Validate that Fish Audio can be the default provider for ConvoLab audio generation, starting with a focused sample set instead of full component coverage.

## Scope (Phase 1)

Run a small smoke set that exercises the most important audio unit patterns:

1. `L2` full sentence at normal speed
2. `L2` full sentence at slower speed
3. `L2` short phrase (degenerate-output risk case)
4. `L2` kana-only text
5. `L2` with Fish control tags (emotion/breath/tone)
6. `narration_L1` in English

## What We Already Added

- Script: `/Users/andrewlandry/source/convo-lab/server/src/scripts/fish-audio-sample-smoke.ts`
- NPM command: `/Users/andrewlandry/source/convo-lab/server/package.json` -> `smoke:fish-audio`

Run command:

```bash
cd server
npm run smoke:fish-audio
```

Artifacts are written to:

```text
/var/folders/.../convolab-fish-audio-smoke/<timestamp>/
```

including:

- `*.mp3` files per sample
- `results.json`
- `README.md` summary table

## Initial Observations (2026-02-13)

Latest run produced stable outputs across all 6 samples with no heuristic warnings.

## Evaluation Rubric

For each sample, score:

1. **Pronunciation accuracy** (1-5)
2. **Naturalness/prosody** (1-5)
3. **Pacing suitability for learners** (1-5)
4. **Artifact/loop/glitch presence** (pass/fail + notes)
5. **Tag behavior quality** for control-token sample (1-5)

## Phase 2 (Targeted Expansion)

If Phase 1 quality is acceptable, expand to a controlled set of course-like units:

1. 2 mixed L1/L2 micro scripts (10-20 units each)
2. 1 dialogue-heavy sample
3. 1 repetition-heavy sample

Use:

- `server/src/scripts/generate-course-audio-local.ts`
- `server/src/scripts/analyze-course-audio.ts`

## Phase 3 (Production Candidate Criteria)

Fish Audio is ready for broader rollout when:

1. No critical glitches in 20+ sampled units
2. Pronunciation and naturalness average >= 4.0/5
3. Control tags behave predictably in test content
4. No persistent degenerate-duration cases

## Notes

- Current server logic already includes Fish-specific safeguards (single-unit batching + degenerate-audio truncation guard) in `/Users/andrewlandry/source/convo-lab/server/src/services/batchedTTSClient.ts`.
- Script Lab already supports quick Fish experiments:
  - `/api/admin/script-lab/test-pronunciation`
  - `/api/admin/script-lab/synthesize-line`
