import './prepare-server.mjs';
import { cpSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const target = root + '.engines/ios-cpu';
cpSync(root + '.engines/server-swift/Sources', target + '/Sources', { recursive: true });
const framework =
  root + '.engines/ios-simulator/artifacts/azookeykanakanjiconverter/llama.cpp/llama.xcframework';
cpSync(framework, target + '/llama.xcframework', { recursive: true });
const manifest = readFileSync(root + 'performance/server/Package.swift', 'utf8')
  .replace(
    'name: "ServerInput", dependencies:',
    'name: "SimulatorInput", platforms: [.iOS(.v16)], dependencies:'
  )
  .replace(
    '.systemLibrary(name: "llama")',
    `.binaryTarget(name: "llama", path: "llama.xcframework")`
  );
writeFileSync(target + '/Package.swift', manifest);
console.log(target);
