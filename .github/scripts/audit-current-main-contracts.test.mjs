import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { auditCurrentMainContracts } from './audit-current-main-contracts.mjs';

const components = {
  provider: {
    repository: 'example/provider',
    fixtureDirectory: 'provider-fixtures',
  },
  web: { repository: 'example/web', fixtureDirectory: 'web-fixtures' },
  ios: { repository: 'example/ios', fixtureDirectory: 'ios-fixtures' },
};

const shas = {
  provider: '1'.repeat(40),
  web: '2'.repeat(40),
  ios: '3'.repeat(40),
};

const bytes = (value) => Buffer.from(value);
const digest = (value) => createHash('sha256').update(value).digest('hex');

function fixtureSet({ fixturePath = 'sample-v1.json' } = {}) {
  const payload = bytes('{"version":1}\n');
  const payloadSha = digest(payload);
  const manifest = bytes(
    `${JSON.stringify({
      fixtures: [
        {
          id: 'sample',
          path: fixturePath,
          checksumPath: fixturePath.replace(/\.json$/u, '.sha256'),
          sha256: payloadSha,
        },
      ],
    })}\n`
  );
  return new Map([
    ['manifest-v1.json', manifest],
    ['manifest-v1.sha256', bytes(`${digest(manifest)}  manifest-v1.json\n`)],
    ['sample-v1.json', payload],
    ['sample-v1.sha256', bytes(`${payloadSha}  sample-v1.json\n`)],
  ]);
}

function mockFetch(filesByComponent, overrides = {}, requestedUrls = []) {
  return async (url) => {
    requestedUrls.push(url);
    const repositoryEntry = Object.entries(components).find(([, component]) => {
      const apiRoot = `https://api.github.com/repos/${component.repository}`;
      return (
        url === apiRoot ||
        url.startsWith(`${apiRoot}/`) ||
        url.includes(`raw.githubusercontent.com/${component.repository}/`)
      );
    });
    if (!repositoryEntry) return new Response('', { status: 404 });
    const [name, component] = repositoryEntry;
    if (url === `https://api.github.com/repos/${component.repository}`) {
      return Response.json({ default_branch: 'main' });
    }
    if (url === `https://api.github.com/repos/${component.repository}/commits/main`) {
      return Response.json({ sha: overrides[`${name}Sha`] ?? shas[name] });
    }
    const filename = url.split('/').at(-1);
    const value = filesByComponent[name].get(filename);
    return value ? new Response(value) : new Response('', { status: 404 });
  };
}

test('accepts byte-identical fixtures at each repository current main SHA', async () => {
  const files = fixtureSet();
  const result = await auditCurrentMainContracts({
    components,
    fetchImpl: mockFetch({ provider: files, web: files, ios: files }),
  });

  assert.deepEqual(result, { shas, fixtureCount: 4 });
});

test('rejects consumer drift from the provider current main manifest', async () => {
  const provider = fixtureSet();
  const web = new Map(provider);
  const ios = new Map(provider);
  web.set('sample-v1.json', bytes('{"version":2}\n'));

  await assert.rejects(
    auditCurrentMainContracts({
      components,
      fetchImpl: mockFetch({ provider, web, ios }),
    }),
    /web current-main fixture differs from provider: sample-v1.json/u
  );
});

test('rejects abbreviated or malformed current main SHAs', async () => {
  const files = fixtureSet();
  await assert.rejects(
    auditCurrentMainContracts({
      components,
      fetchImpl: mockFetch(
        { provider: files, web: files, ios: files },
        { iosSha: 'abc123' }
      ),
    }),
    /default branch did not resolve to a full commit SHA/u
  );
});

test('rejects a provider manifest whose checksum does not match its bytes', async () => {
  const files = fixtureSet();
  const provider = new Map(files);
  provider.set('manifest-v1.sha256', bytes(`${'0'.repeat(64)}  manifest-v1.json\n`));

  await assert.rejects(
    auditCurrentMainContracts({
      components,
      fetchImpl: mockFetch({ provider, web: files, ios: files }),
    }),
    /manifest checksum does not match/u
  );
});

test('reduces manifest paths to basenames before constructing remote URLs', async () => {
  const files = fixtureSet({ fixturePath: '../../sample-v1.json' });
  const requestedUrls = [];

  await auditCurrentMainContracts({
    components,
    fetchImpl: mockFetch({ provider: files, web: files, ios: files }, {}, requestedUrls),
  });

  assert.equal(requestedUrls.some((url) => url.includes('../')), false);
});
