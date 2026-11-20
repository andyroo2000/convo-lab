import {
  WASI,
  File,
  OpenFile,
  ConsoleStdout,
  PreopenDirectory,
  Directory,
} from '/vendor/wasi/index.js';
import { loadLearning, saveLearning } from './learning-storage.mjs';
let instance, shared, memory, revision;
const encoder = new TextEncoder(),
  decoder = new TextDecoder();
function neural(input, length, output, capacity) {
  const request = JSON.parse(
    decoder.decode(new Uint8Array(instance.exports.memory.buffer, input, length))
  );
  const control = new Int32Array(shared, 0, 2);
  Atomics.store(control, 0, 0);
  postMessage({ neural: request });
  if (Atomics.wait(control, 0, 0, 60000) === 'timed-out') throw Error('Neural model timed out');
  const size = Atomics.load(control, 1);
  if (size > capacity) throw Error('Neural response too large');
  const bytes = new Uint8Array(shared, 8, size);
  const reply = JSON.parse(decoder.decode(bytes.slice()));
  if (reply.kind === 'error') throw Error(reply.error || 'Neural inference failed');
  new Uint8Array(instance.exports.memory.buffer, output, size).set(bytes);
  return size;
}
async function filesystem() {
  const [entries, response] = await Promise.all([
    fetch('/assets/dictionary.json').then((r) => r.json()),
    fetch('/assets/dictionary.bin'),
  ]);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const root = new Directory(new Map());
  for (const [path, start, size] of entries) {
    const parts = path.split('/');
    let directory = root;
    for (const name of parts.slice(0, -1)) {
      if (!directory.contents.has(name)) directory.contents.set(name, new Directory(new Map()));
      directory = directory.contents.get(name);
    }
    directory.contents.set(
      parts.at(-1),
      new File(bytes.subarray(start, start + size), { readonly: true })
    );
  }
  const saved = await loadLearning();
  revision = saved.revision;
  memory = new Directory(new Map(saved.files.map(([name, data]) => [name, new File(data)])));
  return new PreopenDirectory(
    '/',
    new Map([
      ['resources', root],
      ['tmp', new Directory(new Map())],
      ['memory', memory],
    ])
  );
}
async function initialize(buffer) {
  shared = buffer;
  const wasi = new WASI(
    ['BrowserInput'],
    ['TMPDIR=/tmp'],
    [
      new OpenFile(new File([])),
      ConsoleStdout.lineBuffered(console.log),
      ConsoleStdout.lineBuffered(console.warn),
      await filesystem(),
    ]
  );
  const wasm = await WebAssembly.compileStreaming(fetch('/assets/engine.wasm'));
  instance = await WebAssembly.instantiate(wasm, {
    wasi_snapshot_preview1: wasi.wasiImport,
    neural: { request: neural },
  });
  wasi.initialize(instance);
  instance.exports.__main_argc_argv(0, 0);
}
function convert(request) {
  const input = encoder.encode(JSON.stringify(request));
  const pointer = instance.exports.allocate(input.length);
  new Uint8Array(instance.exports.memory.buffer, pointer, input.length).set(input);
  let result;
  try {
    result = instance.exports.convert_json(pointer, input.length);
    const bytes = new Uint8Array(instance.exports.memory.buffer);
    const end = bytes.indexOf(0, result);
    return JSON.parse(decoder.decode(bytes.subarray(result, end)));
  } finally {
    instance.exports.release_buffer(pointer);
    if (result) instance.exports.release_buffer(result);
  }
}
async function handle(data) {
  try {
    if (data.op === 'init') {
      await initialize(data.buffer);
      postMessage({ ready: true });
    } else {
      const result = convert(data);
      if (['learn', 'resetLearning'].includes(data.op) && !result.error) {
        revision = await saveLearning(
          [...memory.contents].map(([name, file]) => [name, file.data.slice()]),
          data.op === 'resetLearning' ? null : revision
        );
      }
      postMessage({ id: data.id, result });
    }
  } catch (error) {
    postMessage({ id: data.id, error: error.message });
  }
}

// Persistence must finish before a later conversion or reset starts.
let queue = Promise.resolve();
self.onmessage = ({ data }) => {
  queue = queue.then(() => handle(data));
};
