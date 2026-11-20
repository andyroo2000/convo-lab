import { cpSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { engineInfo } from '../contract.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const upstream = resolve(root, '.engines/AzooKeyKanaKanjiConverter');
const target = resolve(root, '.engines/browser-swift');
if (
  execFileSync('git', ['rev-parse', 'HEAD'], { cwd: upstream, encoding: 'utf8' }).trim() !==
  engineInfo.revision
)
  throw Error('Unexpected AzooKey revision');
mkdirSync(target, { recursive: true });
cpSync(resolve(root, 'browser/engine/Package.swift'), resolve(target, 'Package.swift'));
for (const name of [
  'SwiftUtils',
  'KanaKanjiConverterModule',
  'KanaKanjiConverterModuleWithDefaultDictionary',
]) {
  cpSync(resolve(upstream, 'Sources', name), resolve(target, 'Sources', name), { recursive: true });
}
function put(path, source) {
  mkdirSync(resolve(target, path, '..'), { recursive: true });
  writeFileSync(resolve(target, path), source);
}
function local(name) {
  return readFileSync(resolve(root, 'browser/engine', name), 'utf8');
}
put('Sources/EfficientNGram/Personalization.swift', local('Personalization.swift'));
put(
  'Sources/KanaKanjiConverterModule/ConversionAlgorithms/Zenzai/Zenz/ZenzContext.swift',
  local('ZenzContext.swift')
);
for (const name of ['WholePhraseCandidates', 'NeuralBoundaryRanker']) {
  put(
    `Sources/KanaKanjiConverterModule/ConverterAPI/Browser${name}.swift`,
    readFileSync(
      resolve(
        root,
        name === 'NeuralBoundaryRanker' && process.env.IOS_OPTIMIZED
          ? 'performance/webgpu/NeuralBoundaryRanker.swift'
          : `engine/adapter/${name}.swift`
      ),
      'utf8'
    )
  );
}
// Remove copies injected by the native playground; use the tracked adapters above.
for (const name of ['ConvoLabWholePhrase', 'ConvoLabNeuralBoundaryRanker'])
  put(
    `Sources/KanaKanjiConverterModule/ConverterAPI/${name}.swift`,
    '// Adapter supplied by browser build.\n'
  );
const defaults =
  'Sources/KanaKanjiConverterModuleWithDefaultDictionary/KanaKanjiConverterModuleWithDefaultDictionary.swift';
put(
  defaults,
  readFileSync(resolve(target, defaults), 'utf8')
    .replaceAll('Bundle.module.resourceURL!', 'URL(fileURLWithPath: "/resources")')
    .replaceAll('Bundle.module.bundleURL', 'URL(fileURLWithPath: "/resources")')
);
for (const name of readdirSync(resolve(root, 'engine/Sources/InputWorker'))) {
  let source = readFileSync(resolve(root, 'engine/Sources/InputWorker', name), 'utf8');
  if (name === 'main.swift') {
    source = source.replace(
      /guard CommandLine.arguments.count[\s\S]*?let boundaryRanker =/,
      'let inferenceLimit = 1\nlet neuralInferenceLimit = inferenceLimit\nlet modelURL = URL(fileURLWithPath: "/model.gguf")\nlet boundaryRanker ='
    );
    source = source.slice(0, source.indexOf('while let line = readLine()'));
    source = source
      .replace(
        'ConversionLearning(directory: nil)',
        'ConversionLearning(directory: URL(fileURLWithPath: "/memory"))'
      )
      .replace('learningType: .nothing', 'learningType: .inputAndOutput')
      .replaceAll('URL: scratch', 'URL: URL(fileURLWithPath: "/memory")');
  }
  if (name === 'main.swift' && process.env.IOS_OPTIMIZED) {
    source = source.replace(
      'let results = converter.requestCandidates(composition, options: options)\n',
      'let reuse = request.boundaries?.isEmpty == false && previousReading == request.reading\n    let results = reuse ? previousResults! : converter.requestCandidates(composition, options: options)\n    previousReading = request.reading\n    previousResults = results\n'
    );
    source = source.replace(
      '@MainActor func convert(',
      'var previousReading = \"\"\nvar previousResults: ConversionResult?\n\n@MainActor func convert('
    );
  }
  if (name === 'ConversionLearning.swift')
    source = source.replace('options: .atomic', 'options: []');
  put(`Sources/BrowserInput/${name}`, source);
}
put('Sources/BrowserInput/Exports.swift', local('Exports.swift'));
put(
  'Sources/BrowserInput/Learning.swift',
  local('Learning.swift').replace(
    '/* invalidate cached proposals */',
    process.env.IOS_OPTIMIZED ? 'previousReading = ""; previousResults = nil' : ''
  )
);
console.log(target);

const builder =
  'Sources/KanaKanjiConverterModule/DictionaryManagement/DataStructure/DictionaryBuilder.swift';
// WASI has no atomic-file flag. The worker persists the complete memory snapshot
// in one IndexedDB transaction after all engine writes finish.
put(
  builder,
  readFileSync(resolve(target, builder), 'utf8').replaceAll('options: .atomic', 'options: []')
);
