import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
const root = new URL('../../', import.meta.url);
function buildCompatibilityRuntime() {
  execFileSync(process.execPath, ['performance/webgpu/patch.mjs'], { cwd: root, stdio: 'inherit' });
  execFileSync('bash', ['-c', `
set -euo pipefail
source .engines/webgpu-emsdk/emsdk_env.sh >/dev/null
cd .engines/webgpu-source
emcmake cmake -S . -B build-safari -DCMAKE_BUILD_TYPE=Release -DWLLAMA_COMPAT=ON -DLLAMA_WASM_MEM64=OFF -DGGML_WEBGPU=ON -DGGML_WEBGPU_JSPI=OFF -DEMDAWNWEBGPU_DIR="$PWD/build/emdawn/emdawnwebgpu_pkg" -DWLLAMA_TEST_BACKEND=OFF
cmake --build build-safari --target wllama --parallel 4
`], { cwd: root, stdio: 'inherit' });
}
function copyCompatibilityRuntime() {
  const output = new URL('.engines/webgpu-source/esm/compat/', root);
  mkdirSync(output, { recursive: true });
  for (const name of ['wllama.js', 'wllama.wasm']) {
    copyFileSync(new URL(`.engines/webgpu-source/build-safari/${name}`, root), new URL(name, output));
  }
}
buildCompatibilityRuntime();
copyCompatibilityRuntime();
