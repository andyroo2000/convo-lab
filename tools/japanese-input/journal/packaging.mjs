import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export async function verifyArchive(path, digest) {
  const hash = createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
  if (hash !== digest) throw Error('Journal keyboard asset checksum does not match');
}

export function scopeRuntimeSource(text, prefix, seen) {
  return text
    .replace(/(['"`])\/(browser|vendor|assets|gpu)\//g, (_, quote, folder) => {
      seen.add(folder);
      return `${quote}${prefix}/${folder}/`;
    })
    .replace(/(['"])\/(contract|engine-transport)\.mjs/g, (_, quote, name) => {
      seen.add(name);
      const folder = name === 'engine-transport' ? '/web' : '';
      return `${quote}${prefix}${folder}/${name}.mjs`;
    });
}

export function verifyRewriteCoverage(seen) {
  const expected = ['browser', 'vendor', 'assets', 'gpu', 'contract', 'engine-transport'];
  const missing = expected.filter((name) => !seen.has(name));
  if (missing.length) throw Error(`Missing runtime URL rewrites: ${missing.join(', ')}`);
}

export function replaceExpected(text, from, to) {
  if (!text.includes(from)) throw Error(`Runtime source no longer contains ${from}`);
  return text.replace(from, to);
}
