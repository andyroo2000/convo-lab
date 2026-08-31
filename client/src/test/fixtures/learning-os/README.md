# Learning OS compatibility fixtures

`Compatibility/` is a byte-for-byte vendor of the canonical wire fixtures from
`andyroo2000/learning-os` commit
`6f557e9ff7819bfee6c12d6e845ac28056475bdb`. Learning OS remains the sole fixture
authority; do not hand-edit the vendored JSON or checksum files.

- `npm run contracts:verify` checks the local manifest and SHA-256 declarations.
- `npm run contracts:check-provider` compares every byte with the pinned provider commit.
- `npm run contracts:sync-provider` refreshes the vendor from that commit.

When the provider contract intentionally changes, update the pinned commit in
`scripts/sync-learning-os-contract-fixtures.mjs`, sync, and update the consumer assertions in the
same PR.
