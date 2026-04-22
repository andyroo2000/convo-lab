# Study Migrations Notes

The study subsystem intentionally keeps its migration chain unsquashed in this PR because several
later migrations are corrective fix-ups for production safety and reviewer follow-up.

Apply order:

- Prisma applies these migrations in timestamp order; do not reorder or cherry-pick individual
  study migrations.

Corrective migrations worth calling out:

- `20260422193000_fix_study_search_text_backfill`
  Recomputes `searchText` from JSON scalar text instead of raw JSON casts.
- `20260422113000_harden_study_card_state`
  Backfills and hardens scheduler state / queue-state invariants.

Rollback expectations:

- Roll back the entire study migration chain together with the study feature if a deploy needs to
  be reverted.
- Do not manually remove only the corrective fix-up migrations while keeping later schema state;
  they are part of the supported study schema baseline.
