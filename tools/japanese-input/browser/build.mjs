import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const extracted = resolve(
  root,
  '.engines/toolchain/extracted/swift-6.4.2-RELEASE-osx-package.pkg/Payload/usr/bin/swift'
);
const swift = process.env.SWIFT_WASM ?? (existsSync(extracted) ? extracted : 'swift');
function run(command, args) {
  execFileSync(command, args, { cwd: root, stdio: 'inherit' });
}
const version = execFileSync(swift, ['--version'], { encoding: 'utf8' });
if (!version.includes('6.4.2'))
  throw Error('Use the Swift.org 6.4.2 toolchain and matching Wasm SDK; see browser/README.md');
run(process.execPath, ['browser/prepare-swift.mjs']);
const lock = resolve(root, 'browser/engine/Package.resolved');
if (existsSync(lock)) copyFileSync(lock, resolve(root, '.engines/browser-swift/Package.resolved'));
run(swift, [
  'build',
  '--build-system',
  'native',
  '--package-path',
  '.engines/browser-swift',
  '--swift-sdk',
  'swift-6.4.2-RELEASE_wasm',
  '-c',
  'release',
  '-Xswiftc',
  '-enable-experimental-feature',
  '-Xswiftc',
  'Extern',
  '-Xswiftc',
  '-Xclang-linker',
  '-Xswiftc',
  '-mexec-model=reactor',
  '-Xlinker',
  '--export=__main_argc_argv',
  '-Xlinker',
  '--strip-debug',
]);
run(process.execPath, ['browser/pack-assets.mjs']);
copyFileSync(
  resolve(root, '.engines/browser-swift/.build/wasm32-unknown-wasip1/release/BrowserInput.wasm'),
  resolve(root, '.engines/browser-assets/engine.wasm')
);
