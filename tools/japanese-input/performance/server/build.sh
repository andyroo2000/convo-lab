#!/bin/bash
set -euo pipefail
cd /experiment
if [ ! -d llama.cpp ]; then
  git clone --depth 1 --branch b4846 https://github.com/azooKey/llama.cpp.git
fi
cmake -S llama.cpp -B llama-build -DCMAKE_BUILD_TYPE=Release -DCMAKE_C_COMPILER=clang -DCMAKE_CXX_COMPILER=clang++ -DGGML_CUDA=OFF -DLLAMA_BUILD_TESTS=OFF -DLLAMA_BUILD_EXAMPLES=OFF -DLLAMA_BUILD_SERVER=OFF -DLLAMA_CURL=OFF
cmake --build llama-build --target llama --parallel 1
cd server-swift
swift build -c release --jobs 1 -Xcc -I/experiment/llama.cpp/ggml/include -Xlinker -L/experiment/llama-build/bin -Xlinker -rpath -Xlinker /experiment/llama-build/bin
