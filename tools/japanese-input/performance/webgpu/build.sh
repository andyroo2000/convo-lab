#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../.."
source .engines/webgpu-emsdk/emsdk_env.sh >/dev/null
node performance/webgpu/patch.mjs
cd .engines/webgpu-source
mkdir -p build/emdawn
if [ ! -f build/emdawn/emdawnwebgpu_pkg/emdawnwebgpu.port.py ]; then
  curl -fL https://github.com/google/dawn/releases/download/v20260317.182325/emdawnwebgpu_pkg-v20260317.182325.zip -o build/emdawn.zip
  python3 -c "import zipfile; zipfile.ZipFile('build/emdawn.zip').extractall('build/emdawn')"
fi
emcmake cmake -S . -B build -DCMAKE_BUILD_TYPE=Release -DGGML_WEBGPU=ON -DGGML_WEBGPU_JSPI=ON -DEMDAWNWEBGPU_DIR="$PWD/build/emdawn/emdawnwebgpu_pkg" -DWLLAMA_TEST_BACKEND=OFF
cmake --build build --target wllama --parallel 4
mkdir -p src/wasm
cp build/wllama.js build/wllama.wasm src/wasm/
npm ci --ignore-scripts --no-audit --no-fund
npm run build:worker
# Only browser JavaScript is needed; upstream declaration generation fails on its DOM types.
npx tsup src/index.ts src/wasm-from-cdn.ts --format esm --clean
mkdir -p esm/wasm
cp build/wllama.wasm esm/wasm/
