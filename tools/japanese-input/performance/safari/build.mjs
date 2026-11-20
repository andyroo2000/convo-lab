import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
const root = new URL('../../', import.meta.url);
const jspi = process.env.SAFARI_JSPI === '1';
const build = jspi ? 'build-safari-jspi' : 'build-safari';
function buildCompatibilityRuntime() {
  execFileSync(process.execPath, ['performance/webgpu/patch.mjs'], { cwd: root, stdio: 'inherit' });
  execFileSync(process.execPath, ['performance/safari/patch.mjs'], { cwd: root, stdio: 'inherit' });
  execFileSync(
    'bash',
    [
      '-c',
      `
set -euo pipefail
source .engines/webgpu-emsdk/emsdk_env.sh >/dev/null
cd .engines/webgpu-source
emcmake cmake -S . -B ${build} -DCMAKE_BUILD_TYPE=Release -DWLLAMA_COMPAT=ON -DWLLAMA_COMPAT_JSPI=${jspi ? 'ON' : 'OFF'} -DLLAMA_WASM_MEM64=OFF -DGGML_WEBGPU=ON -DGGML_WEBGPU_JSPI=${jspi ? 'ON' : 'OFF'} -DEMDAWNWEBGPU_DIR="$PWD/build/emdawn/emdawnwebgpu_pkg" -DWLLAMA_TEST_BACKEND=OFF
cmake --build ${build} --target wllama --parallel 4
npx tsup src/index.ts src/wasm-from-cdn.ts --format esm --no-clean
`,
    ],
    { cwd: root, stdio: 'inherit' }
  );
}
function copyCompatibilityRuntime() {
  const output = new URL(`.engines/webgpu-source/esm/${jspi ? 'compat-jspi' : 'compat'}/`, root);
  mkdirSync(output, { recursive: true });
  for (const name of ['wllama.js', 'wllama.wasm']) {
    copyFileSync(new URL(`.engines/webgpu-source/${build}/${name}`, root), new URL(name, output));
  }
}
buildCompatibilityRuntime();
copyCompatibilityRuntime();
