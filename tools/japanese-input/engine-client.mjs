import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

export class EngineClient {
  pending = new Map();
  child = null;

  constructor(
    binary = fileURLToPath(new URL('./engine/.build/release/InputWorker', import.meta.url)),
    { args = [], timeoutMs = 10000 } = {}
  ) {
    this.binary = binary;
    this.args = args;
    this.timeoutMs = timeoutMs;
  }

  start() {
    if (this.child) return this.child;
    const child = spawn(this.binary, this.args, { stdio: ['pipe', 'pipe', 'pipe'] });
    this.child = child;
    createInterface({ input: child.stdout }).on('line', (line) => this.receive(line));
    // Keep the pipe drained without logging people's writing.
    child.stderr.resume();
    child.stdin.on('error', () => {
      if (this.child === child) this.fail('Conversion engine stopped. Try again.');
    });
    child.on('error', () => {
      if (this.child === child) this.fail('Build the conversion engine with npm run setup first.');
    });
    child.on('exit', () => {
      if (this.child === child) this.fail('Conversion engine stopped. Try again.');
    });
    return child;
  }

  receive(line) {
    let result;
    try {
      result = JSON.parse(line);
    } catch {
      return;
    }
    const request = this.pending.get(result.id);
    if (!request) return;
    clearTimeout(request.timer);
    this.pending.delete(result.id);
    request.resolve(result);
  }

  convert(reading) {
    if (this.pending.size >= 16)
      return Promise.reject(new Error('The playground is busy. Try again.'));
    const child = this.start();
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => this.fail('Conversion timed out. Your text is still here.'),
        this.timeoutMs
      );
      this.pending.set(id, { resolve, reject, timer });
      child.stdin.write(`${JSON.stringify({ id, reading })}\n`);
    });
  }

  fail(message) {
    const child = this.child;
    this.child = null;
    child?.kill();
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error(message));
    }
    this.pending.clear();
  }

  close() {
    this.fail('Playground closed.');
  }
}
