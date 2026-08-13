let input = '';
for await (const chunk of process.stdin) input += chunk;

const manifest = JSON.parse(input);
const entries = Array.isArray(manifest) ? manifest : [manifest];
const matches = entries.filter(
  (entry) =>
    entry.Descriptor?.platform?.os === process.env.RUNTIME_OS &&
    entry.Descriptor?.platform?.architecture === process.env.RUNTIME_ARCH
);

if (matches.length !== 1) {
  throw new Error(
    `Expected exactly one ${process.env.RUNTIME_OS}/${process.env.RUNTIME_ARCH}` +
      ` platform manifest, found ${matches.length}.`
  );
}

const digest = matches[0]?.Descriptor?.digest;
if (!/^sha256:[0-9a-f]{64}$/.test(digest ?? '')) {
  throw new Error('Resolved platform manifest has an invalid digest.');
}

if (!Array.isArray(manifest) && digest !== process.env.EXPECTED_IMAGE_DIGEST) {
  throw new Error('Single-platform manifest did not preserve the expected digest.');
}

process.stdout.write(digest);
