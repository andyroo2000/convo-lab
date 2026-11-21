# Journal browser input

The three Journal writing surfaces share `JournalWritingField`. Device-keyboard mode
loads no conversion assets. Built-in mode attaches the existing inline editor to its
textarea; kana remains visible until a candidate is chosen or explicit conversion is
requested. Candidate clicks commit. Space, arrows, Shift+Left/Right, Escape, Enter,
undo, native composition, and confirmed-conversion learning use the playground engine.

## Runtime assets

Run `node tools/japanese-input/journal/package.mjs` before building the frontend image.
The helper downloads the `journal-keyboard-runtime-v1` GitHub release with `gh`, verifies
its SHA-256, and assembles current tracked adapters into
`client/public/japanese-input/v1` (generated, ignored by Git). CI uses `GH_TOKEN` with
read access to this repository. An already downloaded archive can be supplied through
`JOURNAL_KEYBOARD_ARCHIVE` for local/offline builds; the same checksum is enforced.

The binary bundle contains the existing AzooKey Swift/WASM dictionary engine,
Zenz-v3-small Q5_K_M model, WebGPU/WASM runtimes, WanaKana, and third-party notices.
The checksum pins the binaries from the previously evaluated browser runtime;
no model quantization or candidate-pool reduction is introduced here. The expanded
boundary candidate pool remains 160. Runtime licenses are served under
`/japanese-input/v1/licenses/` with model attribution in `licenses/THIRD-PARTY.md`.

The assets are roughly 194 MB uncompressed and fetched only after choosing built-in
input. They are excluded from service-worker precaching. The dictionary/model runtime
uses persistent browser storage as in the playground. Learning remains local to this
browser. Future incompatible binary releases must use a new release tag, checksum,
and URL version; source modules use a one-hour HTTP cache.

## Hosting and checks

Journal/settings documents and worker responses need cross-origin isolation.
Crossing between these screens and other sections loads a fresh document; navigation
within Journal and opening settings as a modal stays client-side. This keeps the
other sections’ media policies unchanged.
The static server sends COOP `same-origin` and COEP `require-corp`, and serves MJS
as JavaScript and WASM as `application/wasm`. Generated assets must not fall through
to SPA HTML. Vite supplies the same isolation headers in development.

Run the normal precheck and production frontend smoke checks. The real-model
Playwright scenarios are in `e2e/journal-keyboard.spec.ts`; use Chrome with WebGPU,
a prepared runtime, and a running frontend. They mock only Journal API responses,
not the conversion engine. They cover all three editors, local autosave, final saves,
settings, punctuation, section adjustments, full alternatives, undo, and deletion.
The component tests additionally cover preparation failure/retry and late async cleanup.
