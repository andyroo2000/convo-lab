import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const source = new URL('../../.engines/webgpu-source/', import.meta.url);
const pin = '6647c1ea3837b2f0205a300c3bf5ff644aaa06bf';
if (execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim() !== pin)
  throw Error('Unexpected WebGPU runtime revision');
function patch(path, before, after) {
  const url = new URL(path, source), text = readFileSync(url, 'utf8');
  if (text.includes(after)) return;
  if (!text.includes(before)) throw Error(`Patch anchor missing: ${path}`);
  writeFileSync(url, text.replace(before, after));
}
copyFileSync(new URL('logits.hpp', import.meta.url), new URL('cpp/journal-logits.hpp', source));
copyFileSync(new URL('codec.hpp', import.meta.url), new URL('cpp/journal-codec.hpp', source));
copyFileSync(new URL('neural.hpp', import.meta.url), new URL('cpp/journal-neural.hpp', source));
copyFileSync(new URL('action.hpp', import.meta.url), new URL('cpp/journal-action.hpp', source));
patch('cpp/wllama-context.h', 'struct wllama_context\n{', '#include "journal-neural.hpp"\nstruct wllama_context\n{\n#include "journal-action.hpp"');
patch('cpp/wllama.cpp', 'WLLAMA_ACTION(load)', 'WLLAMA_ACTION(load)\n    WLLAMA_ACTION(journal)');
