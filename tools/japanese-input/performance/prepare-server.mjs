import { cpSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const target = resolve(root, '.engines/server-swift');
mkdirSync(target, { recursive: true });
cpSync(resolve(root, 'performance/server/Package.swift'), resolve(target, 'Package.swift'));
for (const name of [
  'SwiftUtils',
  'KanaKanjiConverterModule',
  'KanaKanjiConverterModuleWithDefaultDictionary',
]) {
  cpSync(
    resolve(root, '.engines/AzooKeyKanaKanjiConverter/Sources', name),
    resolve(target, 'Sources', name),
    { recursive: true }
  );
}
mkdirSync(resolve(target, 'Sources/EfficientNGram'), { recursive: true });
cpSync(
  resolve(root, 'browser/engine/Personalization.swift'),
  resolve(target, 'Sources/EfficientNGram/Personalization.swift')
);
cpSync(resolve(root, 'engine/Sources/InputWorker'), resolve(target, 'Sources/InputWorker'), {
  recursive: true,
});
mkdirSync(resolve(target, 'Sources/llama'), { recursive: true });
writeFileSync(
  resolve(target, 'Sources/llama/module.modulemap'),
  'module llama [system] {\n header "/experiment/llama.cpp/include/llama.h"\n link "llama"\n export *\n}\n'
);
for (const [name, destination] of [
  ['WholePhraseCandidates', 'ConvoLabWholePhrase'],
  ['NeuralBoundaryRanker', 'ConvoLabNeuralBoundaryRanker'],
]) {
  cpSync(
    resolve(root, `engine/adapter/${name}.swift`),
    resolve(target, `Sources/KanaKanjiConverterModule/ConverterAPI/${destination}.swift`)
  );
}
// The production host has two cores; pin the experiment to one inference thread.
const context = resolve(
  target,
  'Sources/KanaKanjiConverterModule/ConversionAlgorithms/Zenzai/Zenz/ZenzContext.swift'
);
writeFileSync(
  context,
  readFileSync(context, 'utf8')
    .replace(
      'model_params.split_mode = LLAMA_SPLIT_MODE_NONE',
      'model_params.split_mode = LLAMA_SPLIT_MODE_LAYER'
    )
    .replace('max(1, min(8, ProcessInfo.processInfo.processorCount - 2))', '1')
);
console.log(target);
