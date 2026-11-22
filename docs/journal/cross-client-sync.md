# Journal synchronization verification

All three clients use the same account-owned journal API. An entry's ID is stable through retries, its version protects against stale overwrites/deletes, and server tombstones prevent a deleted ID from being recreated.

## Supported recovery behavior

- Creates and edits are local drafts until a successful online save. After a connection failure, retry the save; reopening the app/page preserves saved device drafts.
- Contents refreshes when opened. iOS and Android refresh visible Contents on foregrounding; web also refreshes on focus and reconnect. This is refresh-based synchronization, not continuous background delivery.
- An offline deletion is not reported as completed. Retry once online. Android persists its pending deletion; iOS and web retain the entry and require another delete attempt.
- A stale edit/delete cannot overwrite newer writing. Conflicting drafts remain local and can be saved under a new ID.
- A remote deletion disappears from the refreshed server list. Unsaved local writing remains recoverable. Trying to save it offers a new-entry recovery action rather than resurrecting the deleted server ID.
- The API intentionally does not distinguish a deleted entry from another unavailable resource in a 404 response. Clients describe the entry as unavailable, retain the writing, and offer an explicit local-copy action. They never automatically create a second server entry in response to a 404.

## Verification layers

The learning-os test matrix uses real journal routes with two independently issued mobile bearer tokens and browser session authentication. All six directed client pairs cover create/edit/delete visibility, stale edit/delete rejection, lost-response retries, and deleted-ID protection. These are HTTP contract tests, not three live app UIs connected together.

The web React tests exercise production editor/archive hooks and localStorage, including application cache defaults, reopening Contents, focus/reconnect, offline reopening and retries, and conflict/deletion recovery. Native iOS tests exercise JournalStore, JournalEntryModel and disk storage. Android instrumentation exercises JournalRepository and real device disk storage on the Pixel, with controlled network failure and remote-write fixtures. Existing client and server tests cover corrected-document revision conflicts separately.

These tests do not establish continuous background sync or an unattended end-to-end session across a signed-in iPhone, Pixel and browser. They deliberately isolate test data from the owner's journal.
