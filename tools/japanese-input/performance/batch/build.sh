#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/../.."
source .engines/emsdk/emsdk_env.sh >/dev/null
export PATH="$PWD/.engines/build-tools/bin:$PATH"
node performance/batch/patch.mjs
cd .engines/wllama-source
export SHARED_EMCC_CFLAGS='--no-entry -O3 -msimd128 -DNDEBUG -flto=full -frtti -fwasm-exceptions -sEXPORT_ALL=1 -sEXPORT_ES6=0 -sMODULARIZE=0 -sINITIAL_MEMORY=128MB -sMAXIMUM_MEMORY=4096MB -sALLOW_MEMORY_GROWTH=1 -sFORCE_FILESYSTEM=1 -sEXPORTED_FUNCTIONS=_main,_wllama_malloc,_wllama_start,_wllama_action,_wllama_exit,_wllama_debug -sEXPORTED_RUNTIME_METHODS=ccall,cwrap -sNO_EXIT_RUNTIME=1'
for variant in single-thread multi-thread; do
  export EMCC_CFLAGS="$SHARED_EMCC_CFLAGS"
  if [ "$variant" = multi-thread ]; then
    export EMCC_CFLAGS="$SHARED_EMCC_CFLAGS -pthread -sUSE_PTHREADS=1 -sPTHREAD_POOL_SIZE=Module.pthreadPoolSize"
  fi
  EMCC_CFLAGS='' emcmake cmake -S . -B "wasm/$variant" -DCMAKE_BUILD_TYPE=Release -DGGML_OPENMP=OFF -DLLAMA_CURL=OFF -DLLAMA_BUILD_TESTS=OFF -DLLAMA_BUILD_EXAMPLES=OFF -DCMAKE_POLICY_VERSION_MINIMUM=3.5
  cmake --build "wasm/$variant" --target wllama --parallel 4
  mkdir -p "src/$variant"
  cp "wasm/$variant/wllama.js" "wasm/$variant/wllama.wasm" "src/$variant/"
done
npm ci --ignore-scripts --no-audit --no-fund
npm run build:worker
npm run build:tsup
mkdir -p esm/single-thread esm/multi-thread
cp src/single-thread/wllama.wasm esm/single-thread/
cp src/multi-thread/wllama.wasm esm/multi-thread/
