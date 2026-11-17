import { neuralConfiguration } from './neural-client.mjs';

const warmupReadings = [
  'きょうはいいてんきです',
  'はしでたべました',
  'きのうともだちとえいがをみてからばんごはんをたべました',
];

export class NeuralRuntime {
  state = 'loading';
  warming = null;
  client = null;
  closed = false;

  constructor(configuration = neuralConfiguration(1)) {
    this.configuration = configuration;
    this.info = configuration.info;
    this.preload();
  }

  snapshot() {
    if (this.state === 'ready' && !this.client.child) this.state = 'error';
    return { ...this.info, state: this.state };
  }

  preload() {
    if (this.closed || this.warming) return this.warming;
    this.client?.close();
    this.client = this.configuration.createClient();
    this.state = 'loading';
    this.warming = this.warm(this.client).finally(() => {
      this.warming = null;
    });
    return this.warming;
  }

  async warm(client) {
    try {
      for (const reading of warmupReadings) {
        const result = await client.convert(reading);
        if (this.closed) return;
        if (!result.candidates.length) throw new Error('Model warmup returned no candidates.');
      }
      if (!this.closed) this.state = 'ready';
    } catch {
      if (!this.closed) this.state = 'error';
      client.close();
    }
  }

  async convert(reading) {
    if (this.snapshot().state !== 'ready')
      throw new Error('The model is not ready yet. Check its status above the notebook.');
    return this.client.convert(reading);
  }

  close() {
    this.closed = true;
    this.state = 'error';
    this.client?.close();
  }
}
