# Release compatibility integration train

The release compatibility train is a scheduled or manually dispatched compatibility gate. It validates one immutable set of Learning OS, web, and iOS commits without merging, deploying, or promoting any component.

Exact component commits live in `.github/release-integration/components.json`. Updating a pin is a reviewed repository change and treats that exact component code as trusted for the compatibility run. Executable checkout refs are repeated as immutable literals in the workflow so GitHub security analysis can prove that component code is trusted; deployment tests require those literals to match the manifest and prevent drift. The workflow creates a uniquely named `integration/compatibility-<run>-<attempt>` branch at the pinned web commit, runs the gates, and deletes that exact branch even when a gate fails. It never opens or merges a pull request.

The gates are:

1. Byte equality from the Learning OS authority to both vendored consumers, including the canonical manifest and checksum files.
2. Producer-backed Learning OS compatibility fixture tests.
3. Web manifest/hash verification and focused runtime-boundary hook tests.
4. iOS golden-fixture decoding tests on the supported simulator toolchain.

## Promotion order

1. Land and deploy the Learning OS provider fixture change.
2. Pin that deployed provider commit and land/deploy the web consumer.
3. Pin the compatible provider commit in iOS, land the iOS consumer, and finish its normal TestFlight delivery.
4. Update all three train pins to their merge commits and run the train manually.
5. Treat a green train as compatibility evidence only. Each repository still uses its own reviewed merge and deployment workflow; the train never auto-merges or auto-promotes.

If a gate fails, keep the component commits unchanged, fix the owning repository in a normal PR, update only the relevant pin after that PR lands, and rerun the train.
