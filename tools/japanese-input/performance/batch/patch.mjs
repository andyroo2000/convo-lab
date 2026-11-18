import { readFileSync, writeFileSync, cpSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const source = fileURLToPath(new URL('../../.engines/wllama-source/', import.meta.url));
const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: source,
  encoding: 'utf8',
}).trim();
if (revision !== '5e63e3b226a077b33dc7c608f1fe630f3d21f539')
  throw Error('Unexpected wllama revision');
for (const name of ['glue.hpp', 'actions.hpp', 'wllama.cpp']) {
  let text = execFileSync('git', ['show', `HEAD:cpp/${name}`], { cwd: source, encoding: 'utf8' });
  if (name === 'glue.hpp')
    text += '\n' + readFileSync(new URL('./glue.hpp', import.meta.url), 'utf8');
  if (name === 'actions.hpp') text += '\n#include "neural-score.hpp"\n';
  if (name === 'wllama.cpp')
    text = text.replace(
      'WLLAMA_ACTION(get_logits)',
      'WLLAMA_ACTION(get_logits)\n    WLLAMA_ACTION(neural_score)'
    );
  writeFileSync(source + `cpp/${name}`, text);
}
cpSync(new URL('./score.hpp', import.meta.url), source + 'cpp/neural-score.hpp');
execFileSync(process.execPath, ['cpp/generate_glue_prototype.js'], {
  cwd: source,
  stdio: 'inherit',
});
