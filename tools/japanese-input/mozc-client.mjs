import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const build = fileURLToPath(new URL('./.engines/mozc/src/bazel-bin/', import.meta.url));
function decodeHex(hex) {
  if (!/^(?:[a-f0-9]{2})+$/i.test(hex)) throw new Error('Invalid Mozc text encoding.');
  return Buffer.from(hex, 'hex').toString('utf8');
}

export function parseMozc(line) {
  const [elapsed, ...fields] = line.split('\t');
  const engineMs = Number(elapsed);
  if (!elapsed || !fields.length) throw new Error('Mozc returned an invalid conversion.');
  if (!Number.isFinite(engineMs) || engineMs < 0)
    throw new Error('Mozc returned an invalid conversion.');
  const segments = fields.map((field) => {
    const [key, values] = field.split(':');
    return { reading: decodeHex(key), candidates: (values ?? '').split(',').map(decodeHex) };
  });
  return {
    engineMs,
    segments,
    // Only the first-choice sentence is ranked. Per-segment alternatives are
    // deliberately not presented as a fabricated whole-sentence N-best list.
    candidates: [
      {
        text: segments.map((segment) => segment.candidates[0]).join(''),
        reading: segments.map((segment) => segment.reading).join(''),
      },
    ],
  };
}

// A sequential, local benchmark adapter, not a concurrent service worker.
export class MozcClient {
  pending = null;
  child = null;
  profile = null;
  closed = false;

  constructor(binary = `${build}convolab_benchmark/worker`) {
    this.binary = binary;
  }

  start() {
    if (this.child) return;
    this.profile = mkdtempSync(join(tmpdir(), 'convolab-mozc-'));
    const child = spawn(this.binary, [`${build}data_manager/oss/mozc.data`, this.profile]);
    this.child = child;
    child.stderr.resume();
    createInterface({ input: child.stdout }).on('line', (line) => this.receive(line));
    child.on('error', () => this.fail('Build Mozc with npm run setup:mozc first.'));
    child.on('exit', () => this.fail('Mozc worker exited.'));
    child.stdin.on('error', () => this.fail('Mozc input closed.'));
    child.on('close', () => {
      rmSync(this.profile, { recursive: true, force: true });
      this.profile = null;
    });
  }

  receive(line) {
    if (!this.pending) return;
    const pending = this.pending;
    this.pending = null;
    clearTimeout(pending.timer);
    try {
      pending.resolve(parseMozc(line));
    } catch (error) {
      pending.reject(error);
    }
  }

  convert(reading) {
    if (this.closed) return Promise.reject(new Error('Mozc benchmark is closed.'));
    if (this.pending) return Promise.reject(new Error('Benchmark requests must be sequential.'));
    if (!reading || /[\r\n\x00]/u.test(reading))
      return Promise.reject(new Error('Expected one nonempty reading.'));
    this.start();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.fail('Mozc conversion timed out.'), 10000);
      this.pending = { resolve, reject, timer };
      this.child.stdin.write(`${reading}\n`);
    });
  }

  fail(message) {
    this.closed = true;
    this.child?.kill();
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.reject(new Error(message));
      this.pending = null;
    }
  }

  close() {
    this.fail('Mozc benchmark closed.');
  }
}
