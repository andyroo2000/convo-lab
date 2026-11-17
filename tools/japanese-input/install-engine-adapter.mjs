import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { engineInfo } from './contract.mjs';

export function installEngineAdapter() {
  const engine = new URL('./.engines/AzooKeyKanaKanjiConverter/', import.meta.url);
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: fileURLToPath(engine),
    encoding: 'utf8',
  }).trim();
  if (revision !== engineInfo.revision)
    throw new Error('Engine adapter requires the pinned AzooKey revision.');
  const source = readFileSync(
    new URL('./engine/adapter/WholePhraseCandidates.swift', import.meta.url)
  );
  const destination = new URL(
    'Sources/KanaKanjiConverterModule/ConverterAPI/ConvoLabWholePhrase.swift',
    engine
  );
  if (existsSync(destination) && readFileSync(destination).equals(source)) return;
  writeFileSync(destination, source);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) installEngineAdapter();
