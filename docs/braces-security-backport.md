# Braces security backport

The root override pins `braces` to `@dieub/braces-depth-guard@3.0.3-pn.3` for the development tools that reach it through Chokidar and Micromatch. Upstream `braces@3.0.3` has no patched release for [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) as of October 5, 2026.

This is a third-party security backport, not an upstream release. It limits nesting and recursive AST traversal to 100 levels. Excessive input is rejected with a controlled error. Ordinary expansion and the public API are retained; it is not intended to make arbitrary glob expressions safe against every form of resource exhaustion.

Tailwind is declared in the root development dependencies alongside the other shared build tooling, with its existing version range and locked version retained. This ensures npm applies the root override to its Chokidar dependency. Keeping Tailwind only in the client workspace reproduced [npm/cli#9659](https://github.com/npm/cli/issues/9659): overrides were lost across the workspace link and Chokidar still loaded vulnerable upstream braces. The regression tests check both actual consumers to catch this failure even when Micromatch is patched correctly.

The adopted npm tarball was compared with upstream 3.0.3 and with [source commit `305a2e4bfe324bb53c336c1b03387ee1251c926f`](https://github.com/dieub/braces-depth-guard/commit/305a2e4bfe324bb53c336c1b03387ee1251c926f). All ten published files match that source commit. The entry point and original MIT license are unchanged from upstream. The changes add depth guards, reject cyclic expansion parent chains, and validate depth/length options. The package has no install lifecycle scripts or new runtime dependencies.

The exact version is pinned, and the lockfile records its integrity:

```text
sha512-QY+Uq4s42STyIMPoRkBuUZfYyvz0uZuwuUburLwMx5N+lWqnHHaBxcKPtgKVKjTyFnS1q4ivKu9Wxi4VG7FE9Q==
```

Registry signatures and the GitHub build attestation were verified with `npm audit signatures` in an isolated install. The backport's upstream compatibility and security suite passed all 799 tests. Repository regression tests resolve the actual package loaded by Chokidar and Micromatch and exercise excessive nesting, direct AST traversal, and normal expansion. The audit still checks all dependencies with the original severity threshold; renaming alone is not evidence of a security fix.

When upstream publishes a suitable fix, remove the override and rerun these security regressions, the dependency audit, and the complete build/test checks. The identity assertion should then be updated to the reviewed upstream version. Any backport update requires reviewing the new artifact and provenance again rather than widening this exact pin.
